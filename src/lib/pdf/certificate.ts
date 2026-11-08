import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { BRAND_LOGO_LIGHT_PNG_BASE64 } from "./brand-logo-light";
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

// Sanady palette: near-black and orange, warm neutrals. No gold.
const INK = COLORS.brand;
const ORANGE = COLORS.accent;
const ORANGE_TEXT = COLORS.accentText;
const MUTED = COLORS.muted;
const LINE = COLORS.line;
const PAPER = rgb(1, 0.996, 0.99);
const BAND = rgb(0.09, 0.08, 0.07);
const BAND_PATTERN = rgb(0.16, 0.145, 0.13);
const ON_BAND_MUTED = rgb(0.72, 0.69, 0.66);

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

function checkPath(size: number) {
  return `M 0 ${size * 0.55} L ${size * 0.38} ${size * 0.9} L ${size} ${size * 0.1}`;
}

/**
 * Printable A4 landscape certificate in the Fondation Sanady style: a dark
 * band on the left (light logo, zellige pattern, seal and verification QR
 * code) and an editorial main area (title, recipient, course, facts,
 * signature). Deterministic: the same certificate always yields the same file.
 */
export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${data.kind === "attestation" ? "Attestation" : "Certificat"} ${data.certificateNumber}`));
  pdf.setAuthor(pdfSafe(data.issuerName));
  pdf.setSubject(pdfSafe(data.courseTitle));
  pdf.setCreator("Fondation Sanady");
  pdf.setProducer("Fondation Sanady");
  pdf.setCreationDate(new Date(data.issuedAt));

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const fonts = {
    serif: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const attestation = data.kind === "attestation";

  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });

  const bandWidth = 232;
  await drawBand(pdf, page, fonts, data, { bandWidth, height, attestation });

  // ─── Main area ─────────────────────────────────────────────────────────
  const left = bandWidth + 58;
  const right = width - 58;
  const content = right - left;
  const text = (value: string, x: number, y: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(pdfSafe(value), { x, y, size, font, color });

  // A hairline frame around the main area.
  page.drawRectangle({ x: bandWidth + 22, y: 20, width: width - bandWidth - 42, height: height - 40, borderColor: LINE, borderWidth: 0.6 });

  text("DÉVELOPPEMENT PROFESSIONNEL DES ENSEIGNANTS", left, height - 80, 7.5, fonts.sansBold, ORANGE_TEXT);

  // Co-branding: the company's logo, top right of the main area.
  if (data.organizationLogo) {
    try {
      const img = data.organizationLogo.type === "png" ? await pdf.embedPng(data.organizationLogo.bytes) : await pdf.embedJpg(data.organizationLogo.bytes);
      const scale = Math.min(110 / img.width, 40 / img.height);
      page.drawImage(img, { x: right - img.width * scale, y: height - 52 - img.height * scale, width: img.width * scale, height: img.height * scale });
    } catch {
      // An unreadable logo never blocks the document.
    }
  }

  // Title.
  text(attestation ? "Attestation" : "Certificat", left, height - 138, 54, fonts.serif);
  text(attestation ? "de formation" : "de fin de formation", left, height - 168, 22, fonts.serifItalic, MUTED);
  page.drawRectangle({ x: left, y: height - 190, width: 44, height: 3, color: ORANGE });

  // Recipient.
  text(attestation ? "DÉLIVRÉE À" : "DÉCERNÉ À", left, height - 222, 7.5, fonts.sansBold, MUTED);
  const name = pdfSafe(data.recipientName);
  let nameSize = 34;
  while (nameSize > 20 && fonts.serif.widthOfTextAtSize(name, nameSize) > content) nameSize -= 1;
  text(name, left, height - 258, nameSize, fonts.serif);

  // Course.
  let y = height - 290;
  text("pour avoir suivi avec succès l’intégralité de la formation", left, y, 12, fonts.serifItalic, MUTED);
  y -= 26;
  const titleLines = wrapText(data.courseTitle, fonts.sansBold, 16, content).slice(0, 3);
  for (const line of titleLines) {
    text(line, left, y, 16, fonts.sansBold);
    y -= 21;
  }
  text("et réussi l’évaluation de chacun de ses modules.", left, y - 4, 12, fonts.serifItalic, MUTED);

  // Facts.
  const factsTop = 172;
  page.drawLine({ start: { x: left, y: factsTop }, end: { x: right, y: factsTop }, thickness: 0.6, color: LINE });
  const facts: Array<[string, string, boolean]> = [
    ["DATE D’ACHÈVEMENT", pdfDate(data.completedAt), false],
    ["DURÉE", pdfDuration(data.durationMinutes), false],
    [attestation ? "N° D’ATTESTATION" : "N° DE CERTIFICAT", data.certificateNumber, true],
  ];
  const col = content / facts.length;
  facts.forEach(([label, value, bold], i) => {
    const x = left + i * col;
    text(label, x, factsTop - 20, 6.5, fonts.sansBold, MUTED);
    text(value, x, factsTop - 36, 11, bold ? fonts.sansBold : fonts.sans);
  });

  // Signature.
  const sigY = 86;
  page.drawLine({ start: { x: left, y: sigY + 16 }, end: { x: left + 200, y: sigY + 16 }, thickness: 0.8, color: INK });
  text(data.signatoryName || data.issuerName, left, sigY, 11, fonts.serif);
  text(data.signatoryTitle || "Fondation Sanady", left, sigY - 13, 8, fonts.sans, MUTED);
  text(`${attestation ? "Délivrée" : "Délivré"} le ${pdfDate(data.issuedAt)}`, left, sigY - 25, 7.5, fonts.sans, MUTED);

  // Status pill, bottom right.
  const pillLabel = "Formation validée";
  const pillW = fonts.sansBold.widthOfTextAtSize(pillLabel, 9) + 40;
  const pillX = right - pillW;
  page.drawRectangle({ x: pillX, y: sigY - 2, width: pillW, height: 24, color: COLORS.accentLight, borderColor: rgb(1, 0.85, 0.74), borderWidth: 0.6 });
  page.drawSvgPath(checkPath(9), { x: pillX + 12, y: sigY + 15, borderColor: ORANGE_TEXT, borderWidth: 1.6 });
  text(pillLabel, pillX + 28, sigY + 6.5, 9, fonts.sansBold, ORANGE_TEXT);

  // Disclaimer.
  const host = data.verificationUrl.replace(/^https?:\/\//, "");
  wrapText(
    `${attestation ? "Cette attestation" : "Ce certificat"} atteste le suivi complet d’une formation sur la plateforme SANADY${data.organization ? ` (espace ${data.organization})` : ""} et la réussite de ses évaluations. Il ne constitue ni un diplôme ni une certification professionnelle réglementée. Vérification en ligne : ${host}`,
    fonts.sans,
    6,
    content,
  )
    .slice(0, 3)
    .forEach((line, i) => text(line, left, 42 - i * 8, 6, fonts.sans, rgb(0.55, 0.53, 0.5)));

  return pdf.save();
}

/** The dark left band: logo, zellige pattern, seal and the verification QR code. */
async function drawBand(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: { sans: PDFFont; sansBold: PDFFont },
  data: CertificateData,
  o: { bandWidth: number; height: number; attestation: boolean },
) {
  const { bandWidth: bw, height } = o;
  page.drawRectangle({ x: 0, y: 0, width: bw, height, color: BAND });

  // Zellige: a lattice of eight-pointed stars, barely lighter than the band.
  const star = starPath(15, 9);
  const step = 46;
  for (let row = 0; row * step < height + step; row++) {
    for (let c = 0; c * step < bw + step; c++) {
      const cx = c * step + (row % 2 ? step / 2 : 0);
      page.drawSvgPath(star, { x: cx, y: height - row * step, borderColor: BAND_PATTERN, borderWidth: 0.7 });
    }
  }
  // The lattice runs past the band's edge: cover the overflow with paper.
  const { width } = page.getSize();
  page.drawRectangle({ x: bw, y: -4, width: width - bw + 4, height: height + 8, color: PAPER });
  // Fade the pattern out behind the logo, seal and code.
  for (const [y0, h] of [[height - 150, 130], [height / 2 - 70, 140], [26, 170]] as const) {
    page.drawRectangle({ x: 24, y: y0, width: bw - 48, height: h, color: BAND, opacity: 0.92 });
  }
  page.drawRectangle({ x: bw, y: 0, width: 4, height, color: ORANGE });

  const centre = (value: string, y: number, size: number, font: PDFFont, color = rgb(1, 1, 1)) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: (bw - font.widthOfTextAtSize(safe, size)) / 2, y, size, font, color });
  };

  // Light logo.
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_LIGHT_PNG_BASE64, "base64"));
  const lw = 150;
  const lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: (bw - lw) / 2, y: height - 56 - lh, width: lw, height: lh });
  centre("Plateforme de formation", height - 76 - lh, 8, fonts.sans, ON_BAND_MUTED);
  centre("des enseignants", height - 87 - lh, 8, fonts.sans, ON_BAND_MUTED);

  // Seal: an orange zellige star around a white disc.
  const sx = bw / 2;
  const sy = height / 2;
  page.drawSvgPath(starPath(52, 40), { x: sx, y: sy, color: ORANGE });
  page.drawCircle({ x: sx, y: sy, size: 31, color: rgb(1, 1, 1) });
  page.drawCircle({ x: sx, y: sy, size: 27, borderColor: ORANGE, borderWidth: 0.6 });
  const sealLine = (value: string, dy: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) => {
    const safe = pdfSafe(value);
    page.drawText(safe, { x: sx - font.widthOfTextAtSize(safe, size) / 2, y: sy + dy, size, font, color });
  };
  sealLine("FONDATION", 8, 5.2, fonts.sansBold, MUTED);
  sealLine("SANADY", -2, 9.5, fonts.sansBold, INK);
  sealLine(String(new Date(data.issuedAt).getUTCFullYear()), -12, 6, fonts.sansBold, ORANGE_TEXT);

  // Verification QR code on a white tile.
  const qrPng = await QRCode.toBuffer(data.verificationUrl, { errorCorrectionLevel: "M", margin: 1, width: 300, color: { dark: "#1C1917", light: "#FFFFFF" } });
  const qr = await pdf.embedPng(qrPng);
  const tile = 88;
  const tx = (bw - tile) / 2;
  const ty = 82;
  page.drawRectangle({ x: tx, y: ty, width: tile, height: tile, color: rgb(1, 1, 1) });
  page.drawImage(qr, { x: tx + 5, y: ty + 5, width: tile - 10, height: tile - 10 });
  centre(o.attestation ? "Vérifier cette attestation" : "Vérifier ce certificat", 62, 8, fonts.sansBold);
  centre("Scannez le code ou rendez-vous sur", 50, 6.5, fonts.sans, ON_BAND_MUTED);
  const host = (() => {
    try {
      return `${new URL(data.verificationUrl).host}/verifier`;
    } catch {
      return "la page de vérification";
    }
  })();
  centre(host, 40, 6.5, fonts.sans, ON_BAND_MUTED);
}
