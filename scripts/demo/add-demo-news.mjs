#!/usr/bin/env node
/**
 * Fills the « Actualités » page with demonstration articles.
 *
 *   npm run demo:news
 *
 * Eight articles signed « Démonstration SANADY » (removed by demo:remove):
 * one « À la une », one event, one for signed-in members only, one
 * scheduled for later, three linked to the demo courses. They contain
 * general teaching advice and explanations of the platform only — no fact
 * about the Foundation, no real event, no testimonial.
 * Covers: a photo from public/brand/photos (the site's own photos, cropped to
 * 16:9), or a cover generated in the brand colours when none is set. Safe to
 * re-run: existing articles are kept and only get their photo refreshed.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ref || !token || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ACCESS_TOKEN are required.");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : [];
}
const lit = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

export const DEMO_AUTHOR = "Démonstration SANADY";
const DEMO_NOTE = "*Article de démonstration : il sera retiré avant le lancement de la plateforme.*";

const ARTICLES = [
  {
    slug: "demo-bienvenue-sur-la-page-actualites",
    photo: { file: "enseignants-formation.jpg", alt: "Enseignantes et enseignants réunis à l’issue d’une formation" },
    category: "actualites-institutionnelles",
    daysAgo: 10,
    featured: true,
    cover: { bg: "#1C1917", fg: "#FFFFFF", accent: "#F95A05", shape: "circles" },
    title: "Bienvenue sur la page Actualités de SANADY",
    subtitle: "Formations, événements, ressources : tout ce qui bouge sur la plateforme, au même endroit.",
    excerpt: "Cette page rassemble les annonces de la plateforme : nouvelles formations, webinaires et ateliers, ressources pédagogiques et informations importantes.",
    body: [
      "## Ce que vous trouverez ici",
      "La page Actualités rassemble les informations utiles aux enseignants et aux établissements qui utilisent SANADY.",
      "",
      "- **Nouvelles formations** : présentation des parcours ajoutés au catalogue, avec un lien direct vers chacun.",
      "- **Événements et webinaires** : date, format (en ligne ou sur place) et lien d’inscription quand il y en a un.",
      "- **Ressources pédagogiques** : idées et outils à utiliser en classe.",
      "- **Annonces importantes** : informations sur le fonctionnement de la plateforme.",
      "",
      "## Trouver un article",
      "Utilisez la recherche en haut de page ou choisissez une catégorie. La recherche ignore les accents : « evaluation » trouve aussi « évaluation ».",
      "",
      "## Certains articles sont réservés",
      "Quelques articles ne s’adressent qu’aux membres connectés ou aux membres de certains établissements. Ils apparaissent automatiquement quand vous êtes connecté à votre espace.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-decouvrir-la-formation-evaluation-formative",
    photo: { file: "atelier-enseignants.jpg", alt: "Enseignants en atelier de formation dans une salle de classe" },
    category: "formation-des-enseignants",
    daysAgo: 8,
    cover: { bg: "#F95A05", fg: "#FFFFFF", accent: "#1C1917", shape: "checks" },
    title: "Découvrir la formation « Évaluation formative en classe »",
    excerpt: "Un parcours court pour faire de l’évaluation un outil d’apprentissage : objectifs clairs, critères de réussite partagés et retours utiles aux élèves.",
    courses: ["Évaluation formative en classe"],
    body: [
      "## Évaluer pour faire progresser",
      "L’évaluation formative a lieu **pendant** l’apprentissage. Elle sert à savoir où en sont les élèves pour ajuster l’enseignement, et à leur donner des repères pour progresser.",
      "",
      "## Ce que propose le parcours",
      "1. Distinguer évaluation formative et évaluation sommative.",
      "2. Clarifier les objectifs et les critères de réussite avec les élèves.",
      "3. Donner des retours qui aident à avancer.",
      "",
      "> Une évaluation est formative quand ses résultats servent à décider de la suite de l’apprentissage.",
      "",
      "Chaque module se termine par une évaluation : avec 70 % de réussite, le module est validé. À la fin du parcours, un certificat vérifiable en ligne est délivré.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-webinaire-differencier-son-enseignement",
    photo: { file: "session-formation.jpg", alt: "Salle de formation : une intervenante présente devant un écran" },
    category: "evenements-et-webinaires",
    daysAgo: 5,
    cover: { bg: "#FFF4ED", fg: "#1C1917", accent: "#C94400", shape: "grid" },
    title: "Exemple d’événement : webinaire « Différencier son enseignement »",
    excerpt: "Un exemple de la façon dont un événement est annoncé : date et heure, format en ligne, et formation liée pour aller plus loin.",
    event: { inDays: 14, hour: 15, minutes: 90, online: true, location: "Visioconférence" },
    courses: ["Différencier son enseignement"],
    body: [
      "## Un exemple d’annonce d’événement",
      "Quand un article annonce un webinaire, un atelier ou une conférence, une carte « Événement » affiche la date, l’heure (heure du Maroc) et le format. Un bouton « S’inscrire » apparaît lorsqu’un lien d’inscription est indiqué.",
      "",
      "## Le thème : différencier",
      "Différencier, c’est proposer plusieurs chemins vers un même objectif, pour que chaque élève progresse à partir de là où il en est.",
      "",
      "- Varier les supports : texte, image, manipulation.",
      "- Proposer des aides graduées plutôt qu’une seule consigne.",
      "- Organiser des groupes de besoin temporaires.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-cinq-idees-pour-demarrer-une-seance",
    photo: { file: "visite-bibliotheque.jpg", alt: "Visite d’une bibliothèque scolaire garnie de livres" },
    category: "ressources-pedagogiques",
    daysAgo: 12,
    cover: { bg: "#3A3531", fg: "#FFFFFF", accent: "#FD7A38", shape: "checks" },
    title: "Cinq idées pour bien démarrer une séance",
    excerpt: "Les premières minutes d’un cours donnent le ton. Cinq rituels simples pour capter l’attention et activer ce que les élèves savent déjà.",
    body: [
      "## Pourquoi soigner le début de séance",
      "Les premières minutes installent l’attention et relient la séance à ce qui a été appris avant. Quelques rituels courts suffisent.",
      "",
      "1. **La question du jour** : une question ouverte au tableau, en lien avec la notion.",
      "2. **Le rappel en trois points** : les élèves écrivent trois choses retenues de la séance précédente.",
      "3. **L’objectif annoncé** : ce que l’on saura faire à la fin de l’heure, formulé simplement.",
      "4. **Le défi rapide** : un petit problème à résoudre en deux minutes, seul ou à deux.",
      "5. **L’image mystère** : une image à décrire et à relier au thème.",
      "",
      "> Un bon démarrage relie ce que les élèves savent déjà à ce qu’ils vont apprendre.",
      "",
      "Retrouvez d’autres outils dans la [bibliothèque pédagogique](/espace/bibliotheque) de votre espace.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-le-numerique-trois-usages-simples",
    photo: { file: "atelier-numerique.jpg", alt: "Enseignants travaillant sur des ordinateurs portables" },
    category: "innovation-pedagogique",
    daysAgo: 15,
    cover: { bg: "#7A2E05", fg: "#FFFFFF", accent: "#FDBA8C", shape: "grid" },
    title: "Le numérique en classe : trois usages simples",
    excerpt: "Pas besoin d’équipement complexe : trois usages du numérique qui servent directement l’apprentissage, avec leurs points de vigilance.",
    courses: ["Numérique éducatif responsable"],
    body: [
      "## Partir de l’objectif, pas de l’outil",
      "Un outil numérique est utile quand il sert un objectif d’apprentissage précis. Voici trois usages faciles à mettre en place.",
      "",
      "### 1. Projeter pour observer ensemble",
      "Une image, un document ou une production d’élève projetés permettent d’analyser collectivement.",
      "",
      "### 2. Recueillir les réponses de toute la classe",
      "Un questionnaire rapide donne une vue d’ensemble des réponses et aide à repérer les erreurs fréquentes.",
      "",
      "### 3. Garder une trace",
      "Photographier un tableau ou une production permet d’y revenir à la séance suivante.",
      "",
      "**Vigilance** : protéger les données des élèves et limiter le temps d’écran aux moments utiles.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-membres-suivre-sa-progression",
    photo: { file: "accompagnement-eleve.jpg", alt: "Un enseignant accompagne un élève à son bureau" },
    category: "formation-des-enseignants",
    daysAgo: 3,
    visibility: "members",
    cover: { bg: "#1C1917", fg: "#FFFFFF", accent: "#FDBA8C", shape: "checks" },
    title: "Réservé aux membres : suivre sa progression dans son espace",
    excerpt: "Un exemple d’article réservé aux personnes connectées : où retrouver ses formations, ses évaluations et ses certificats.",
    body: [
      "## Votre tableau de bord",
      "La page d’accueil de votre espace indique la prochaine étape de chaque formation et votre activité récente.",
      "",
      "- **Mes formations** : la progression de chaque parcours, leçon par leçon.",
      "- **Mes évaluations** : vos résultats et le nombre de tentatives utilisées.",
      "- **Mes certificats** : les certificats obtenus, vérifiables en ligne par QR code.",
      "",
      "Cet article n’apparaît que pour les personnes connectées : c’est un exemple d’article à public restreint.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-exemple-d-annonce-importante",
    photo: { file: "forum-intervenants.jpg", alt: "Intervenants assis à une table lors d’une rencontre" },
    category: "annonces-importantes",
    daysAgo: 1,
    cover: { bg: "#F95A05", fg: "#FFFFFF", accent: "#FFF4ED", shape: "circles" },
    title: "Exemple d’annonce importante",
    excerpt: "Les annonces importantes informent sur le fonctionnement de la plateforme : nouveautés, interruptions prévues ou changements de calendrier.",
    body: [
      "## À quoi servent les annonces importantes",
      "Elles signalent ce qui concerne tous les utilisateurs : une nouvelle fonctionnalité, une interruption de service prévue, un changement de calendrier.",
      "",
      "Lors de la publication, l’équipe peut choisir de **prévenir le public par e-mail**. Chacun peut désactiver ces e-mails dans son profil.",
      "",
      DEMO_NOTE,
    ],
  },
  {
    slug: "demo-article-programme-pour-plus-tard",
    photo: { file: "classe-primaire.jpg", alt: "Élèves dans une salle de classe de primaire" },
    category: "nouveaux-programmes",
    daysAgo: -3,
    cover: { bg: "#3A3531", fg: "#FFFFFF", accent: "#F95A05", shape: "grid" },
    title: "Exemple d’article programmé",
    excerpt: "Cet article est programmé : il apparaîtra automatiquement à sa date de publication, sans intervention.",
    body: [
      "## Une publication programmée",
      "L’équipe peut préparer un article à l’avance et choisir sa date et son heure de publication. Il reste invisible jusque-là, puis apparaît automatiquement.",
      "",
      DEMO_NOTE,
    ],
  },
];

/* ─── Branded covers (same style as the demo course covers) ──────────── */
const W = 1600;
const H = 900;
const FONT = "Segoe UI, Arial, sans-serif";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
function decoration(shape, accent) {
  if (shape === "checks") {
    return [0, 1, 2]
      .map((i) => {
        const y = 200 + i * 180;
        return `<rect x="1100" y="${y}" width="380" height="120" rx="26" fill="#fff" fill-opacity="${0.16 - i * 0.03}"/>
          <circle cx="1166" cy="${y + 60}" r="28" fill="${accent}" fill-opacity="${0.9 - i * 0.25}"/>
          <path d="M1152 ${y + 60} l11 11 l20 -22" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="1220" y="${y + 46}" width="${200 - i * 36}" height="28" rx="14" fill="#fff" fill-opacity="0.55"/>`;
      })
      .join("");
  }
  if (shape === "circles") {
    return `<circle cx="1360" cy="300" r="280" fill="none" stroke="${accent}" stroke-width="52" stroke-opacity="0.9"/>
      <circle cx="1360" cy="300" r="150" fill="${accent}" fill-opacity="0.18"/>
      <circle cx="1160" cy="700" r="86" fill="#fff" fill-opacity="0.08"/>`;
  }
  const cells = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      cells.push(`<rect x="${1080 + c * 112}" y="${160 + r * 112}" width="88" height="88" rx="18" fill="${(r + c) % 3 === 0 ? accent : "#fff"}" fill-opacity="${(r + c) % 3 === 0 ? 0.85 : 0.1}"/>`);
  return cells.join("");
}
async function render({ bg, fg, accent, shape }, title, category) {
  const lines = wrap(title, 24).slice(0, 4);
  const top = 450 - (lines.length * 86) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    ${decoration(shape, accent)}
    <rect x="110" y="${top - 84}" width="76" height="10" rx="5" fill="${accent}"/>
    <text x="110" y="${top - 32}" font-family="${FONT}" font-size="30" font-weight="600" letter-spacing="3" fill="${fg}" fill-opacity="0.85">${esc(category.toUpperCase())}</text>
    ${lines.map((l, i) => `<text x="110" y="${top + 56 + i * 86}" font-family="${FONT}" font-size="72" font-weight="800" fill="${fg}">${esc(l)}</text>`).join("")}
    <text x="110" y="${H - 80}" font-family="${FONT}" font-size="28" font-weight="600" fill="${fg}" fill-opacity="0.8">Actualités SANADY · démonstration</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

/* ─── Insert ─────────────────────────────────────────────────────────── */
const storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
const categories = Object.fromEntries((await sql(`select id, slug, name from public.news_categories`)).map((c) => [c.slug, c]));
const existing = new Set((await sql(`select slug from public.news_articles where slug like 'demo-%'`)).map((r) => r.slug));

/** A distinct file per kind of cover, so a cached old cover is never shown instead. */
const coverPath = (id, a) => `${id}/${a.photo ? "photo-demo" : "couverture-demo"}.jpg`;

/** Cover of an article: its photo cropped to 16:9, or a generated cover. */
async function coverFor(a, categoryName) {
  if (!a.photo) return { image: await render(a.cover, a.title, categoryName), alt: `Visuel de l’article « ${a.title} »` };
  const image = await sharp(await readFile(new URL(`../../public/brand/photos/${a.photo.file}`, import.meta.url)))
    .resize(W, H, { fit: "cover", position: "attention" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  return { image, alt: a.photo.alt };
}

for (const a of ARTICLES) {
  if (existing.has(a.slug)) {
    const [row] = await sql(`select id from public.news_articles where slug = ${lit(a.slug)} and author_label = ${lit(DEMO_AUTHOR)}`);
    if (row && a.photo) {
      const { image, alt } = await coverFor(a, categories[a.category]?.name ?? "");
      const path = coverPath(row.id, a);
      const { error } = await storage.from("news-images").upload(path, image, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      await sql(`update public.news_articles set cover_path = ${lit(path)}, cover_alt = ${lit(alt)} where id = ${lit(row.id)}`);
      await storage.from("news-images").remove([`${row.id}/couverture-demo.jpg`]);
      console.log(`↻ ${a.title}: photo updated`);
    } else console.log(`• ${a.title}: already there, skipped`);
    continue;
  }
  const category = categories[a.category];
  if (!category) throw new Error(`Unknown category ${a.category}`);
  const published = `now() - interval '${a.daysAgo} days' - interval '${(a.slug.length % 9) + 1} hours'`;
  // Event: day + hour in Moroccan time (UTC+1 outside Ramadan).
  const event = a.event
    ? {
        starts: `date_trunc('day', now() + interval '${a.event.inDays} days') + interval '${a.event.hour - 1} hours'`,
        ends: `date_trunc('day', now() + interval '${a.event.inDays} days') + interval '${a.event.hour - 1} hours' + interval '${a.event.minutes} minutes'`,
      }
    : null;
  const [row] = await sql(`
    insert into public.news_articles (slug, title, subtitle, excerpt, body, category_id, author_label, visibility, status, published_at, featured,
                                      event_starts_at, event_ends_at, event_online, event_location)
    values (${lit(a.slug)}, ${lit(a.title)}, ${lit(a.subtitle ?? null)}, ${lit(a.excerpt)}, ${lit(a.body.join("\n"))}, ${lit(category.id)},
            ${lit(DEMO_AUTHOR)}, ${lit(a.visibility ?? "public")}, 'published', ${published}, ${a.featured ? "true" : "false"},
            ${event ? event.starts : "null"}, ${event ? event.ends : "null"}, ${a.event?.online ? "true" : "false"}, ${lit(a.event?.location ?? null)})
    returning id`);
  if (a.courses?.length) {
    await sql(`
      insert into public.news_article_courses (article_id, course_id, position)
      select ${lit(row.id)}, c.id, row_number() over (order by c.title) - 1
        from public.courses c where c.title in (${a.courses.map(lit).join(",")}) and c.status = 'published'
      on conflict do nothing`);
  }
  const path = coverPath(row.id, a);
  const { image, alt } = await coverFor(a, category.name);
  const { error } = await storage.from("news-images").upload(path, image, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  await sql(`update public.news_articles set cover_path = ${lit(path)}, cover_alt = ${lit(alt)} where id = ${lit(row.id)}`);
  console.log(`✓ ${a.title}${a.visibility === "members" ? " (membres)" : ""}${a.daysAgo < 0 ? " (programmé)" : ""}`);
}
console.log("Remove with: npm run demo:remove");
