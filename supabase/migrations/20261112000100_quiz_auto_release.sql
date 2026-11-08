-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · A second set of attempts, handed out automatically
--
-- When a learner has used every attempt at an evaluation without passing, a
-- new set is handed out on its own seven minutes after the last submission,
-- once per evaluation. The learner sees the usual « intervention de
-- l'administration » message while waiting; the release is recorded in the
-- activity log as automatic. After that second set, only an administrator can
-- reset the attempts, as before. Company courses with an approved assessment
-- policy (SANADY Enterprise) keep their own limit and are left out.
-- ════════════════════════════════════════════════════════════════════════════

create function private.release_due_quiz_attempts(p_user uuid, p_quiz uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_reason constant text := 'Réattribution automatique après 7 minutes';
  r        record;
  v_count  integer;
  v_total  integer := 0;
begin
  if p_user is null then
    return 0;
  end if;
  for r in
    select a.quiz_id, q.course_id
      from public.quiz_attempts a
      join public.quizzes q on q.id = a.quiz_id
     where a.user_id = p_user and a.voided_at is null and (p_quiz is null or a.quiz_id = p_quiz)
     group by a.quiz_id, q.course_id, q.max_attempts
    having not bool_or(a.passed)
       and not bool_or(a.status = 'in_progress')
       and count(*) >= q.max_attempts
       and max(a.submitted_at) <= now() - interval '7 minutes'
  loop
    -- A company's approved limit is theirs to keep.
    continue when (private.assessment_policy_for(p_user, r.course_id)).id is not null;
    -- Once per evaluation: the next set needs an administrator.
    continue when exists (select 1 from public.quiz_attempts v
                           where v.quiz_id = r.quiz_id and v.user_id = p_user and v.void_reason = c_reason);

    update public.quiz_attempts
       set voided_at = now(), voided_by = null, void_reason = c_reason
     where quiz_id = r.quiz_id and user_id = p_user and voided_at is null;
    get diagnostics v_count = row_count;

    perform private.record_event(p_user, r.course_id, 'quiz_attempts_reset', null, r.quiz_id,
      jsonb_build_object('voided_attempts', v_count, 'automatic', true));
    perform private.log_audit('quiz_attempts_auto_released', 'quizzes', r.quiz_id, null,
      jsonb_build_object('learner_id', p_user, 'voided_attempts', v_count));
    v_total := v_total + v_count;
  end loop;
  return v_total;
end;
$$;

revoke execute on function private.release_due_quiz_attempts(uuid, uuid) from public, anon, authenticated;

-- Called by the learner's pages so a due set shows as soon as they come back.
create function public.release_due_quiz_attempts()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.release_due_quiz_attempts(auth.uid());
$$;

revoke execute on function public.release_due_quiz_attempts() from public, anon;
grant execute on function public.release_due_quiz_attempts() to authenticated;

-- ─── Quiz engine: start releases a due set; status reports a new set ────────

create or replace function public.quiz_status(p_quiz uuid, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user  uuid := coalesce(p_user, auth.uid());
  v_quiz  public.quizzes;
  v_pol   public.enterprise_assessment_policies;
  v_max   integer;
  v_pass_at integer;
  v_due   date;
  v_used  integer;
  v_open  uuid;
  v_pass  boolean;
  v_best  numeric;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    v_user = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_user, v_quiz.course_id),
    'forbidden'
  );
  v_pol := private.assessment_policy_for(v_user, v_quiz.course_id);
  v_max := coalesce(v_pol.max_attempts, v_quiz.max_attempts);
  v_pass_at := coalesce(v_pol.pass_threshold, v_quiz.pass_threshold);
  v_due := private.assessment_due_on(v_user, v_quiz.course_id);

  select count(*),
         bool_or(passed),
         max(score_percent),
         (array_agg(id) filter (where status = 'in_progress'))[1]
    into v_used, v_pass, v_best, v_open
    from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_user and voided_at is null;

  return jsonb_build_object(
    'quiz_id', p_quiz,
    'attempts_used', v_used,
    'max_attempts', v_max,
    'remaining_attempts', greatest(v_max - v_used, 0),
    'pass_threshold', v_pass_at,
    'passed', coalesce(v_pass, false),
    'best_score', v_best,
    'open_attempt_id', v_open,
    'unlocked', private.module_lessons_complete(v_user, v_quiz.module_id),
    'question_count', (select count(*) from public.questions q where q.quiz_id = p_quiz and q.archived_at is null),
    'exhausted', not coalesce(v_pass, false) and v_open is null and v_used >= v_max,
    'company_policy', v_pol.id is not null,
    'due_on', v_due,
    -- A new set of attempts after a reset (by an administrator, or automatic).
    'reissued', v_used = 0 and exists (select 1 from public.quiz_attempts r
                                        where r.quiz_id = p_quiz and r.user_id = v_user and r.voided_at is not null),
    'closed', v_due is not null and v_due < (now() at time zone 'Africa/Casablanca')::date and v_open is null and not coalesce(v_pass, false)
  );
