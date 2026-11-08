import { NextResponse } from "next/server";
import { uuidSchema } from "@/lib/validation";
import { MOBILE_HEADERS, createClientFromBearer } from "@/lib/supabase/bearer";
import { rateLimit } from "@/server/rate-limit";
import { videoSource } from "@/server/media";
import type { Lesson } from "@/lib/types";

/**
 * POST /api/mobile/v1/lessons/:lessonId/video
 *
 * Signed playback URL for Bunny Stream / Mux lessons (their signing keys are
 * server-only). Access decision = the same as the website's player: the
 * lesson row must be readable under the learner's RLS context
 * (`lessons_select` → can_view_course_content). Stored MP4s are signed by the
 * app itself with Supabase Storage under RLS, so they are not handled here.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/mobile/v1/lessons/[lessonId]/video">) {
  const { lessonId } = await ctx.params;
  if (!uuidSchema.safeParse(lessonId).success) return NextResponse.json({ error: "not_found" }, { status: 404, headers: MOBILE_HEADERS });

  const auth = await createClientFromBearer(request);
  if (!auth) return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: MOBILE_HEADERS });

  // Same budget idea as other signed resources: generous for normal use, bounded for scraping.
  if (!(await rateLimit(`mobile:video:${auth.userId}`, 120, 60 * 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: MOBILE_HEADERS });
  }

  const { data } = await auth.supabase
    .from("lessons")
    .select("id, kind, archived_at, video_provider, video_ref, video_duration_seconds")
    .eq("id", lessonId)
    .maybeSingle();
  const lesson = data as Pick<Lesson, "id" | "kind" | "archived_at" | "video_provider" | "video_ref" | "video_duration_seconds"> | null;
  if (!lesson || lesson.archived_at || lesson.kind !== "video") {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: MOBILE_HEADERS });
  }
  if (lesson.video_provider !== "bunny" && lesson.video_provider !== "mux") {
    return NextResponse.json({ type: "unavailable", reason: "missing" }, { headers: MOBILE_HEADERS });
  }

  const source = await videoSource(lesson);
  return NextResponse.json(source, { headers: MOBILE_HEADERS });
}
