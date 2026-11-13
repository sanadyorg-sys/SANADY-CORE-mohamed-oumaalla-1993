-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Fixes from the November 2026 review
--
-- 1. Questions can no longer be changed by a direct table update: every edit
--    goes through save_question / reorder_questions / remove_question, which
--    guard questions already used in attempts. Before, an editor could change
--    the points or type of a question in use, or bring back a removed one, by
--    calling the table directly.
-- 2. An e-mail whose sending crashed is retried 5 times at most, like a
--    failed one, instead of every 10 minutes forever.
-- 3. The automatic second set of attempts takes a lock per learner and
--    evaluation, and records nothing when a concurrent call already released
--    it (no duplicate history or activity-log entries).
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists questions_author_update on public.questions;
revoke update on public.questions from authenticated;

create or replace function public.claim_notifications(p_limit integer default 25)
returns table (id uuid, kind text, payload jsonb, email text, name text)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select o.id from public.notification_outbox o
     where o.status = 'pending'
        or (o.status = 'failed' and o.attempts < 5 and o.claimed_at < now() - make_interval(mins => 15 * o.attempts))
        or (o.status = 'sending' and o.attempts < 5 and o.claimed_at < now() - interval '10 minutes')
     order by o.created_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  )
  update public.notification_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
    from picked, public.profiles p
   where o.id = picked.id and p.id = o.user_id
  returning o.id, o.kind, o.payload, p.email, coalesce(nullif(p.full_name, ''), p.email);
$$;

create or replace function private.release_due_quiz_attempts(p_user uuid, p_quiz uuid default null)
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
    -- One release at a time per learner and evaluation (two tabs, or a page and
    -- a start at the same moment): the second sees the first one's work.
    perform pg_advisory_xact_lock(hashtextextended(r.quiz_id::text || ':' || p_user::text, 0));
    -- Once per evaluation: the next set needs an administrator.
    continue when exists (select 1 from public.quiz_attempts v
                           where v.quiz_id = r.quiz_id and v.user_id = p_user and v.void_reason = c_reason);

    update public.quiz_attempts
       set voided_at = now(), voided_by = null, void_reason = c_reason
     where quiz_id = r.quiz_id and user_id = p_user and voided_at is null;
    get diagnostics v_count = row_count;
    -- Already released by a concurrent call: nothing to record.
    continue when v_count = 0;

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
