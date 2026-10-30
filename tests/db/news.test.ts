/**
 * Actualités: who writes and publishes, who reads what (public, members,
 * institutions, company users, anonymous visitors), scheduled publication,
 * previews, search and pagination, linked courses, e-mails and statistics.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, uid } from "./harness";

let db: TestDb;
let admin: string;
let manager: string;
let partners: string;
let teacher: string;
let quiet: string;
let outsider: string;
let employee: string;
let school: string;
let otherSchool: string;
let category: string;

const BODY = "Un texte suffisamment long pour être publié : il présente la nouvelle formation, ses objectifs et son calendrier.";
const EXCERPT = "Une courte introduction de l’article.";

type Feed = { id: string; slug: string; total_count: string };

const feed = (user: string | null, args: { q?: string; category?: string; page?: number; size?: number } = {}) =>
  db.as(
    user,
    (q) => q<Feed>(`select * from public.news_feed($1, $2, $3, $4)`, [args.q ?? null, args.category ?? null, args.page ?? 1, args.size ?? 12]),
    user ? "authenticated" : "anon",
  );
const slugs = async (user: string | null, args?: Parameters<typeof feed>[1]) => (await feed(user, args)).map((r) => r.slug);
const article = (user: string | null, slug: string, preview = false) =>
  db.as(user, async (q) => (await q<{ a: Record<string, unknown> | null }>(`select public.news_article($1, $2) as a`, [slug, preview]))[0]!.a, user ? "authenticated" : "anon");

/** Creates an article as `user` and returns its id (published when `publish`). */
async function write(user: string, values: Record<string, unknown> = {}, publish = true) {
  const v = { slug: `article-${uid()}`, title: "Une actualité", excerpt: EXCERPT, body: BODY, category_id: category, ...values };
  const cols = Object.keys(v);
  const [row] = await db.as(user, (q) =>
    q<{ id: string; slug: string }>(
      `insert into public.news_articles (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id, slug`,
      Object.values(v),
    ),
  );
  if (publish) await db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [row!.id]));
  return row!;
}

const member = (inst: string, user: string) =>
  db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, user]);
async function institution(name: string, kind = "school") {
  // Company institutions are created by the workspace flow only (see enterprise tests).
  if (kind === "enterprise") await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  const [row] = await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ($1, $2, 'autre', 'n@n.test', $3) returning id`, [
    name,
    `EC-${uid().toUpperCase()}`,
    kind,
  ]);
  if (kind === "enterprise") {
    const [{ id: org }] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ($1, 'entreprise', 'active_service') returning id`, [name]) as [{ id: string }];
    await db.sql(
      `insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, $4, 'complete', 50, 'active', now())`,
      [org, row!.id, `c-${uid()}`, name],
    );
  }
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  return row!.id;
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("training_manager");
  partners = await staff("partnership_manager");
  teacher = await db.createUser(`prof.${uid()}@ecole.test`);
  quiet = await db.createUser(`calme.${uid()}@ecole.test`);
  outsider = await db.createUser(`autre.${uid()}@ecole.test`);
  employee = await db.createUser(`salarie.${uid()}@entreprise.test`);
  await db.as(quiet, (q) => q(`update public.profiles set email_notifications = false where id = auth.uid()`));
  school = await institution("École Actualités");
  otherSchool = await institution("Autre école");
  const company = await institution("Entreprise", "enterprise");
  await member(school, teacher);
  await member(school, quiet);
  await member(otherSchool, outsider);
  await member(company, employee);
  [{ id: category }] = await db.sql<{ id: string }>(`select id from public.news_categories where slug = 'formation-des-enseignants'`) as [{ id: string }];
});
afterAll(async () => db?.close());

