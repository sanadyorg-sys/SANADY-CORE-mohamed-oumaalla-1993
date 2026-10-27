/**
 * Adds two records in intermediate states for the process guide, on top of
 * add-demo-organizations.mjs:
 *   · a convention with Institut Al Maarifa (démo) waiting for approval (internal review),
 *   · a second report for Fondation Horizon Éducation (démo), still a draft.
 * Both belong to demo organisations, so `npm run demo:remove` deletes them too.
 * Run: npm run demo:process
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env.local.");
  process.exit(1);
}

async function sql(query, attempt = 0) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  // The management API limits the request rate: wait and retry.
  if (res.status === 429 && attempt < 8) {
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    return sql(query, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const json = (o) => `${lit(JSON.stringify(o))}::jsonb`;

/** Calls public.<fn>(args) as a user with a two-factor session, so every permission check applies. */
async function call(who, fn, args = []) {
  const head = `set local role authenticated;
    select set_config('request.jwt.claim.sub', ${lit(who)}, true);
    select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: who, role: "authenticated", aal: "aal2" }))}, true);`;
  const rows = await sql(`begin; ${head} select public.${fn}(${args.join(", ")}) as v; reset role; commit;`);
  return rows[0]?.v;
}
const one = async (q) => (await sql(q))[0]?.id;

const coord = await one(`select id from public.profiles where email = 'demo.partenariats@example.com'`);
const maarifa = await one(`select id from public.partner_organizations where name = 'Institut Al Maarifa (démo)'`);
const horizon = await one(`select id from public.partner_organizations where name = 'Fondation Horizon Éducation (démo)'`);
const horizonAgreement = await one(`select id from public.partnership_agreements where title = 'Convention de soutien scolaire 2026-2027 (démo)'`);
if (!coord || !maarifa || !horizon || !horizonAgreement) {
  console.error("Run `npm run demo:organizations` first.");
  process.exit(1);
}

const title = "Convention orientation et bourses 2027 (démo)";
if (await one(`select id from public.partnership_agreements where title = ${lit(title)}`)) {
  console.log("Already loaded.");
  process.exit(0);
}
const agreement = await call(coord, "save_partnership_agreement", [
  "null",
  lit(maarifa),
  json({
    title,
    intervention_field: "orientation",
    objectives: "Accompagner 120 lycéens dans leur orientation après le baccalauréat et faire connaître les bourses d’études disponibles.",
    responsibilities: "La Fondation organise les ateliers dans les lycées. L’institut fournit des intervenants et présente ses filières et ses bourses.",
    contributions_summary: "60 heures d’expertise en orientation, 10 bourses d’études partielles.",
    start_on: "2027-01-15",
    end_on: "2027-07-15",
    renewal_terms: "Reconduction possible après bilan.",
    renewal_notice_days: "30",
    opportunity_id: null,
  }),
]);
await call(coord, "set_agreement_status", [lit(agreement), lit("internal_review"), json({})]);
console.log("✓ Convention in internal review:", agreement);

const report = await call(coord, "save_partner_report", [
  "null",
  lit(horizon),
  json({
    agreement_id: horizonAgreement,
    title: "Rapport du premier trimestre · octobre-décembre 2026 (démo)",
    period_start: "2026-10-01",
    period_end: "2026-12-31",
    activities: "Séances de soutien hebdomadaires dans les six collèges, premier atelier pour les enseignants.",
    challenges: "À compléter à la fin du trimestre.",
    future_opportunities: "À compléter à la fin du trimestre.",
  }),
]);
console.log("✓ Draft report:", report);
