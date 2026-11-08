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

// Sanady palette: near-black and orange, warm neutrals.
const INK = COLORS.brand;
const ORANGE = COLORS.accent;
const ORANGE_TEXT = COLORS.accentText;
const MUTED = COLORS.muted;
const PAPER = rgb(1, 1, 1);
const COLUMN = rgb(0.955, 0.945, 0.93);
const FRAME = rgb(0.11, 0.1, 0.09);

type Fonts = { serif: PDFFont; serifRegular: PDFFont; serifItalic: PDFFont; sans: PDFFont; sansBold: PDFFont };

/** An eight-pointed star (the zellige motif) as an SVG path centred on 0,0. */
function starPath(outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

/**
 * Printable A4 landscape certificate: a dark frame; on the left a light
 * column with an orange ribbon and medallion, the duration and the date; on
 * the right a white sheet with a fine guilloche, the Foundation logo, the
 * recipient and course, the verification QR code and the signature.
 * Deterministic: the same certificate always yields the same file.
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

  // Frame: near-black border, a fine orange line, then the sheet.
  page.drawRectangle({ x: 0, y: 0, width, height, color: FRAME });
  page.drawRectangle({ x: 9, y: 9, width: width - 18, height: height - 18, borderColor: ORANGE, borderWidth: 1.2 });
  const inset = 16;
  const top = height - inset;
  const bottom = inset;
  page.drawRectangle({ x: inset, y: inset, width: width - inset * 2, height: height - inset * 2, color: PAPER });

  // ─── Left column ───────────────────────────────────────────────────────
  const colW = 214;
  const colX = inset;
  const colCx = colX + colW / 2;
  page.drawRectangle({ x: colX, y: bottom, width: colW, height: top - bottom, color: COLUMN });

  // Ribbon with a notched end, hanging from the top edge.
  const rw = 64;
  const ribbonLen = 300;
  page.drawSvgPath(`M 0 0 L ${rw} 0 L ${rw} ${ribbonLen} L ${rw / 2} ${ribbonLen - 28} L 0 ${ribbonLen} Z`, {
    x: colCx - rw / 2,
    y: top,
    color: ORANGE,
  });
  drawMedallion(page, fonts, colCx, top - 132, data);

  // Duration and date, as in a record.
  const centre = (value: string, y: number, size: number, font: PDFFont, color: RGB = INK) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: colCx - font.widthOfTextAtSize(safe, size) / 2, y, size, font, color });
  };
  const fact = (value: string, label: string, y: number) => {
    centre(value, y, 15, fonts.sansBold);
    page.drawLine({ start: { x: colX + 30, y: y - 9 }, end: { x: colX + colW - 30, y: y - 9 }, thickness: 0.7, color: rgb(0.72, 0.69, 0.66) });
    centre(label, y - 23, 8.5, fonts.sans, MUTED);
  };
  fact(pdfDuration(data.durationMinutes), "Durée de la formation", 172);
  fact(pdfDate(data.completedAt), "Date d’obtention", 92);

  // ─── Main sheet ────────────────────────────────────────────────────────
  const mainX = colX + colW;
  const left = mainX + 64;
  const right = width - inset - 52;
  const content = right - left;
  drawGuilloche(page, mainX, bottom, width - inset - mainX, top - bottom);

  // Logo, and the company's when the course is theirs.
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  const lh = 46;
  const lw = (logo.width / logo.height) * lh;
  page.drawImage(logo, { x: left, y: top - 40 - lh, width: lw, height: lh });
  text("DÉVELOPPEMENT PROFESSIONNEL DES ENSEIGNANTS", left, top - 102, 7.5, fonts.sansBold, MUTED);
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
  text(title, left, y, 30, fonts.serifRegular);
  text(attestation ? "de formation" : "de fin de formation", left + fonts.serifRegular.widthOfTextAtSize(`${title} `, 30), y, 16, fonts.serifItalic, MUTED);
  y -= 42;
  const name = pdfSafe(data.recipientName);
  let nameSize = 26;
  while (nameSize > 16 && fonts.sansBold.widthOfTextAtSize(name, nameSize) > content) nameSize -= 1;
  text(name, left, y, nameSize, fonts.sansBold);
  page.drawRectangle({ x: left, y: y - 14, width: 40, height: 2.5, color: ORANGE });

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
  text(data.verificationUrl.replace(/^https?:\/\//, ""), left, qrY - 23, 7.5, fonts.sans, ORANGE_TEXT);

  // Signature, bottom right. Without a named signatory, the issuer signs.
  const signer = data.signatoryName || data.issuerName;
  const role = data.signatoryName ? data.signatoryTitle || data.issuerName : "Organisme émetteur";
  const sigY = bottom + 84;
  rightText(signer, right, sigY + 8, 19, fonts.serifItalic);
  page.drawLine({ start: { x: right - 190, y: sigY }, end: { x: right, y: sigY }, thickness: 0.7, color: INK });
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

/** Linear blend between two colours. */
function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return rgb(a.red + (b.red - a.red) * k, a.green + (b.green - a.green) * k, a.blue + (b.blue - a.blue) * k);
}

