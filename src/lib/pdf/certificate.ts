import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";
import { COLORS, pdfDate, pdfDuration, pdfSafe, wrapText } from "./common";

export interface CertificateData {
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  durationMinutes: number | null;
  completedAt: string;
  issuedAt: string;
  issuerName: string;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  verificationUrl: string;
  /** Company workspaces may issue an « attestation de formation » (SANADY Enterprise). */
  kind?: "certificat" | "attestation";
  /** Company that ordered the training, shown on its employees' documents. */
  organization?: string | null;
  /** That company's logo (PNG or JPEG, already checked), beside the Foundation logo. */
  organizationLogo?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
}

// Black and gold, with the Sanady logo in its own orange.
const INK = COLORS.brand;
const MUTED = COLORS.muted;
const PAPER = rgb(1, 1, 1);
const BLACK = rgb(0.075, 0.07, 0.065);
const BLACK_SOFT = rgb(0.16, 0.15, 0.14);
const GOLD_DARK = rgb(0.54, 0.35, 0.07);
const GOLD = rgb(0.79, 0.55, 0.17);
const GOLD_LIGHT = rgb(0.96, 0.83, 0.52);
const GOLD_SHINE = rgb(1, 0.95, 0.8);
const GOLD_TEXT = rgb(0.5, 0.33, 0.05);

type Fonts = { serif: PDFFont; serifRegular: PDFFont; serifItalic: PDFFont; sans: PDFFont; sansBold: PDFFont };

/** Linear blend between two colours. */
function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return rgb(a.red + (b.red - a.red) * k, a.green + (b.green - a.green) * k, a.blue + (b.blue - a.blue) * k);
}

/** Gold as lit from the upper left: `angle` is the surface's facing, in radians. */
function goldAt(angle: number) {
  const light = 0.5 + 0.5 * Math.cos(angle - (Math.PI * 3) / 4);
  return light > 0.5 ? mix(GOLD, GOLD_LIGHT, (light - 0.5) * 2) : mix(GOLD_DARK, GOLD, light * 2);
}

/** A disc shading from `from` at the rim to `to` in a highlight up and to the left. */
function shadedDisc(page: PDFPage, cx: number, cy: number, r: number, from: RGB, to: RGB, steps = 30, reach = 0.75) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    page.drawCircle({ x: cx - r * 0.2 * t, y: cy + r * 0.2 * t, size: r * (1 - t * reach), color: mix(from, to, eased) });
  }
}

/**
 * Printable A4 landscape certificate in black and gold: a black frame with a
 * gold filet; on the left a black column with a gold rosette and ribbons, the
 * duration and the date; on the right a white sheet with a gold guilloche in
 * relief, the Foundation logo, the recipient and course, the verification QR
 * code and the signature. Deterministic: the same certificate always yields
 * the same file.
 */
