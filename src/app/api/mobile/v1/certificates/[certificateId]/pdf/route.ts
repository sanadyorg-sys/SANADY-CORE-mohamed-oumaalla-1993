import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOBILE_HEADERS, createClientFromBearer } from "@/lib/supabase/bearer";
import type { Certificate, PlatformSettings } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

/**
 * GET /api/mobile/v1/certificates/:certificateId/pdf
 *
 * The official certificate PDF for the mobile app — same renderer and same
 * access rule as /api/certificats/[certificateId] (RLS on `certificates`),
 * authenticated by Bearer token instead of cookies. Nothing is stored.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/mobile/v1/certificates/[certificateId]/pdf">) {
  const { certificateId } = await ctx.params;
  if (!uuidSchema.safeParse(certificateId).success) return new NextResponse("Introuvable", { status: 404, headers: MOBILE_HEADERS });

  const auth = await createClientFromBearer(request);
  if (!auth) return new NextResponse("Authentification requise", { status: 401, headers: MOBILE_HEADERS });
  const { supabase } = auth;

  const [{ data: cert }, { data: settings }, { data: style }] = await Promise.all([
    supabase.from("certificates").select("*").eq("id", certificateId).maybeSingle(),
    supabase.from("platform_settings").select("*").maybeSingle(),
    supabase.rpc("certificate_style", { p_certificate: certificateId }),
  ]);
  const company = style as { kind: "certificat" | "attestation"; organization: string; logo_path: string | null } | null;
  const certificate = cert as Certificate | null;
  if (!certificate) return new NextResponse("Introuvable", { status: 404, headers: MOBILE_HEADERS });
  if (certificate.revoked_at) return new NextResponse("Ce certificat a été révoqué.", { status: 410, headers: MOBILE_HEADERS });

  // certificate_style already decided this person may see the company's styling (same as the web route).
  let organizationLogo: { bytes: Uint8Array; type: "png" | "jpg" } | null = null;
  if (company?.logo_path) {
    const { data: file } = await createAdminClient().storage.from("enterprise-logos").download(company.logo_path);
    if (file) organizationLogo = { bytes: new Uint8Array(await file.arrayBuffer()), type: company.logo_path.endsWith(".png") ? "png" : "jpg" };
  }

  const s = settings as PlatformSettings | null;
  const bytes = await renderCertificatePdf({
    certificateNumber: certificate.certificate_number,
    recipientName: certificate.recipient_name,
    courseTitle: certificate.course_title,
    durationMinutes: certificate.course_duration_minutes,
    completedAt: certificate.completed_at,
    issuedAt: certificate.issued_at,
    issuerName: s?.certificate_issuer_name ?? "SANADY",
    signatoryName: s?.certificate_signatory_name,
    signatoryTitle: s?.certificate_signatory_title,
    verificationUrl: `${publicEnv.appUrl}/verifier/${certificate.verification_code}`,
    kind: company?.kind ?? "certificat",
    organization: company?.organization ?? null,
    organizationLogo,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      ...MOBILE_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${company?.kind === "attestation" ? "attestation" : "certificat"}-${certificate.certificate_number}.pdf"`,
    },
  });
}
