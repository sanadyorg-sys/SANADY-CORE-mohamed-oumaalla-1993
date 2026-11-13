-- ════════════════════════════════════════════════════════════════════════════
-- SANADY — follow-up to the project review
--
-- 1. Statistics: attempts replaced by the automatic second set still count in
--    reports (they were real attempts). Attempts cancelled by an administrator
--    stay excluded, as before.
-- 2. Company seats: one way of counting for invitations and for joining, and
--    one join at a time per company.
-- 3. Data deletion: the profile photos of deleted accounts are listed so the
--    server removes the files.
-- 4. Access requests: approving a teacher's request and creating the
--    invitation happen together, so two simultaneous approvals cannot leave a
--    revoked link.
-- 5. Dates: every function that reads « today » does so in Morocco time.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Automatic second set: kept in the statistics ───────────────────────
alter table public.quiz_attempts add column auto_released boolean not null default false;

update public.quiz_attempts set auto_released = true
 where voided_at is not null and voided_by is null and void_reason = 'Réattribution automatique après 7 minutes';

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
                           where v.quiz_id = r.quiz_id and v.user_id = p_user and v.auto_released);

    update public.quiz_attempts
       set voided_at = now(), voided_by = null, void_reason = c_reason, auto_released = true
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

create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select b.v_from, b.v_to into v_from, v_to from private.period_bounds(p_from, p_to) b;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'kpis', (
      select jsonb_build_object(
        'teachers', (select count(*) from public.profiles p
                      where p.status = 'active' and not exists (select 1 from public.platform_roles r where r.user_id = p.id)
                        and not private.is_enterprise_only_user(p.id)),
        'new_teachers', (select count(*) from public.profiles p
                          where p.created_at >= v_from and p.created_at < v_to
                            and not exists (select 1 from public.platform_roles r where r.user_id = p.id)
                            and not private.is_enterprise_only_user(p.id)),
        'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                             where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                               and not private.is_enterprise_only_user(e.user_id)),
        'institutions', (select count(*) from public.institutions where status = 'active' and kind = 'school'),
        'published_courses', (select count(*) from public.courses c where c.status = 'published' and not private.is_enterprise_course(c.id)),
        'active_enrollments', (select count(*) from public.enrollments en where en.status = 'active' and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'completions', (select count(*) from public.enrollments en where en.completed_at >= v_from and en.completed_at < v_to
                          and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'completion_rate', (select round(count(*) filter (where status = 'completed')::numeric
                                         / nullif(count(*) filter (where started_at is not null), 0), 4)
                              from public.enrollments en where not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'attempts', a.n,
        'average_score', a.avg_score,
        'pass_rate', a.pass_rate,
        'certificates', (select count(*) from public.certificates ct
                          where ct.issued_at >= v_from and ct.issued_at < v_to and ct.revoked_at is null
                            and not private.is_enterprise_only_user(ct.user_id) and not private.is_enterprise_course(ct.course_id))
      )
      from (
        select count(*) as n,
               round(avg(score_percent), 1) as avg_score,
               round(count(*) filter (where passed)::numeric / nullif(count(*), 0), 4) as pass_rate
          from public.quiz_attempts qa
         where qa.status = 'submitted' and (qa.voided_at is null or qa.auto_released) and qa.submitted_at >= v_from and qa.submitted_at < v_to
           and not private.is_enterprise_only_user(qa.user_id) and not private.is_enterprise_course(qa.course_id)
      ) a
    ),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week', w::date,
               'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                                    where e.occurred_at >= greatest(w, v_from) and e.occurred_at < least(w + interval '7 days', v_to) and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                                      and not private.is_enterprise_only_user(e.user_id)),
               'completions', (select count(*) from public.enrollments en
                                where en.completed_at >= greatest(w, v_from) and en.completed_at < least(w + interval '7 days', v_to)
                                  and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
               'certificates', (select count(*) from public.certificates c
                                 where c.issued_at >= greatest(w, v_from) and c.issued_at < least(w + interval '7 days', v_to)
                                   and c.revoked_at is null and not private.is_enterprise_only_user(c.user_id) and not private.is_enterprise_course(c.course_id))
             ) order by w)
        from generate_series(date_trunc('week', v_from), v_to - interval '1 second', interval '7 days') w
    ), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.title)
        from (
          select c.id, c.title, c.status,
                 count(en.id) as enrolled,
                 count(en.started_at) as started,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(en.started_at), 0), 4) as completion_rate,
                 (select count(distinct e.user_id) from public.learning_events e
                   where e.course_id = c.id and e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                     and not private.is_enterprise_only_user(e.user_id)) as active_in_period,
                 (select round(avg(qa.score_percent), 1) from public.quiz_attempts qa
                   where qa.course_id = c.id and qa.status = 'submitted' and (qa.voided_at is null or qa.auto_released)
                     and qa.submitted_at >= v_from and qa.submitted_at < v_to and not private.is_enterprise_only_user(qa.user_id)) as average_score,
                 (select count(*) from public.certificates ct where ct.course_id = c.id and ct.revoked_at is null and not private.is_enterprise_only_user(ct.user_id)) as certificates
            from public.courses c
            left join public.enrollments en on en.course_id = c.id and not private.is_enterprise_only_user(en.user_id)
           where c.status <> 'draft' and not private.is_enterprise_course(c.id)
           group by c.id
        ) x
    ), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.name)
        from (
          select i.id, i.name, i.city,
                 (select count(*) from public.institution_memberships m
                   where m.institution_id = i.id and m.role = 'teacher' and m.status = 'active') as teachers,
                 count(ca.id) as assignments,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(ca.id), 0), 4) as completion_rate,
                 (select count(distinct e.user_id)
                    from public.learning_events e
                    join public.course_assignments ca2 on ca2.user_id = e.user_id and ca2.course_id = e.course_id
                                                     and ca2.institution_id = i.id and ca2.revoked_at is null
                   where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')) as active_in_period,
                 count(ct.id) as certificates
            from public.institutions i
            left join public.course_assignments ca
                   on ca.institution_id = i.id and ca.revoked_at is null
                  and exists (select 1 from public.institution_memberships m
                               where m.institution_id = i.id and m.user_id = ca.user_id and m.role = 'teacher' and m.status = 'active')
            left join public.enrollments en on en.user_id = ca.user_id and en.course_id = ca.course_id
            left join public.certificates ct on ct.user_id = ca.user_id and ct.course_id = ca.course_id and ct.revoked_at is null
           where i.status = 'active' and i.kind = 'school'
           group by i.id
        ) x
    ), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.course_title, x.module_position)
        from (
          select q.id, q.title, c.title as course_title, m.position + 1 as module_position,
                 count(distinct qa.user_id) as learners,
                 count(*) as attempts,
                 round(avg(qa.score_percent), 1) as average_score,
                 round(count(distinct qa.user_id) filter (where qa.passed)::numeric / nullif(count(distinct qa.user_id), 0), 4) as pass_rate,
                 round(count(*) filter (where qa.attempt_number = 1 and (qa.auto_released or not exists (select 1 from public.quiz_attempts r where r.quiz_id = qa.quiz_id and r.user_id = qa.user_id and r.auto_released)) and qa.passed)::numeric
                       / nullif(count(*) filter (where qa.attempt_number = 1 and (qa.auto_released or not exists (select 1 from public.quiz_attempts r where r.quiz_id = qa.quiz_id and r.user_id = qa.user_id and r.auto_released))), 0), 4) as first_attempt_pass_rate
            from public.quiz_attempts qa
            join public.quizzes q on q.id = qa.quiz_id
            join public.modules m on m.id = q.module_id
            join public.courses c on c.id = q.course_id
           where qa.status = 'submitted' and (qa.voided_at is null or qa.auto_released)
             and qa.submitted_at >= v_from and qa.submitted_at < v_to
             and not private.is_enterprise_only_user(qa.user_id) and not private.is_enterprise_course(c.id)
           group by q.id, c.title, m.position
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.institution_report(p_institution uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  perform private.require(
    private.is_course_staff() or private.can_supervise_institution(p_institution),
    'forbidden'
  );
  select b.v_from, b.v_to into v_from, v_to from private.period_bounds(p_from, p_to) b;

  return (
    -- Only (teacher, course) pairs this institution assigned, for its active members.
    with asg as (
      select ca.user_id, ca.course_id
        from public.course_assignments ca
        join public.institution_memberships m
          on m.institution_id = ca.institution_id and m.user_id = ca.user_id and m.role = 'teacher' and m.status = 'active'
       where ca.institution_id = p_institution and ca.revoked_at is null
    ),
    ev as (
      select e.user_id, e.course_id, e.occurred_at
        from public.learning_events e
        join asg on asg.user_id = e.user_id and asg.course_id = e.course_id
       where e.occurred_at >= v_from and e.occurred_at < v_to
         and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
    ),
    att as (
      select qa.*
        from public.quiz_attempts qa
        join asg on asg.user_id = qa.user_id and asg.course_id = qa.course_id
       where qa.status = 'submitted' and (qa.voided_at is null or qa.auto_released) and qa.submitted_at >= v_from and qa.submitted_at < v_to
    ),
    enr as (
      select en.*
        from public.enrollments en
        join asg on asg.user_id = en.user_id and asg.course_id = en.course_id
    ),
    cert as (
      select ct.*
        from public.certificates ct
        join asg on asg.user_id = ct.user_id and asg.course_id = ct.course_id
       where ct.revoked_at is null
    )
    select jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'kpis', jsonb_build_object(
        'teachers', (select count(*) from public.institution_memberships m
                      where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'),
        'assignments', (select count(*) from asg),
        'completed', (select count(*) from enr where enr.status = 'completed'),
        'completion_rate', (select round(count(*) filter (where enr.status = 'completed')::numeric / nullif((select count(*) from asg), 0), 4) from enr),
        'active_teachers', (select count(distinct ev.user_id) from ev),
        'completions', (select count(*) from enr where enr.completed_at >= v_from and enr.completed_at < v_to),
        'attempts', (select count(*) from att),
        'average_score', (select round(avg(att.score_percent), 1) from att),
        'pass_rate', (select round(count(*) filter (where att.passed)::numeric / nullif(count(*), 0), 4) from att),
        'certificates', (select count(*) from cert where cert.issued_at >= v_from and cert.issued_at < v_to)
      ),
      'weekly', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'week', w::date,
                 'active_teachers', (select count(distinct ev.user_id) from ev
                                      where ev.occurred_at >= greatest(w, v_from) and ev.occurred_at < least(w + interval '7 days', v_to)),
                 'completions', (select count(*) from enr
                                  where enr.completed_at >= greatest(w, v_from) and enr.completed_at < least(w + interval '7 days', v_to))
               ) order by w)
          from generate_series(date_trunc('week', v_from), v_to - interval '1 second', interval '7 days') w
      ), '[]'::jsonb),
      'courses', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.title)
          from (
            select c.id, c.title,
                   count(*) as assigned,
                   count(enr.started_at) as started,
                   count(enr.completed_at) as completed,
                   round(count(enr.completed_at)::numeric / nullif(count(*), 0), 4) as completion_rate,
                   (select round(avg(att.score_percent), 1) from att where att.course_id = c.id) as average_score,
                   (select count(*) from cert where cert.course_id = c.id) as certificates
              from asg
              join public.courses c on c.id = asg.course_id
              left join enr on enr.user_id = asg.user_id and enr.course_id = asg.course_id
             group by c.id
          ) x
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ─── 3. Data deletion: profile photos of the deleted accounts ──────────────
create or replace function public.execute_due_deletions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d        public.data_deletions;
  t        public.enterprise_tenants;
  v_inst   uuid;
  v_users  uuid[];
  v_others uuid[];
  v_courses uuid[];
  v_files  text[];
  v_avatars text[];
  v_out    jsonb := '[]'::jsonb;
  v_cert   jsonb;
  v_n      record;
