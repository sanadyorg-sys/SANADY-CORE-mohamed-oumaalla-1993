-- ════════════════════════════════════════════════════════════════════════════
-- Evaluations: protect questions already seen by teachers
--
-- A question that appears in an attempt (open or submitted) keeps its
-- answers, its correct choice, its type and its points: changing them would
-- regrade open attempts against different answers and make past results
-- unreadable (quiz_answers.selected_option_ids keeps the option ids).
-- Wording stays editable: prompt, explanation, answer labels and order.
-- To change the substance, add a new question and remove the old one (it is
-- then archived, so past results are preserved).
-- Tested in tests/db/question-edit-guard.test.ts.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.save_question(
  p_quiz         uuid,
  p_question     uuid,
  p_kind         public.question_kind,
  p_prompt       text,
  p_explanation  text,
  p_points       smallint,
  p_options      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := p_question;
  v_correct  integer;
  v_count    integer;
  v_opt      jsonb;
  v_pos      integer := 0;
  v_keep     uuid[] := '{}';
  v_opt_id   uuid;
  v_current  public.questions;
begin
  perform private.require(private.can_edit_course((select q.course_id from public.quizzes q where q.id = p_quiz)), 'forbidden');
  perform private.require(jsonb_typeof(p_options) = 'array', 'invalid_options');

  v_count := jsonb_array_length(p_options);
  select count(*) into v_correct from jsonb_array_elements(p_options) e where (e ->> 'is_correct')::boolean;

  perform private.require(v_count between 2 and 10, 'question_options_count');
  perform private.require(p_kind::text <> 'true_false' or v_count = 2, 'question_options_count');
  perform private.require(
    (p_kind::text in ('single', 'true_false') and v_correct = 1) or (p_kind = 'multiple' and v_correct >= 1),
    'question_correct_count'
  );

  if v_id is not null then
    select * into v_current from public.questions where id = v_id and quiz_id = p_quiz;
    perform private.require(found, 'not_found');

    if exists (select 1 from public.quiz_answers where question_id = v_id)
       or exists (select 1 from public.quiz_attempts where v_id = any(question_ids)) then
      -- Same type and points, and exactly the same answers with the same correct choice.
      perform private.require(v_current.kind = p_kind and v_current.points = p_points, 'question_in_use');
      perform private.require(
        v_count = (select count(*) from public.question_options where question_id = v_id)
        and not exists (
          select 1
            from jsonb_array_elements(p_options) e
            left join public.question_options o
              on o.id = private.try_uuid(e ->> 'id') and o.question_id = v_id
           where o.id is null
              or o.is_correct is distinct from coalesce((e ->> 'is_correct')::boolean, false)
        ),
        'question_in_use'
      );
    end if;
  end if;

  if v_id is null then
    insert into public.questions (quiz_id, kind, prompt, explanation, points, position)
    values (
      p_quiz, p_kind, btrim(p_prompt), btrim(coalesce(p_explanation, '')), p_points,
      coalesce((select max(position) + 1 from public.questions where quiz_id = p_quiz and archived_at is null), 0)
    )
    returning id into v_id;
  else
    update public.questions
       set kind = p_kind, prompt = btrim(p_prompt), explanation = btrim(coalesce(p_explanation, '')), points = p_points
     where id = v_id and quiz_id = p_quiz;
  end if;

  for v_opt in select * from jsonb_array_elements(p_options) loop
    v_opt_id := private.try_uuid(v_opt ->> 'id');
    if v_opt_id is not null and exists (select 1 from public.question_options where id = v_opt_id and question_id = v_id) then
      update public.question_options
         set label = btrim(v_opt ->> 'label'), is_correct = coalesce((v_opt ->> 'is_correct')::boolean, false), position = v_pos
       where id = v_opt_id;
    else
      insert into public.question_options (question_id, label, is_correct, position)
      values (v_id, btrim(v_opt ->> 'label'), coalesce((v_opt ->> 'is_correct')::boolean, false), v_pos)
      returning id into v_opt_id;
    end if;
    v_keep := v_keep || v_opt_id;
    v_pos := v_pos + 1;
  end loop;

  delete from public.question_options where question_id = v_id and not (id = any(v_keep));
  return v_id;
end;
$$;