end;
$$;

create or replace function public.start_quiz_attempt(p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_quiz     public.quizzes;
  v_pol      public.enterprise_assessment_policies;
  v_attempt  public.quiz_attempts;
  v_used     integer;
  v_qids     uuid[];
  v_due      date;
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    exists (select 1 from public.modules m where m.id = v_quiz.module_id and m.archived_at is null),
    'not_found'
  );
  perform private.require(private.has_course_access(v_quiz.course_id), 'course_access_denied');

  -- Serialize concurrent starts for this learner and quiz.
  perform pg_advisory_xact_lock(hashtextextended(p_quiz::text || ':' || v_uid::text, 0));

  -- A second set of attempts, once due (see private.release_due_quiz_attempts).
  perform private.release_due_quiz_attempts(v_uid, p_quiz);

  perform private.require(
    not exists (select 1 from public.quiz_attempts
                 where quiz_id = p_quiz and user_id = v_uid and passed and voided_at is null),
    'quiz_already_passed'
  );

  select * into v_attempt from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_uid and status = 'in_progress' and voided_at is null;

  if not found then
    perform private.require(private.module_lessons_complete(v_uid, v_quiz.module_id), 'quiz_locked');

    -- The company's approved policy, where it applies (SANADY's rule otherwise).
    v_pol := private.assessment_policy_for(v_uid, v_quiz.course_id);
    v_due := private.assessment_due_on(v_uid, v_quiz.course_id);
    perform private.require(v_due is null or v_due >= (now() at time zone 'Africa/Casablanca')::date, 'assessment_closed');

    select count(*) into v_used from public.quiz_attempts
     where quiz_id = p_quiz and user_id = v_uid and voided_at is null;
    perform private.require(v_used < coalesce(v_pol.max_attempts, v_quiz.max_attempts), 'attempts_exhausted');

    -- Order is fixed once per attempt (stored), so reloading keeps it.
    select coalesce(array_agg(id order by case when v_quiz.shuffle_questions then random() end, position, created_at), '{}') into v_qids
      from public.questions where quiz_id = p_quiz and archived_at is null;
    perform private.require(cardinality(v_qids) > 0, 'quiz_empty');

    insert into public.quiz_attempts (quiz_id, user_id, course_id, attempt_number, pass_threshold, max_attempts, question_ids)
    values (p_quiz, v_uid, v_quiz.course_id, v_used + 1,
            coalesce(v_pol.pass_threshold, v_quiz.pass_threshold), coalesce(v_pol.max_attempts, v_quiz.max_attempts), v_qids)
    returning * into v_attempt;

    perform private.touch_enrollment(v_uid, v_quiz.course_id);
    perform private.record_event(v_uid, v_quiz.course_id, 'quiz_started', null, p_quiz,
      jsonb_build_object('attempt_number', v_attempt.attempt_number, 'company_policy', v_pol.id is not null));
  end if;

  -- Questions and options WITHOUT any correctness information.
  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'max_attempts', v_attempt.max_attempts,
    'pass_threshold', v_attempt.pass_threshold,
    'started_at', v_attempt.started_at,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'options', coalesce((
                   -- Shuffled options use a per-attempt deterministic order.
                   select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                                    order by case when v_quiz.shuffle_options and q.kind::text <> 'true_false'
                                                  then md5(v_attempt.id::text || o.id::text) end,
                                             o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_attempt.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
    ), '[]'::jsonb)
  );
end;
$$;