describe("writing and publishing", () => {
  it("lets the editorial team write drafts, and only administrators publish", async () => {
    const draft = await write(manager, {}, false);
    await write(partners, {}, false);
    await expect(
      db.as(manager, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [draft.id])),
    ).rejects.toThrow(/news_publish_forbidden/);
    await db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [draft.id]));
    // Once published, the managers cannot change it any more.
    await expect(db.as(manager, (q) => q(`update public.news_articles set title = 'Modifié' where id = $1`, [draft.id]))).rejects.toThrow(/news_publish_forbidden/);
  });

  it("refuses everyone else", async () => {
    await expect(write(teacher, {}, false)).rejects.toThrow();
    await expect(db.as(teacher, (q) => q(`update public.news_categories set name = 'X'`))).resolves.toEqual([]);
    expect(await db.as(teacher, (q) => q(`select id from public.news_articles where status = 'draft'`))).toEqual([]);
  });

  it("checks an article is complete before publishing it", async () => {
    const bare = await write(admin, { category_id: null, excerpt: "", body: "" }, false);
    const publish = () => db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [bare.id]));
    await expect(publish()).rejects.toThrow(/news_category_required/);
    await db.as(admin, (q) => q(`update public.news_articles set category_id = $2 where id = $1`, [bare.id, category]));
    await expect(publish()).rejects.toThrow(/news_excerpt_required/);
    await db.as(admin, (q) => q(`update public.news_articles set excerpt = $2 where id = $1`, [bare.id, EXCERPT]));
    await expect(publish()).rejects.toThrow(/news_body_required/);
    await db.as(admin, (q) => q(`update public.news_articles set body = $2, visibility = 'institutions' where id = $1`, [bare.id, BODY]));
    await expect(publish()).rejects.toThrow(/news_audience_required/);
    await db.as(admin, (q) => q(`insert into public.news_article_institutions (article_id, institution_id) values ($1, $2)`, [bare.id, school]));
    await publish();
    const [row] = await db.sql<{ published_at: string | null }>(`select published_at from public.news_articles where id = $1`, [bare.id]);
    expect(row!.published_at).not.toBeNull();
  });

  it("keeps slugs unique", async () => {
    const a = await write(admin, {}, false);
    await expect(write(admin, { slug: a.slug }, false)).rejects.toThrow(/duplicate|unique/);
  });

  it("keeps the e-mail marker out of the editors' hands", async () => {
    const a = await write(admin);
    await db.as(admin, (q) => q(`update public.news_articles set notified_at = now() where id = $1`, [a.id]));
    const [row] = await db.sql<{ notified_at: string | null }>(`select notified_at from public.news_articles where id = $1`, [a.id]);
    expect(row!.notified_at).toBeNull();
  });
});

describe("who reads what", () => {
  let pub: string;
  let members: string;
  let schoolOnly: string;
  let draft: string;
  let scheduled: string;

  beforeAll(async () => {
    pub = (await write(admin, { title: "Public" })).slug;
    members = (await write(admin, { title: "Membres", visibility: "members" })).slug;
    const s = await write(admin, { title: "École", visibility: "institutions" }, false);
    await db.as(admin, (q) => q(`insert into public.news_article_institutions (article_id, institution_id) values ($1, $2)`, [s.id, school]));
    await db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [s.id]));
    schoolOnly = s.slug;
    draft = (await write(admin, { title: "Brouillon" }, false)).slug;
    scheduled = (await write(admin, { title: "Programmé", published_at: new Date(Date.now() + 3600_000).toISOString() })).slug;
  });

  it("shows anonymous visitors public articles only — never drafts or scheduled ones", async () => {
    const seen = await slugs(null, { size: 48 });
    expect(seen).toContain(pub);
    for (const s of [members, schoolOnly, draft, scheduled]) expect(seen).not.toContain(s);
    expect(await article(null, members)).toBeNull();
    expect(await article(null, draft)).toBeNull();
    expect(await article(null, draft, true)).toBeNull();
    expect(await article(null, pub)).toMatchObject({ slug: pub, title: "Public" });
  });

  it("shows members' articles to signed-in members, institution articles to their members only", async () => {
    const t = await slugs(teacher, { size: 48 });
    expect(t).toEqual(expect.arrayContaining([pub, members, schoolOnly]));
    const o = await slugs(outsider, { size: 48 });
    expect(o).toContain(members);
    expect(o).not.toContain(schoolOnly);
    expect(await article(outsider, schoolOnly)).toBeNull();
  });

  it("keeps company-only users out of members' articles", async () => {
    const e = await slugs(employee, { size: 48 });
    expect(e).toContain(pub);
    expect(e).not.toContain(members);
  });

  it("publishes a scheduled article when its time comes", async () => {
    expect(await slugs(null, { size: 48 })).not.toContain(scheduled);
    await db.ageRows("public.news_articles", "published_at", "slug = $1", 7200, [scheduled]);
    expect(await slugs(null, { size: 48 })).toContain(scheduled);
  });

  it("lets the editorial team preview drafts, nobody else", async () => {
    expect(await article(manager, draft, true)).toMatchObject({ slug: draft, status: "draft" });
    expect(await article(teacher, draft, true)).toBeNull();
    expect(await article(admin, draft, false)).toBeNull();
  });
});

