/**
 * Article body format (« Actualités »): plain text with a few marks, parsed
 * into a tree that the interface renders as React elements. There is no HTML
 * anywhere — whatever is typed is shown as text — so an article can never
 * inject markup or scripts (no stored XSS by construction).
 *
 *   ## Titre de section          ### Sous-titre
 *   **gras**   *italique*   [texte du lien](https://… ou /chemin)
 *   - élément de liste           1. élément numéroté
 *   > citation                   ---  (séparateur)
 *   ![texte alternatif](image-téléversée.jpg "légende facultative")
 *   @video(https://www.youtube.com/watch?v=…)
 *
 * Blocks are separated by a blank line (lists and quotes continue line by line).
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; external: boolean; c: Inline[] };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h2" | "h3"; c: Inline[]; id: string }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; lines: Inline[][] }
  | { t: "image"; path: string; alt: string; caption: string }
  | { t: "video"; url: string; label: string }
  | { t: "hr" };

/** Storage path of an uploaded image (bucket news-images): « <article>/<file> ». */
export const IMAGE_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,200}$/;

/** Links allowed in an article: https, http, mailto and site-relative paths. */
export function safeHref(raw: string): { href: string; external: boolean } | null {
  const href = raw.trim();
  if (/^\/(?!\/)[^\s]*$/.test(href)) return { href, external: false };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return { href, external: true };
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { href: url.toString(), external: true };
  } catch {
    return null;
  }
}

const VIDEO_HOSTS: Record<string, string> = {
  "www.youtube.com": "YouTube",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "vimeo.com": "Vimeo",
  "player.vimeo.com": "Vimeo",
};

/** Accepted video link (YouTube or Vimeo, https), shown as a link card — never embedded. */
export function videoLink(raw: string): { url: string; label: string } | null {
  try {
    const url = new URL(raw.trim());
    const label = VIDEO_HOSTS[url.hostname];
    if (url.protocol !== "https:" || !label) return null;
    return { url: url.toString(), label };
  } catch {
    return null;
  }
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const rest = source.slice(i);
    if (ch === "\\" && i + 1 < source.length && /[\\*_[\]()#>!@`-]/.test(source[i + 1]!)) {
      text += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === "[") {
      const m = /^\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/.exec(rest);
      if (m) {
        const target = safeHref(m[2]!);
        flush();
        if (target) out.push({ t: "link", ...target, c: parseInline(m[1]!) });
        else out.push(...parseInline(m[1]!));
        i += m[0].length;
        continue;
      }
    }
    if (rest.startsWith("**")) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if ((ch === "*" || ch === "_") && source[i + 1] && source[i + 1] !== " ") {
      const end = source.indexOf(ch, i + 1);
      // `_` inside words (snake_case, file names) stays text.
      const wordInside = ch === "_" && /\w/.test(source[i - 1] ?? "");
      if (end > i + 1 && source[end - 1] !== " " && !wordInside) {
        flush();
        out.push({ t: "em", c: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    text += ch;
    i++;
  }
  flush();
  // Merge neighbouring text pieces (e.g. around a refused link).
  return out.reduce<Inline[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (n.t === "text" && last?.t === "text") last.v += n.v;
    else acc.push(n);
    return acc;
  }, []);
}

/** Plain text of inline content (heading anchors, previews). */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.t === "text" ? n.v : inlineText(n.c))).join("");
}

function anchor(text: string, used: Set<string>) {
  const base =
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

export function parseArticle(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const ids = new Set<string>();
  let para: string[] = [];
  const endPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      endPara();
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      endPara();
      const c = parseInline(heading[2]!.trim());
      blocks.push({ t: heading[1]!.length === 2 ? "h2" : "h3", c, id: anchor(inlineText(c), ids) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      endPara();
      blocks.push({ t: "hr" });
      continue;
    }
    const image = /^!\[([^\]\n]*)\]\(([^\s)]+)(?:\s+"([^"\n]*)")?\)$/.exec(trimmed);
    if (image) {
      endPara();
      // Only images uploaded with the article (no outside image, no tracking pixel).
      if (IMAGE_PATH.test(image[2]!)) blocks.push({ t: "image", path: image[2]!, alt: image[1]!.trim(), caption: (image[3] ?? "").trim() });
      continue;
    }
    const video = /^@video\(([^)\s]+)\)$/.exec(trimmed);
    if (video) {
      endPara();
      const v = videoLink(video[1]!);
      if (v) blocks.push({ t: "video", ...v });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    const numbered = /^\d{1,3}[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || numbered) {
      endPara();
      const kind = bullet ? "ul" : "ol";
      const pattern = kind === "ul" ? /^[-*]\s+(.+)$/ : /^\d{1,3}[.)]\s+(.+)$/;
      const items: Inline[][] = [];
      for (; i < lines.length; i++) {
        const m = pattern.exec(lines[i]!.trim());
        if (!m) break;
        items.push(parseInline(m[1]!));
      }
      i--;
      blocks.push({ t: kind, items });
      continue;
    }
    if (trimmed.startsWith(">")) {
      endPara();
      const quoted: Inline[][] = [];
      for (; i < lines.length && lines[i]!.trim().startsWith(">"); i++) {
        const content = lines[i]!.trim().replace(/^>\s?/, "");
        if (content) quoted.push(parseInline(content));
      }
      i--;
      if (quoted.length) blocks.push({ t: "quote", lines: quoted });
      continue;
    }
    para.push(trimmed);
  }
  endPara();
  return blocks;
}

/** Image paths used in a body (to keep uploaded images that are still referenced). */
export function bodyImages(source: string): string[] {
  return parseArticle(source).flatMap((b) => (b.t === "image" ? [b.path] : []));
}
