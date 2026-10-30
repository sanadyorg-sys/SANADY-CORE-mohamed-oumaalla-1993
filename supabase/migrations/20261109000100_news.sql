-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Actualités (news & communications hub)
--
-- Articles written by the SANADY team: administrators create, publish,
-- schedule and archive; training managers and partnership staff write
-- drafts that an administrator publishes. Each article has one audience:
--   public       — everyone, on the public site;
--   members      — every signed-in member (company-only users excluded,
--                  like the library);
--   institutions — active members of the institutions it is linked to.
-- An article is visible when status = 'published' and published_at has
-- passed: a future published_at is a scheduled publication, with no
-- background job involved. Visitors read through security-definer functions
-- (news_feed, news_article) that apply these rules; the tables themselves
-- are reserved to the editorial team.
-- The body is plain text in a small markup (titles, lists, quotes, links,
-- images) rendered by the application without HTML: no stored HTML at all.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Categories (managed by administrators) ─────────────────────────────────
create table public.news_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text not null default '' check (char_length(description) <= 300),
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index news_categories_name_idx on public.news_categories (lower(btrim(name)));

create trigger news_categories_updated_at
  before update on public.news_categories
  for each row execute function private.set_updated_at();
create trigger news_categories_audit
  after insert or update or delete on public.news_categories
  for each row execute function private.audit_row_change('name');

insert into public.news_categories (name, slug, position) values
  ('Actualités institutionnelles', 'actualites-institutionnelles', 1),
  ('Formation des enseignants', 'formation-des-enseignants', 2),
  ('Nouveaux programmes', 'nouveaux-programmes', 3),
  ('Événements et webinaires', 'evenements-et-webinaires', 4),
  ('Ressources pédagogiques', 'ressources-pedagogiques', 5),
  ('Partenariats', 'partenariats', 6),
  ('Témoignages et impact', 'temoignages-et-impact', 7),
  ('Innovation pédagogique', 'innovation-pedagogique', 8),
  ('Annonces importantes', 'annonces-importantes', 9);

-- ─── Articles ───────────────────────────────────────────────────────────────
create table public.news_articles (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
  title            text not null check (char_length(btrim(title)) between 3 and 200),
  subtitle         text check (char_length(subtitle) <= 300),
  excerpt          text not null default '' check (char_length(excerpt) <= 500),
  body             text not null default '' check (char_length(body) <= 100000),
  cover_path       text check (char_length(cover_path) <= 500),
  cover_alt        text not null default '' check (char_length(cover_alt) <= 250),
  category_id      uuid references public.news_categories (id) on delete set null,
  author_label     text not null default 'Fondation Sanady' check (char_length(btrim(author_label)) between 2 and 120),
  visibility       text not null default 'public' check (visibility in ('public', 'members', 'institutions')),
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Publication date; in the future = scheduled.
  published_at     timestamptz,
  featured         boolean not null default false,
  -- Optional event (webinar, workshop, conference): shown as an event card.
  event_starts_at  timestamptz,
  event_ends_at    timestamptz,
  event_location   text check (char_length(event_location) <= 200),
  event_online     boolean not null default false,
  event_url        text check (event_url ~ '^https://[^\s]+$' and char_length(event_url) <= 1000),
  -- E-mail to the audience once visible (at most once, see queue_news_emails).
  notify_email     boolean not null default false,
  notified_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  search           tsvector generated always as (
                     setweight(to_tsvector('french', private.fold_accents(title)), 'A')
                     || setweight(to_tsvector('french', private.fold_accents(coalesce(subtitle, '') || ' ' || excerpt)), 'B')
                     || setweight(to_tsvector('french', private.fold_accents(body)), 'C')
                   ) stored,
  check (status <> 'published' or published_at is not null),
  check (event_starts_at is not null or (event_ends_at is null and event_location is null and event_url is null and not event_online)),
  check (event_ends_at is null or event_ends_at >= event_starts_at)
);