describe("discovery", () => {
  it("combines search and category, and pages without duplicates or gaps", async () => {
    const [{ id: events }] = await db.sql<{ id: string }>(`select id from public.news_categories where slug = 'evenements-et-webinaires'`) as [{ id: string }];
    const tag = `webinaire${uid()}`;
    for (let i = 0; i < 5; i++) await write(admin, { title: `Rencontre ${tag} numéro ${i}`, category_id: events });
    await write(admin, { title: `Annonce ${tag} hors catégorie` });
    const all = await feed(null, { q: tag, size: 48 });
    expect(all).toHaveLength(6);
    const inCategory = await feed(null, { q: tag, category: "evenements-et-webinaires", size: 48 });
    expect(inCategory).toHaveLength(5);
    expect(Number(inCategory[0]!.total_count)).toBe(5);
    const pages = [...(await feed(null, { q: tag, category: "evenements-et-webinaires", page: 1, size: 2 })), ...(await feed(null, { q: tag, category: "evenements-et-webinaires", page: 2, size: 2 })), ...(await feed(null, { q: tag, category: "evenements-et-webinaires", page: 3, size: 2 }))];
    expect(new Set(pages.map((p) => p.id)).size).toBe(5);
    expect(pages.map((p) => p.id).sort()).toEqual(inCategory.map((p) => p.id).sort());
  });

  it("finds words without their accents", async () => {
    const a = await write(admin, { title: `Évaluation différenciée ${uid()}` });
    expect(await slugs(null, { q: "evaluation differenciee", size: 48 })).toContain(a.slug);
  });

  it("links existing courses, leaving out unpublished ones", async () => {
    const published = (await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false] }] }] }, { title: "Formation publique" })).courseId;
    await db.sql(`update public.courses set public_listing = true where id = $1`, [published]);
    const hidden = (await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false] }] }] }, { title: "Formation en brouillon", publish: false })).courseId;
    const a = await write(admin, {}, false);
    await db.as(admin, (q) => q(`insert into public.news_article_courses (article_id, course_id, position) values ($1, $2, 0), ($1, $3, 1)`, [a.id, published, hidden]));
    await db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [a.id]));
    const seen = (await article(null, a.slug)) as { courses: Array<{ id: string; title: string; public: boolean }> };
    expect(seen.courses).toEqual([expect.objectContaining({ id: published, title: "Formation publique", public: true })]);
  });
});

describe("e-mail and statistics", () => {
  const outbox = (dedupe: string) => db.sql<{ user_id: string }>(`select user_id from public.notification_outbox where kind = 'news_published' and dedupe_key like $1`, [dedupe]);

  it("e-mails school members once, respecting their preference", async () => {
    const a = await write(admin, { notify_email: true, visibility: "members" });
    expect(await db.rpcError(manager, "queue_news_emails", [a.id])).toMatch(/forbidden/);
    await db.rpc(admin, "queue_news_emails", [a.id]);
    await db.rpc(admin, "queue_news_emails", [a.id]);
    const to = (await outbox(`news:${a.id}:%`)).map((r) => r.user_id);
    expect(to).toEqual(expect.arrayContaining([teacher, outsider]));
    expect(to).not.toContain(quiet);
    expect(to).not.toContain(employee);
    expect(to).toHaveLength(new Set(to).size);
  });

  it("e-mails an institution article to that institution only", async () => {
    const a = await write(admin, { notify_email: true, visibility: "institutions" }, false);
    await db.as(admin, (q) => q(`insert into public.news_article_institutions (article_id, institution_id) values ($1, $2)`, [a.id, school]));
    await db.as(admin, (q) => q(`update public.news_articles set status = 'published' where id = $1`, [a.id]));
    await db.rpc(admin, "queue_news_emails", [a.id]);
    const to = (await outbox(`news:${a.id}:%`)).map((r) => r.user_id);
    expect(to).toEqual([teacher]);
  });

  it("waits for a scheduled article, then the daily job sends it", async () => {
    const a = await write(admin, { notify_email: true, published_at: new Date(Date.now() + 3600_000).toISOString() });
    expect(await db.rpc(null, "queue_due_news_emails", [], "service_role")).toBe(0);
    await db.ageRows("public.news_articles", "published_at", "id = $1", 7200, [a.id]);
    expect(await db.rpc(null, "queue_due_news_emails", [], "service_role")).toBeGreaterThan(0);
    expect(await outbox(`news:${a.id}:%`)).not.toEqual([]);
  });

  it("counts views and clicks per day, from the server only", async () => {
    const a = await write(admin);
    expect(await db.rpcError(teacher, "record_news_event", [a.slug, "view"])).toMatch(/permission denied/);
    for (const kind of ["view", "view", "course", "event", "nonsense"]) await db.rpc(null, "record_news_event", [a.slug, kind], "service_role");
    const draft = await write(admin, {}, false);
    await db.rpc(null, "record_news_event", [draft.slug, "view"], "service_role");
    const rows = await db.sql<{ article_id: string; views: number; course_clicks: number; event_clicks: number }>(`select * from public.news_daily_stats where article_id in ($1, $2)`, [a.id, draft.id]);
    expect(rows).toEqual([expect.objectContaining({ article_id: a.id, views: 2, course_clicks: 1, event_clicks: 1 })]);
    expect(await db.as(teacher, (q) => q(`select * from public.news_daily_stats`))).toEqual([]);
  });
});