const SILVER_DARK = rgb(0.46, 0.47, 0.5);
const SILVER_MID = rgb(0.72, 0.73, 0.76);
const SILVER_LIGHT = rgb(0.97, 0.97, 0.98);

/**
 * A metal disc: stacked circles shading from the rim to a highlight up and to
 * the left, the way light falls on a polished medal.
 */
function metalDisc(page: PDFPage, cx: number, cy: number, r: number, from: RGB, to: RGB, steps = 36) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    page.drawCircle({
      x: cx - r * 0.22 * t,
      y: cy + r * 0.22 * t,
      size: r * (1 - t * 0.78),
      color: mix(from, to, eased),
    });
  }
}

/** The medallion on the ribbon: a silver medal with a reeded edge, laurels and the star. */
function drawMedallion(page: PDFPage, fonts: Fonts, cx: number, cy: number, data: CertificateData) {
  // A soft shadow under the medal.
  page.drawCircle({ x: cx + 2, y: cy - 3, size: 63, color: rgb(0, 0, 0), opacity: 0.12 });

  // Reeded rim: a dark ring with fine ridges, then a bevel.
  page.drawCircle({ x: cx, y: cy, size: 62, color: SILVER_DARK });
  for (let i = 0; i < 132; i++) {
    const a = (Math.PI * 2 * i) / 132;
    // Ridges catch the light on the upper left.
    const light = 0.5 + 0.5 * Math.cos(a - (Math.PI * 3) / 4);
    page.drawLine({
      start: { x: cx + Math.cos(a) * 57.5, y: cy + Math.sin(a) * 57.5 },
      end: { x: cx + Math.cos(a) * 61.5, y: cy + Math.sin(a) * 61.5 },
      thickness: 0.9,
      color: mix(SILVER_MID, SILVER_LIGHT, light),
    });
  }
  metalDisc(page, cx, cy, 57, SILVER_DARK, SILVER_LIGHT, 18);
  // The field: brushed silver, slightly recessed (darker edge, light centre).
  metalDisc(page, cx, cy, 52, SILVER_MID, rgb(0.99, 0.99, 1), 40);
  page.drawCircle({ x: cx, y: cy, size: 52, borderColor: SILVER_DARK, borderWidth: 0.6, opacity: 0.6 });

  // Laurels in relief: each leaf has a dark shadow and a light edge.
  for (const side of [-1, 1]) {
    const stem: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + side * (0.3 + i * 0.12);
      stem.push(`${(Math.cos(a) * 44).toFixed(2)} ${(-Math.sin(a) * 44).toFixed(2)}`);
    }
    page.drawSvgPath(`M ${stem.join(" L ")}`, { x: cx + 0.6, y: cy - 0.6, borderColor: SILVER_DARK, borderWidth: 1.1 });
    page.drawSvgPath(`M ${stem.join(" L ")}`, { x: cx, y: cy, borderColor: SILVER_LIGHT, borderWidth: 0.5 });
    for (let i = 0; i < 11; i++) {
      // Angle in PDF space (y up): start near the bottom, climb each side.
      const a = -Math.PI / 2 + side * (0.34 + i * 0.215);
      const lx = cx + Math.cos(a) * 44;
      const ly = cy + Math.sin(a) * 44;
      // Each leaf points up along the branch, tilted outwards.
      const tilt = a + side * (Math.PI / 2) - side * 0.45;
      const len = 10.5 - i * 0.35;
      const dx = Math.cos(tilt) * len;
      const dy = Math.sin(tilt) * len;
      const nx = -dy * 0.38;
      const ny = dx * 0.38;
      // SVG paths are drawn with y pointing down: flip the y components.
      const leaf = `M 0 0 Q ${(dx / 2 + nx).toFixed(2)} ${(-(dy / 2 + ny)).toFixed(2)} ${dx.toFixed(2)} ${(-dy).toFixed(2)} Q ${(dx / 2 - nx).toFixed(2)} ${(-(dy / 2 - ny)).toFixed(2)} 0 0 Z`;
      page.drawSvgPath(leaf, { x: lx + 0.7, y: ly - 0.7, color: SILVER_DARK });
      page.drawSvgPath(leaf, { x: lx, y: ly, color: mix(SILVER_MID, SILVER_LIGHT, 0.35), borderColor: SILVER_LIGHT, borderWidth: 0.35 });
    }
  }

  // The star, in Sanady orange, set into the silver with a metal bezel.
  const star = starPath(33, 25);
  page.drawSvgPath(star, { x: cx + 0.8, y: cy - 0.8, color: SILVER_DARK });
  page.drawSvgPath(star, { x: cx, y: cy, color: ORANGE, borderColor: SILVER_LIGHT, borderWidth: 0.8 });
  // A lighter facet on the upper half of the star.
  page.drawSvgPath(starPath(30, 22.5), { x: cx - 0.6, y: cy + 0.6, color: rgb(1, 0.55, 0.3), opacity: 0.35 });
  metalDisc(page, cx, cy, 21, SILVER_MID, rgb(1, 1, 1), 24);
  page.drawCircle({ x: cx, y: cy, size: 21, borderColor: SILVER_DARK, borderWidth: 0.5 });
  const line = (value: string, dy: number, size: number, font: PDFFont, color: RGB) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: cx - font.widthOfTextAtSize(safe, size) / 2, y: cy + dy, size, font, color });
  };
  line("SANADY", -2, 7.5, fonts.sansBold, INK);
  line(String(new Date(data.issuedAt).getUTCFullYear()), -10, 5.5, fonts.sansBold, ORANGE_TEXT);
}

/**
 * A guilloche in relief: two twisting ribbons, each drawn as a fan of fine
 * waves whose phase slips line after line, so the band seems to turn in
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
      // The twist: each line's offset follows a cosine, so lines bunch at the
      // folds and spread on the faces.
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const twist = Math.cos(t * Math.PI * 2.2 + b.phase + u * Math.PI);
        const centre = b.base + Math.sin(t * Math.PI * b.freq + b.phase) * b.amp;
        const py = (centre + (u - 0.5) * b.width * twist) * h;
        const up = Math.max(4, Math.min(h - 4, py));
        pts.push(`${(t * w).toFixed(1)} ${(h - up).toFixed(1)}`);
      }
      // Shading: darker lines at the band's edges, lightest in the middle.
      const edge = Math.abs(u - 0.5) * 2;
      page.drawSvgPath(`M ${pts.join(" L ")}`, {
        x,
        y: y + h,
        borderColor: mix(rgb(0.998, 0.96, 0.935), rgb(0.97, 0.84, 0.76), edge),
        borderWidth: 0.3 + edge * 0.15,
      });
    }
  }
}