create index news_articles_feed_idx on public.news_articles (published_at desc) where status = 'published';
create index news_articles_category_idx on public.news_articles (category_id, published_at desc) where status = 'published';
create index news_articles_admin_idx on public.news_articles (status, updated_at desc);
create index news_articles_search_idx on public.news_articles using gin (search);
create index news_articles_notify_idx on public.news_articles (published_at) where notify_email and notified_at is null;

-- Audience of an « institutions » article.
create table public.news_article_institutions (
  article_id     uuid not null references public.news_articles (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  primary key (article_id, institution_id)
);
create index news_article_institutions_institution_idx on public.news_article_institutions (institution_id);

-- Existing courses promoted by an article (no copy of the course).
create table public.news_article_courses (
  article_id uuid not null references public.news_articles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  position   smallint not null default 0,
  primary key (article_id, course_id)
);
create index news_article_courses_course_idx on public.news_article_courses (course_id);

-- Reading statistics: daily totals only, never who read what.
create table public.news_daily_stats (
  article_id    uuid not null references public.news_articles (id) on delete cascade,
  day           date not null,
  views         integer not null default 0 check (views >= 0),
  course_clicks integer not null default 0 check (course_clicks >= 0),
  event_clicks  integer not null default 0 check (event_clicks >= 0),
  primary key (article_id, day)
);

create trigger news_articles_updated_at
  before update on public.news_articles
  for each row execute function private.set_updated_at();
create trigger news_articles_audit
  after insert or update or delete on public.news_articles
  for each row execute function private.audit_row_change('title');

-- ─── Roles ─────────────────────────────────────────────────────────────────
-- Editorial team: administrators, training managers, partnership staff
-- (all from a two-factor session, as their own role checks require).
create function private.is_news_editor(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin(p_user) or private.is_training_manager(p_user) or private.is_partnership_staff(p_user);
$$;

-- Whether the current person (anonymous included) may read a published article.
create function private.news_visible(p_article uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.news_articles a
     where a.id = p_article
       and a.status = 'published'
       and a.published_at <= now()
       and (
         a.visibility = 'public'
         or (a.visibility = 'members' and private.is_active_user() and not private.is_enterprise_only_user())
         or (a.visibility = 'institutions' and private.is_active_user() and exists (
               select 1 from public.news_article_institutions ai
                where ai.article_id = a.id and private.is_institution_member(ai.institution_id)))
       )
  );
$$;

-- Writing rules the interface cannot bypass:
--  · only administrators publish, schedule, archive or touch a non-draft;
--  · publishing needs a category, an introduction, a body and, for an
--    « institutions » article, at least one institution;
--  · notified_at is kept for the e-mail queue.
create function private.news_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('sanady.news_system', true) = 'on' then
    return new;
  end if;
  new.notified_at := case when tg_op = 'INSERT' then null else old.notified_at end;
  -- People act through their session; server maintenance (no session) is trusted.
  if auth.uid() is not null and not private.is_sanady_admin() then
    perform private.require(new.status = 'draft' and (tg_op = 'INSERT' or old.status = 'draft'), 'news_publish_forbidden');
  end if;
  if new.status = 'published' then
    perform private.require(new.category_id is not null, 'news_category_required');
    perform private.require(char_length(btrim(new.excerpt)) >= 20, 'news_excerpt_required');
    perform private.require(char_length(btrim(new.body)) >= 50, 'news_body_required');
    perform private.require(
      new.visibility <> 'institutions'
      or exists (select 1 from public.news_article_institutions where article_id = new.id),
      'news_audience_required');
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.archived_at := case when new.status = 'archived' then coalesce(new.archived_at, now()) end;
  if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger news_articles_guard
  before insert or update on public.news_articles
  for each row execute function private.news_guard();

-- Links (audience, courses) of a published article are changed by administrators only.
create function private.can_edit_news(p_article uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin()
      or (private.is_news_editor() and exists (select 1 from public.news_articles where id = p_article and status = 'draft'));
$$;

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.news_categories           enable row level security;
alter table public.news_articles             enable row level security;
alter table public.news_article_institutions enable row level security;
alter table public.news_article_courses      enable row level security;
alter table public.news_daily_stats          enable row level security;

-- Supabase grants new tables to anon/authenticated by default: start from nothing.
revoke all on public.news_categories, public.news_articles, public.news_article_institutions,
  public.news_article_courses, public.news_daily_stats
  from anon, authenticated;

create policy news_categories_select on public.news_categories for select to authenticated using (true);
create policy news_categories_insert on public.news_categories for insert to authenticated with check (private.is_sanady_admin());
create policy news_categories_update on public.news_categories for update to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
create policy news_categories_delete on public.news_categories for delete to authenticated using (private.is_sanady_admin());

create policy news_articles_select on public.news_articles for select to authenticated
  using (private.is_news_editor() or private.news_visible(id));
create policy news_articles_insert on public.news_articles for insert to authenticated
  with check (private.is_news_editor());
create policy news_articles_update on public.news_articles for update to authenticated
  using (private.is_news_editor()) with check (private.is_news_editor());
create policy news_articles_delete on public.news_articles for delete to authenticated
  using (private.is_sanady_admin());

create policy news_article_institutions_select on public.news_article_institutions for select to authenticated using (private.is_news_editor());
create policy news_article_institutions_insert on public.news_article_institutions for insert to authenticated with check (private.can_edit_news(article_id));
create policy news_article_institutions_delete on public.news_article_institutions for delete to authenticated using (private.can_edit_news(article_id));

create policy news_article_courses_select on public.news_article_courses for select to authenticated using (private.is_news_editor());
create policy news_article_courses_insert on public.news_article_courses for insert to authenticated with check (private.can_edit_news(article_id));
create policy news_article_courses_update on public.news_article_courses for update to authenticated
  using (private.can_edit_news(article_id)) with check (private.can_edit_news(article_id));
create policy news_article_courses_delete on public.news_article_courses for delete to authenticated using (private.can_edit_news(article_id));

create policy news_daily_stats_select on public.news_daily_stats for select to authenticated using (private.is_news_editor());

grant select on public.news_categories to authenticated;
grant insert, update, delete on public.news_categories to authenticated;
grant select, insert, update, delete on public.news_articles to authenticated;
grant select, insert, delete on public.news_article_institutions to authenticated;
grant select, insert, update, delete on public.news_article_courses to authenticated;
grant select on public.news_daily_stats to authenticated;

-- ─── Reading: feed and article (anonymous visitors included) ───────────────
-- Paginated feed of the articles the caller may read, newest first (or by
-- relevance when searching). total_count repeats the full count on each row.
create function public.news_feed(
  p_query     text default null,
  p_category  text default null,
  p_page      integer default 1,
  p_page_size integer default 12,
  p_sort      text default 'recent',
  p_featured  boolean default null,
  p_exclude   uuid default null
)
returns table (
  id               uuid,
  slug             text,
  title            text,
  subtitle         text,
  excerpt          text,
  cover_path       text,
  cover_alt        text,
  category_name    text,
  category_slug    text,
  author_label     text,
  visibility       text,
  published_at     timestamptz,
  featured         boolean,
  event_starts_at  timestamptz,
  event_location   text,
  event_online     boolean,
  reading_minutes  integer,
  total_count      bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select case when nullif(btrim(p_query), '') is null then null
                else websearch_to_tsquery('french', private.fold_accents(btrim(left(p_query, 200)))) end as tsq
  )
  select a.id, a.slug, a.title, a.subtitle, a.excerpt, a.cover_path, a.cover_alt,
         c.name, c.slug, a.author_label, a.visibility, a.published_at, a.featured,
         a.event_starts_at, a.event_location, a.event_online,
         greatest(1, round(coalesce(array_length(regexp_split_to_array(btrim(a.body), '\s+'), 1), 0) / 200.0))::integer,
         count(*) over ()
    from public.news_articles a
    left join public.news_categories c on c.id = a.category_id
    cross join q
   where a.status = 'published'
     and a.published_at <= now()
     and private.news_visible(a.id)
     and (p_category is null or c.slug = p_category)
     and (p_featured is null or a.featured = p_featured)
     and (p_exclude is null or a.id <> p_exclude)
     and (q.tsq is null or a.search @@ q.tsq)
   order by case when p_sort = 'relevance' and q.tsq is not null then ts_rank(a.search, q.tsq) end desc nulls last,
            a.published_at desc, a.id
   limit least(greatest(coalesce(p_page_size, 12), 1), 48)
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 12), 1), 48);
$$;