begin
  for d in select * from public.data_deletions
            where status = 'confirmed' and execute_after <= now() and hold_reason is null
            for update skip locked loop
    -- Re-checked at the last moment: nothing has changed since the confirmation.
    if cardinality(private.deletion_blockers(d)) > 0 then
      continue;
    end if;
    select * into t from public.enterprise_tenants where id = d.tenant_id;
    v_inst := t.institution_id;
    v_courses := array(select id from public.courses where owner_institution_id = v_inst);
    -- Accounts that exist only for this company (no other institution, no SANADY role, no partner access).
    v_users := array(
      select m.user_id from public.institution_memberships m
       where m.institution_id = v_inst
         and not exists (select 1 from public.institution_memberships o where o.user_id = m.user_id and o.institution_id <> v_inst)
         and not exists (select 1 from public.platform_roles r where r.user_id = m.user_id)
         and not exists (select 1 from public.partner_portal_members pm where pm.user_id = m.user_id));
    v_others := array(select user_id from public.institution_memberships where institution_id = v_inst and not (user_id = any (v_users)));
    v_avatars := array(select name from storage.objects where bucket_id = 'avatars' and split_part(name, '/', 1) = any (array(select u::text from unnest(v_users) u)));
    v_files := array(select name from storage.objects where bucket_id = 'course-media' and split_part(name, '/', 1) = any (array(select c::text from unnest(v_courses) c)));
    select
      cardinality(v_users) as accounts,
      cardinality(v_others) as memberships,
      cardinality(v_courses) as courses,
      cardinality(v_files) + cardinality(v_avatars) + case when t.logo_path is null then 0 else 1 end as files,
      (select count(*) from public.enterprise_support_requests where tenant_id = t.id) as support
      into v_n;

    -- The company's own courses: everyone's records on them, then the courses.
    delete from public.learning_events where course_id = any (v_courses);
    delete from public.quiz_attempts where course_id = any (v_courses);
    delete from public.video_progress where lesson_id in (select id from public.lessons where course_id = any (v_courses));
    delete from public.document_progress where lesson_id in (select id from public.lessons where course_id = any (v_courses));
    delete from public.lesson_progress where course_id = any (v_courses);
    delete from public.certificates where course_id = any (v_courses);
    delete from public.enrollments where course_id = any (v_courses);
    update public.training_projects set course_id = null where course_id = any (v_courses);
    delete from public.courses where id = any (v_courses);
    -- Support, rules, files, the space itself.
    delete from public.enterprise_support_requests where tenant_id = t.id;
    delete from public.enterprise_assessment_policies where tenant_id = t.id;
    perform set_config('sanady.tenant_sync', 'on', true);
    update public.enterprise_tenants set institution_id = null, logo_path = null, data_deleted_at = now(), updated_at = now() where id = t.id;
    if v_inst is not null then
      delete from public.institutions where id = v_inst;
    end if;
    perform set_config('sanady.tenant_sync', '', true);
    -- Accounts that existed only for this company (their own data follows).
    delete from auth.users where id = any (v_users);

    v_cert := jsonb_build_object(
      'organisation', (select name from public.partner_organizations where id = t.organization_id),
      'space', t.display_name, 'executed_at', now(),
      'proposed_at', d.proposed_at, 'proposed_by', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = d.proposed_by),
      'confirmed_at', d.confirmed_at, 'confirmed_by', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = d.confirmed_by),
      'notice_sent_on', d.notice_sent_on, 'data_delivered_on', d.data_delivered_on, 'delivery_method', d.delivery_method,
      'deleted', jsonb_build_object('accounts', v_n.accounts, 'memberships', v_n.memberships, 'courses', v_n.courses,
                                    'files', v_n.files, 'support_requests', v_n.support),
      'kept', 'Organisation, contrats, factures et paiements (comptabilité), relevés d’utilisation (totaux sans nom), historique.');
    update public.data_deletions set status = 'executed', executed_at = now(), certificate = v_cert, updated_at = now() where id = d.id;
    perform private.deletion_log(t.id, 'deletion_executed', null);
    perform private.log_audit('data_deletion_executed', 'enterprise_tenants', t.id, null, v_cert -> 'deleted');
    v_out := v_out || jsonb_build_object('deletion_id', d.id, 'files', to_jsonb(v_files), 'avatars', to_jsonb(v_avatars), 'logo', t.logo_path);
  end loop;
  return v_out;