export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const attestation = data.kind === "attestation";
  pdf.setTitle(pdfSafe(`${attestation ? "Attestation" : "Certificat"} ${data.certificateNumber}`));
  pdf.setAuthor(pdfSafe(data.issuerName));
  pdf.setSubject(pdfSafe(data.courseTitle));
  pdf.setCreator("Fondation Sanady");
  pdf.setProducer("Fondation Sanady");
  pdf.setCreationDate(new Date(data.issuedAt));

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const fonts: Fonts = {
    serif: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const text = (value: string, x: number, y: number, size: number, font: PDFFont, color: RGB = INK) =>
    page.drawText(pdfSafe(value), { x, y, size, font, color });
  const rightText = (value: string, x: number, y: number, size: number, font: PDFFont, color: RGB = INK) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: x - font.widthOfTextAtSize(safe, size), y, size, font, color });
  };

  // Frame: black border with a double gold filet, then the sheet.
  page.drawRectangle({ x: 0, y: 0, width, height, color: BLACK });
  page.drawRectangle({ x: 7, y: 7, width: width - 14, height: height - 14, borderColor: GOLD, borderWidth: 1.4 });
  page.drawRectangle({ x: 10.5, y: 10.5, width: width - 21, height: height - 21, borderColor: GOLD_DARK, borderWidth: 0.5 });
  const inset = 16;
  const top = height - inset;
  const bottom = inset;
  page.drawRectangle({ x: inset, y: inset, width: width - inset * 2, height: height - inset * 2, color: PAPER });

  // ─── Left column: black, with the rosette ──────────────────────────────
  const colW = 214;
  const colX = inset;
  const colCx = colX + colW / 2;
  page.drawRectangle({ x: colX, y: bottom, width: colW, height: top - bottom, color: BLACK });
  // A faint pool of light behind the rosette, and a gold edge on the column.
  for (let i = 0; i < 14; i++) {
    page.drawCircle({ x: colCx, y: top - 150, size: 100 - i * 6, color: BLACK_SOFT, opacity: 0.1 });
  }
  page.drawRectangle({ x: colX + colW - 2, y: bottom, width: 2, height: top - bottom, color: GOLD });

  drawRosette(page, fonts, colCx, top - 150, data);

  const centre = (value: string, y: number, size: number, font: PDFFont, color: RGB) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: colCx - font.widthOfTextAtSize(safe, size) / 2, y, size, font, color });
  };
  const fact = (value: string, label: string, y: number) => {
    centre(value, y, 15, fonts.sansBold, PAPER);
    page.drawLine({ start: { x: colX + 34, y: y - 9 }, end: { x: colX + colW - 34, y: y - 9 }, thickness: 0.7, color: GOLD });
    centre(label, y - 23, 8, fonts.sans, GOLD_LIGHT);
  };
  fact(pdfDuration(data.durationMinutes), "Durée de la formation", 168);
  fact(pdfDate(data.completedAt), "Date d’obtention", 88);

  // ─── Main sheet ────────────────────────────────────────────────────────
  const mainX = colX + colW;
  const left = mainX + 62;
  const right = width - inset - 50;
  const content = right - left;
  drawGuilloche(page, mainX, bottom, width - inset - mainX, top - bottom);

  // Logo, and the company's when the course is theirs.
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  const lh = 46;
  const lw = (logo.width / logo.height) * lh;
  page.drawImage(logo, { x: left, y: top - 40 - lh, width: lw, height: lh });
  text("DÉVELOPPEMENT PROFESSIONNEL DES ENSEIGNANTS", left, top - 102, 7.5, fonts.sansBold, GOLD_TEXT);
  if (data.organizationLogo) {
    try {
      const img = data.organizationLogo.type === "png" ? await pdf.embedPng(data.organizationLogo.bytes) : await pdf.embedJpg(data.organizationLogo.bytes);
      const scale = Math.min(110 / img.width, 44 / img.height);
      page.drawImage(img, { x: right - img.width * scale, y: top - 40 - img.height * scale, width: img.width * scale, height: img.height * scale });
    } catch {
      // An unreadable logo never blocks the document.
    }
  }

  // Title, recipient, course.
  let y = top - 152;
  const title = attestation ? "Attestation" : "Certificat";
  text(title, left, y, 32, fonts.serifRegular);
  text(attestation ? "de formation" : "de fin de formation", left + fonts.serifRegular.widthOfTextAtSize(`${title} `, 32), y, 17, fonts.serifItalic, MUTED);
  y -= 44;
  const name = pdfSafe(data.recipientName);
  let nameSize = 27;
  while (nameSize > 16 && fonts.sansBold.widthOfTextAtSize(name, nameSize) > content) nameSize -= 1;
  text(name, left, y, nameSize, fonts.sansBold);
  // A gold rule with a diamond, under the name.
  page.drawLine({ start: { x: left, y: y - 13 }, end: { x: left + 120, y: y - 13 }, thickness: 1, color: GOLD });
  page.drawSvgPath("M 0 -3.5 L 3.5 0 L 0 3.5 L -3.5 0 Z", { x: left + 124, y: y - 13, color: GOLD });

  y -= 46;
  for (const line of wrapText(
    "a suivi avec succès l’intégralité de la formation et réussi l’évaluation de chacun de ses modules :",
    fonts.serifRegular,
    15,
    content * 0.82,
  )) {
    text(line, left, y, 15, fonts.serifRegular, MUTED);
    y -= 19;
  }
  y -= 14;
  for (const line of wrapText(data.courseTitle, fonts.sansBold, 19, content).slice(0, 3)) {
    text(line, left, y, 19, fonts.sansBold);
    y -= 24;
  }

  // Verification, bottom left.
  const qrSize = 74;
  const qrY = bottom + 62;
  text(attestation ? "Vérifier cette attestation :" : "Vérifier ce certificat :", left, qrY + qrSize + 6, 7.5, fonts.sansBold, MUTED);
  const qrPng = await QRCode.toBuffer(data.verificationUrl, { errorCorrectionLevel: "M", margin: 0, width: 300, color: { dark: "#1C1917", light: "#FFFFFF" } });
  page.drawImage(await pdf.embedPng(qrPng), { x: left, y: qrY, width: qrSize, height: qrSize });
  text(data.certificateNumber, left, qrY - 12, 8, fonts.sansBold);
  text(data.verificationUrl.replace(/^https?:\/\//, ""), left, qrY - 23, 7.5, fonts.sans, GOLD_TEXT);

  // Signature, bottom right. Without a named signatory, the issuer signs.
  const signer = data.signatoryName || data.issuerName;
  const role = data.signatoryName ? data.signatoryTitle || data.issuerName : "Organisme émetteur";
  const sigY = bottom + 84;
  rightText(signer, right, sigY + 8, 19, fonts.serifItalic);
  page.drawLine({ start: { x: right - 190, y: sigY }, end: { x: right, y: sigY }, thickness: 0.8, color: GOLD });
  rightText(role, right, sigY - 13, 8.5, fonts.sansBold);
  rightText(`${attestation ? "Délivrée" : "Délivré"} le ${pdfDate(data.issuedAt)}`, right, sigY - 25, 7.5, fonts.sans, MUTED);

  // Disclaimer along the bottom of the sheet.
  wrapText(
    `${attestation ? "Cette attestation" : "Ce certificat"} atteste le suivi complet d’une formation sur la plateforme SANADY${data.organization ? ` (espace ${data.organization})` : ""} et la réussite de ses évaluations. Il ne constitue ni un diplôme ni une certification professionnelle réglementée.`,
    fonts.sans,
    6,
    content,
  )
    .slice(0, 2)
    .forEach((line, i) => text(line, left, bottom + 20 - i * 7.5, 6, fonts.sans, rgb(0.55, 0.53, 0.5)));

  return pdf.save();
}

/** One ribbon tail: black with gold edges and a V-cut end. `lean` tilts it outwards. */
function ribbonTail(page: PDFPage, x: number, y: number, lean: number) {
  const w = 34;
  const len = 120;
  const notch = 16;
  // SVG coordinates: y grows downwards from (x, y).
  const pts: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [w + lean, len],
    [w / 2 + lean, len - notch],
    [lean, len],
  ];
  const path = (inset: number) =>
    `M ${pts
      .map(([px, py], i) => {
        // Pull the shape in for the black body inside the gold edge.
        const ix = i === 0 || i === 4 ? inset : i === 1 || i === 2 ? -inset : 0;
        const iy = i === 2 || i === 4 ? -inset * 1.6 : i === 3 ? -inset * 1.2 : 0;
        return `${(px + ix).toFixed(2)} ${(py + iy).toFixed(2)}`;
      })
      .join(" L ")} Z`;
  page.drawSvgPath(path(0), { x: x + 1.5, y: y - 2, color: rgb(0, 0, 0), opacity: 0.35 });
  page.drawSvgPath(path(0), { x, y, color: GOLD });
  page.drawSvgPath(path(2.2), { x, y, color: BLACK });
  // A soft fold of light down the middle of the tail.
  page.drawSvgPath(`M ${w * 0.42} 4 L ${w * 0.58} 4 L ${w * 0.58 + lean} ${len - notch - 6} L ${w * 0.42 + lean} ${len - notch - 6} Z`, {
    x,
    y,
    color: BLACK_SOFT,
    opacity: 0.8,
  });
}