-- One article with what its page needs, or null when the caller may not read
-- it. p_preview lets the editorial team see a draft or a scheduled article.
-- Linked courses that are no longer published are left out.
create function public.news_article(p_slug text, p_preview boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.news_articles;
  v_signed boolean := auth.uid() is not null and private.is_active_user();
begin
  select * into a from public.news_articles where slug = p_slug;
  if a.id is null then return null; end if;
  if not (private.news_visible(a.id) or (p_preview and private.is_news_editor())) then return null; end if;

  return jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'title', a.title, 'subtitle', a.subtitle, 'excerpt', a.excerpt, 'body', a.body,
    'cover_path', a.cover_path, 'cover_alt', a.cover_alt, 'author_label', a.author_label,
    'visibility', a.visibility, 'status', a.status, 'published_at', a.published_at, 'updated_at', a.updated_at,
    'reading_minutes', greatest(1, round(coalesce(array_length(regexp_split_to_array(btrim(a.body), '\s+'), 1), 0) / 200.0))::integer,
    'category', (select jsonb_build_object('name', c.name, 'slug', c.slug) from public.news_categories c where c.id = a.category_id),
    'event', case when a.event_starts_at is null then null else jsonb_build_object(
      'starts_at', a.event_starts_at, 'ends_at', a.event_ends_at, 'location', a.event_location,
      'online', a.event_online, 'has_registration', a.event_url is not null) end,
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'title', c.title, 'cover_path', c.cover_path,
               'public', c.public_listing,
               'accessible', v_signed and private.can_view_course(c.id))
             order by l.position, c.title)
        from public.news_article_courses l
        join public.courses c on c.id = l.course_id
       where l.article_id = a.id
         and c.status = 'published'
         and (c.public_listing or (v_signed and private.can_view_course(c.id)))
    ), '[]'::jsonb),
    'previous', (
      select jsonb_build_object('slug', p.slug, 'title', p.title)
        from public.news_articles p
       where a.published_at is not null and p.status = 'published' and p.published_at < a.published_at and private.news_visible(p.id)
       order by p.published_at desc limit 1),
    'next', (
      select jsonb_build_object('slug', n.slug, 'title', n.title)
        from public.news_articles n
       where a.published_at is not null and n.status = 'published' and n.published_at > a.published_at
         and n.published_at <= now() and private.news_visible(n.id)
       order by n.published_at asc limit 1),
    'related', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.slug, 'title', r.title, 'excerpt', r.excerpt, 'cover_path', r.cover_path,
                                          'cover_alt', r.cover_alt, 'published_at', r.published_at) order by r.published_at desc)
        from (select * from public.news_articles r
               where r.id <> a.id and r.category_id = a.category_id and r.status = 'published' and private.news_visible(r.id)
               order by r.published_at desc limit 3) r
    ), '[]'::jsonb)
  );
