import { describe, expect, it } from "vitest";
import { bodyImages, parseArticle, parseInline, safeHref, videoLink } from "@/lib/news-markup";
import { formatEventWhen, newsDisplayStatus, slugify } from "@/lib/news";

const IMG = "0b5e9a52-3c1f-4f7e-9a51-2a7f1d4c8e10/photo-atelier.jpg";

describe("article markup", () => {
  it("parses headings, paragraphs, lists, quotes, separators, images and videos", () => {
    const blocks = parseArticle(
      [
        "## Une formation pour la rentrée",
        "Première ligne",
        "suite du paragraphe.",
        "",
        "- un",
        "- deux",
        "",
        "1. premier",
        "2) second",
        "",
        "> Une citation",
        "> sur deux lignes",
        "---",
        `![Atelier en classe](${IMG} "Atelier à Agadir")`,
        "@video(https://www.youtube.com/watch?v=abc123)",
        "### Une formation pour la rentrée",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.t)).toEqual(["h2", "p", "ul", "ol", "quote", "hr", "image", "video", "h3"]);
    expect(blocks[0]).toMatchObject({ id: "une-formation-pour-la-rentree" });
    expect(blocks[8]).toMatchObject({ id: "une-formation-pour-la-rentree-2" });
    expect(blocks[1]).toEqual({ t: "p", c: [{ t: "text", v: "Première ligne suite du paragraphe." }] });
    expect(blocks[2]).toMatchObject({ t: "ul", items: [[{ v: "un" }], [{ v: "deux" }]] });
    expect(blocks[3]).toMatchObject({ t: "ol", items: [[{ v: "premier" }], [{ v: "second" }]] });
    expect(blocks[4]).toMatchObject({ t: "quote", lines: [[{ v: "Une citation" }], [{ v: "sur deux lignes" }]] });
    expect(blocks[6]).toEqual({ t: "image", path: IMG, alt: "Atelier en classe", caption: "Atelier à Agadir" });
    expect(blocks[7]).toEqual({ t: "video", url: "https://www.youtube.com/watch?v=abc123", label: "YouTube" });
  });

  it("parses bold, italic and links, nested", () => {
    expect(parseInline("Lire **le [guide](/ressources)** *maintenant*")).toEqual([
      { t: "text", v: "Lire " },
      { t: "strong", c: [{ t: "text", v: "le " }, { t: "link", href: "/ressources", external: false, c: [{ t: "text", v: "guide" }] }] },
      { t: "text", v: " " },
      { t: "em", c: [{ t: "text", v: "maintenant" }] },
    ]);
    expect(parseInline("fichier_nom_long et 3 * 4 = 12")).toEqual([{ t: "text", v: "fichier_nom_long et 3 * 4 = 12" }]);
    expect(parseInline("\\*pas en italique\\*")).toEqual([{ t: "text", v: "*pas en italique*" }]);
  });

  it("keeps HTML as text and drops unsafe links, images and videos", () => {
    const blocks = parseArticle(
      [
        '<script>alert("x")</script><img src=x onerror=alert(1)>',
        "",
        "[cliquez](javascript:alert(1)) [ici](data:text/html,x) [là](//evil.example)",
        "",
        "![pixel](https://tracker.example/p.gif)",
        "@video(https://evil.example/v)",
        "@video(http://www.youtube.com/watch?v=x)",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      { t: "p", c: [{ t: "text", v: '<script>alert("x")</script><img src=x onerror=alert(1)>' }] },
      { t: "p", c: [{ t: "text", v: "cliquez ici là" }] },
    ]);
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHref("mailto:contact@exemple.ma")).toEqual({ href: "mailto:contact@exemple.ma", external: true });
    expect(safeHref("https://exemple.ma/a b")).toEqual({ href: "https://exemple.ma/a%20b", external: true });
    expect(safeHref("ftp://exemple.ma/f")).toBeNull();
    expect(videoLink("https://vimeo.com/123")).toEqual({ url: "https://vimeo.com/123", label: "Vimeo" });
  });

  it("lists the uploaded images a body uses", () => {
    expect(bodyImages(`Texte\n\n![a](${IMG})\n![b](autre/chemin.jpg)`)).toEqual([IMG]);
  });
});

describe("news helpers", () => {
  it("makes stable, readable slugs", () => {
    expect(slugify("Lancement : « Évaluer pour faire apprendre » — édition 2026 !")).toBe("lancement-evaluer-pour-faire-apprendre-edition-2026");
    expect(slugify("Œuvre & cœur")).toBe("oeuvre-coeur");
    expect(slugify("!!")).toBe("actualite");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(90);
  });

  it("shows a published article dated in the future as scheduled", () => {
    const now = new Date("2026-10-30T10:00:00Z");
    expect(newsDisplayStatus({ status: "published", published_at: "2026-11-01T08:00:00Z" }, now)).toBe("scheduled");
    expect(newsDisplayStatus({ status: "published", published_at: "2026-10-01T08:00:00Z" }, now)).toBe("published");
    expect(newsDisplayStatus({ status: "draft", published_at: null }, now)).toBe("draft");
  });

  it("formats event dates in Moroccan time", async () => {
    // Built from Moroccan local times: the runtime's time-zone data decides the
    // UTC offset (Node versions disagree for Morocco), the display must match.
    const { casablancaToIso } = await import("@/lib/news");
    expect(formatEventWhen(casablancaToIso("2026-11-12T15:00")!, casablancaToIso("2026-11-12T17:00"))).toBe("jeudi 12 novembre 2026 · 15 h 00 – 17 h 00");
  });
});

describe("Moroccan time in forms", () => {
  it("converts both ways", async () => {
    const { casablancaToIso, isoToCasablanca } = await import("@/lib/news");
    // Round trip, and agreement with Intl (the offset itself depends on the runtime's time-zone data).
    for (const local of ["2026-11-12T15:00", "2026-03-01T08:30", "2026-07-15T23:45"]) {
      const iso = casablancaToIso(local)!;
      expect(isoToCasablanca(iso)).toBe(local);
      const shown = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
      expect(shown.replace(" ", "T")).toBe(local);
    }
    expect(casablancaToIso("pas une date")).toBeNull();
  });
});