/**
 * The award rosette: two ribbon tails, a serrated gold seal lit from the upper
 * left, a black ring, a polished gold ring, and a black centre carrying the
 * Foundation's name and the year in gold.
 */
function drawRosette(page: PDFPage, fonts: Fonts, cx: number, cy: number, data: CertificateData) {
  // Tails first, behind the seal.
  ribbonTail(page, cx - 38, cy - 28, -14);
  ribbonTail(page, cx + 4, cy - 28, 14);

  // Shadow, then the serrated seal: each tooth shaded by where it faces.
  page.drawCircle({ x: cx + 2, y: cy - 3, size: 70, color: rgb(0, 0, 0), opacity: 0.4 });
  const teeth = 30;
  const rOut = 70;
  const rIn = 60;
  for (let i = 0; i < teeth; i++) {
    const a0 = (Math.PI * 2 * i) / teeth;
    const a1 = (Math.PI * 2 * (i + 0.5)) / teeth;
    const a2 = (Math.PI * 2 * (i + 1)) / teeth;
    // Two facets per tooth: the lit side and the shaded side.
    for (const [from, to, shade] of [[a0, a1, 0.15], [a1, a2, -0.15]] as const) {
      const ra = from === a0 ? rIn : rOut;
      const rb = to === a1 ? rOut : rIn;
      page.drawSvgPath(
        `M 0 0 L ${(Math.cos(from) * ra).toFixed(2)} ${(-Math.sin(from) * ra).toFixed(2)} L ${(Math.cos(to) * rb).toFixed(2)} ${(-Math.sin(to) * rb).toFixed(2)} Z`,
        { x: cx, y: cy, color: goldAt(a1 + shade * 2) },
      );
    }
  }
  // The seal's face and its rim.
  shadedDisc(page, cx, cy, 61, GOLD_DARK, GOLD_LIGHT, 20, 0.5);

  // Black ring, polished gold ring, black ring, black centre.
  page.drawCircle({ x: cx, y: cy, size: 55, color: BLACK });
  shadedDisc(page, cx, cy, 51, GOLD_DARK, GOLD_SHINE, 26, 0.6);
  // The ring's shine runs round it: lighter on the upper left.
  for (let i = 0; i < 72; i++) {
    const a = (Math.PI * 2 * i) / 72;
    page.drawLine({
      start: { x: cx + Math.cos(a) * 44.5, y: cy + Math.sin(a) * 44.5 },
      end: { x: cx + Math.cos(a) * 50.5, y: cy + Math.sin(a) * 50.5 },
      thickness: 4.6,
      color: goldAt(a),
    });
  }
  page.drawCircle({ x: cx, y: cy, size: 44, color: BLACK });
  shadedDisc(page, cx, cy, 41, BLACK, rgb(0.24, 0.23, 0.22), 26, 0.85);

  // Centre: a gold eight-pointed star, the name and the year.
  const star: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 7 : 3.6;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    star.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  page.drawSvgPath(`M ${star.join(" L ")} Z`, { x: cx, y: cy + 17, color: GOLD_LIGHT });
  const line = (value: string, dy: number, size: number, font: PDFFont, color: RGB) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: cx - font.widthOfTextAtSize(safe, size) / 2, y: cy + dy, size, font, color });
  };
  line("SANADY", -3, 11, fonts.serif, GOLD_LIGHT);
  page.drawLine({ start: { x: cx - 16, y: cy - 8 }, end: { x: cx + 16, y: cy - 8 }, thickness: 0.5, color: GOLD });
  line(String(new Date(data.issuedAt).getUTCFullYear()), -18, 7.5, fonts.sansBold, GOLD);
}