end;
$$;

-- Registration link of an article's event, for the counting redirect.
create function public.news_event_url(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.event_url from public.news_articles a where a.slug = p_slug and private.news_visible(a.id);
$$;

-- Categories for the public filters (anonymous visitors read no table directly).
create function public.public_news_categories()
returns table (id uuid, name text, slug text, description text, "position" smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.slug, c.description, c.position from public.news_categories c order by c.position, c.name;
$$;

grant execute on function public.news_feed(text, text, integer, integer, text, boolean, uuid), public.news_article(text, boolean),
  public.news_event_url(text), public.public_news_categories() to anon, authenticated;

-- ─── Statistics (server only, after rate limiting) ─────────────────────────
create function public.record_news_event(p_slug text, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind not in ('view', 'course', 'event') then return; end if;
  select id into v_id from public.news_articles where slug = p_slug and status = 'published' and published_at <= now();
  if v_id is null then return; end if;
  insert into public.news_daily_stats as s (article_id, day, views, course_clicks, event_clicks)
  values (v_id, (now() at time zone 'Africa/Casablanca')::date,
          (p_kind = 'view')::integer, (p_kind = 'course')::integer, (p_kind = 'event')::integer)
  on conflict (article_id, day) do update
     set views = s.views + excluded.views,
         course_clicks = s.course_clicks + excluded.course_clicks,
         event_clicks = s.event_clicks + excluded.event_clicks;
end;
$$;

-- ─── E-mail to the audience ────────────────────────────────────────────────
-- Queues one message per recipient (respecting their e-mail preference),
-- once per article. Recipients: active members of the linked institutions,
-- or, for « public » and « members » articles, active members of schools
-- (company workspaces and partner portals are not mailed).
create function private.queue_news_emails(p_article uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.news_articles;
  v_count integer;
begin
  select * into a from public.news_articles where id = p_article for update;
  if a.id is null or a.status <> 'published' or a.published_at > now() or not a.notify_email or a.notified_at is not null then
    return 0;
  end if;
  perform private.notify(
    'news_published', u.user_id,
    jsonb_build_object('title', a.title, 'excerpt', a.excerpt, 'slug', a.slug),
    'news:' || a.id || ':' || u.user_id)
  from (
    select distinct m.user_id
      from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id
     where m.status = 'active'
       and i.kind <> 'enterprise'
       and (a.visibility <> 'institutions'
            or exists (select 1 from public.news_article_institutions ai where ai.article_id = a.id and ai.institution_id = m.institution_id))
  ) u;
  select count(*) into v_count from public.notification_outbox where dedupe_key like 'news:' || a.id || ':%';
  perform set_config('sanady.news_system', 'on', true);
  update public.news_articles set notified_at = now() where id = a.id;
  perform set_config('sanady.news_system', 'off', true);
  return v_count;
end;
$$;

-- Administrator, right after publishing.
create function public.queue_news_emails(p_article uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  return private.queue_news_emails(p_article);
end;
$$;

-- Daily job: scheduled articles whose time has come.
create function public.queue_due_news_emails()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_id uuid;
begin
  for v_id in
    select id from public.news_articles
     where status = 'published' and notify_email and notified_at is null and published_at <= now()
  loop
    v_total := v_total + private.queue_news_emails(v_id);
  end loop;
  return v_total;
end;
$$;

revoke execute on function private.queue_news_emails(uuid), private.news_guard(), private.can_edit_news(uuid),
  private.is_news_editor(uuid), private.news_visible(uuid)
  from public, anon;
grant execute on function private.is_news_editor(uuid), private.news_visible(uuid), private.can_edit_news(uuid) to authenticated;
revoke execute on function public.queue_news_emails(uuid) from public, anon;
grant execute on function public.queue_news_emails(uuid) to authenticated;
revoke execute on function public.queue_due_news_emails(), public.record_news_event(text, text) from public, anon, authenticated;
grant execute on function public.queue_due_news_emails(), public.record_news_event(text, text) to service_role;

-- ─── Storage: images (covers and body images) ──────────────────────────────
-- Public bucket like course covers: images only, 5 MB, written by the team.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-images', 'news-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy news_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'news-images' and private.is_news_editor());
create policy news_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'news-images' and private.is_news_editor())
  with check (bucket_id = 'news-images' and private.is_news_editor());
create policy news_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'news-images' and private.is_news_editor());