end;
$$;

-- ─── 2. Company seats: one count, one join at a time ───────────────────────
-- A seat is taken by an active employee or held by an open invitation. The
-- person who joins does not count their own invitation twice. Locking the
-- company's row makes simultaneous joins and invitations wait for each other.
create or replace function private.guard_enterprise_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
begin
  if new.status <> 'active' or not private.is_enterprise_institution(new.institution_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.role = new.role then
    return new;
  end if;
  select * into t from public.enterprise_tenants where institution_id = new.institution_id for update;
  if new.role = 'teacher' then
    perform private.require(t.status = 'active', 'tenant_inactive');
    perform private.require(
      (select count(*) from public.institution_memberships
        where institution_id = new.institution_id and role = 'teacher' and status = 'active' and id <> new.id)
      + (select count(*) from public.invitations i
          where i.institution_id = new.institution_id and i.kind = 'institution_teacher'
            and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
            and i.email is distinct from (select lower(p.email) from public.profiles p where p.id = new.user_id))
      < t.max_learners,
      'tenant_full');
  else
    perform private.require(t.status in ('provisioning', 'active', 'suspended'), 'tenant_inactive');
  end if;
  return new;
end;
$$;

create or replace function private.guard_enterprise_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
begin
  if new.institution_id is null or not private.is_enterprise_institution(new.institution_id) then
    return new;
  end if;
  select * into t from public.enterprise_tenants where institution_id = new.institution_id for update;
  if new.kind = 'institution_teacher' then
    perform private.require(t.status = 'active', 'tenant_inactive');
    perform private.require(private.tenant_seats_used(new.institution_id) < t.max_learners, 'tenant_full');
  else
    perform private.require(t.status in ('provisioning', 'active', 'suspended'), 'tenant_inactive');
  end if;
  perform private.require(
    new.department_id is null
    or exists (select 1 from public.enterprise_departments d where d.id = new.department_id and d.institution_id = new.institution_id),
    'invalid_input');
  return new;
end;
$$;

-- ─── 4. Access requests: approval and invitation together ──────────────────
create function public.approve_teacher_access_request(p_request uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     public.access_requests;
  v_inv uuid;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  -- The first approval takes the request; a second one finds nothing pending.
  select * into r from public.access_requests where id = p_request and status = 'pending' for update;
  perform private.require(r.id is not null, 'not_found');
  perform private.require(r.kind::text = 'teacher', 'invalid_input');

  v_inv := public.create_invitation('teacher', r.email, null, p_token_hash);
  update public.access_requests
     set status = 'approved', handled_at = now(), handled_by = auth.uid(), invitation_id = v_inv
   where id = p_request;
  return jsonb_build_object('invitation_id', v_inv, 'email', r.email);
end;
$$;
revoke execute on function public.approve_teacher_access_request(uuid, text) from public, anon;
grant execute on function public.approve_teacher_access_request(uuid, text) to authenticated;

-- ─── 5. « Today » is the Moroccan day ──────────────────────────────────────
-- The database clock is UTC: between midnight and 1 a.m. in Morocco,
-- current_date was still the previous day (deadlines, contract end dates,
-- reminders, deletion dates). Every function that reads current_date now runs
-- in Morocco time. KEEP THIS BLOCK LAST, and repeat it in any later migration
-- that creates or replaces a function using current_date (replacing a
-- function drops its settings); tests/db/morocco-dates.test.ts checks it.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosrc ~* '\mcurrent_date\M'
  loop
    execute format('alter function %s set timezone = %L', f.signature, 'Africa/Casablanca');
  end loop;
end;
$$;