/**
 * A gold guilloche in relief: two twisting ribbons, each drawn as a fan of
 * fine waves whose phase slips line after line, so the band seems to turn in
 * space. Lines darken towards the band's edges, like shading on a fold.
 */
function drawGuilloche(page: PDFPage, x: number, y: number, w: number, h: number) {
  const steps = 110;
  const bands = [
    { base: 0.62, amp: 0.2, freq: 1.25, phase: 0.3, width: 0.16, lines: 34 },
    { base: 0.3, amp: 0.16, freq: 1.7, phase: 2.1, width: 0.12, lines: 28 },
  ];
  for (const b of bands) {
    for (let k = 0; k < b.lines; k++) {
      const u = k / (b.lines - 1); // across the band, 0 → 1
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // The twist: each line's offset follows a cosine, so lines bunch at
        // the folds and spread on the faces.
        const twist = Math.cos(t * Math.PI * 2.2 + b.phase + u * Math.PI);
        const centre = b.base + Math.sin(t * Math.PI * b.freq + b.phase) * b.amp;
        const up = Math.max(4, Math.min(h - 4, (centre + (u - 0.5) * b.width * twist) * h));
        pts.push(`${(t * w).toFixed(1)} ${(h - up).toFixed(1)}`);
      }
      const edge = Math.abs(u - 0.5) * 2;
      page.drawSvgPath(`M ${pts.join(" L ")}`, {
        x,
        y: y + h,
        borderColor: mix(rgb(0.995, 0.975, 0.92), rgb(0.9, 0.79, 0.55), edge),
        borderWidth: 0.3 + edge * 0.15,
      });
    }
  }
}
