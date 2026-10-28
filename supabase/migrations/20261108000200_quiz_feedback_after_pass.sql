-- Assessments: until a learner may see the correct answers (by default once
-- they pass), their result shows the score only — not which questions were
-- right or wrong, the points per question or the explanations. Otherwise a
-- failed attempt tells them which answers to change on the next one (on a
-- true/false question, the answer itself).
--
-- People who follow the learner (SANADY staff, their institution) still see
-- the detail of each question. A company policy keeps its own choice:
-- « after each attempt » shows everything, « never » shows the score only.

create or replace function public.get_attempt_result(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a        public.quiz_attempts;
  v_pol      public.enterprise_assessment_policies;
  v_reveal   boolean;
  v_detail   boolean;
  v_used     integer;
begin
  select * into v_a from public.quiz_attempts where id = p_attempt;
  perform private.require(found, 'not_found');
  perform private.require(
    v_a.user_id = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_a.user_id, v_a.course_id),
    'forbidden'
  );
  perform private.require(v_a.status = 'submitted', 'attempt_not_submitted');

  -- When correct answers are shown: SANADY's rule is after passing; a
  -- company policy may show them after each attempt, or never.
  v_pol := private.assessment_policy_for(v_a.user_id, v_a.course_id);
  v_reveal := private.is_sanady_admin()
    or case coalesce(v_pol.feedback, 'after_pass')
         when 'after_each_attempt' then true
         when 'never' then false
         else exists (select 1 from public.quiz_attempts
                       where quiz_id = v_a.quiz_id and user_id = v_a.user_id and passed and voided_at is null)
       end;
  -- Right or wrong per question: with the answers, or for someone following the learner.
  v_detail := v_reveal or v_a.user_id is distinct from auth.uid();

  select count(*) into v_used from public.quiz_attempts
   where quiz_id = v_a.quiz_id and user_id = v_a.user_id and voided_at is null;

  return jsonb_build_object(
    'attempt_id', v_a.id,
    'quiz_id', v_a.quiz_id,
    'course_id', v_a.course_id,
    'attempt_number', v_a.attempt_number,
    'submitted_at', v_a.submitted_at,
    'earned_points', v_a.earned_points,
    'max_points', v_a.max_points,
    'score_percent', v_a.score_percent,
    'passed', v_a.passed,
    'pass_threshold', v_a.pass_threshold,
    'max_attempts', v_a.max_attempts,
    'attempts_used', v_used,
    'remaining_attempts', case when v_a.voided_at is null then greatest(v_a.max_attempts - v_used, 0) else null end,
    'voided', v_a.voided_at is not null,
    'answers_revealed', v_reveal,
    'details_shown', v_detail,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'explanation', case when v_reveal then nullif(q.explanation, '') end,
                 'is_correct', case when v_detail then coalesce(ans.is_correct, false) end,
                 'points_awarded', case when v_detail then coalesce(ans.points_awarded, 0) end,
                 'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb),
                 'options', coalesce((
                   select jsonb_agg(
                            jsonb_build_object('id', o.id, 'label', o.label)
                              || case when v_reveal then jsonb_build_object('is_correct', o.is_correct) else '{}'::jsonb end
                            order by o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_a.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
        left join public.quiz_answers ans on ans.attempt_id = v_a.id and ans.question_id = q.id
    ), '[]'::jsonb)
  );
end;
$$;

-- The graded answers themselves: read through get_attempt_result above, never
-- directly by the learner (they hold right or wrong per question).
drop policy quiz_answers_select on public.quiz_answers;
create policy quiz_answers_select on public.quiz_answers
  for select to authenticated
  using (exists (select 1 from public.quiz_attempts a
                  where a.id = attempt_id and a.status = 'submitted' and a.user_id is distinct from auth.uid()));
