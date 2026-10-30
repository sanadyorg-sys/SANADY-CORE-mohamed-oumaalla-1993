import { NextResponse } from "next/server";
import { SLUG_PATTERN } from "@/lib/news";
import { uuidSchema } from "@/lib/validation";
import { getNewsArticle } from "@/server/queries/news";
import { recordNewsEvent } from "@/server/news-stats";

/**
 * Course link of an article: counts the click, then opens the course — in
 * the learner space when the person has access, otherwise its public page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = await params;
  const fallback = new URL("/actualites", request.url);
  if (!SLUG_PATTERN.test(slug) || !uuidSchema.safeParse(courseId).success) return NextResponse.redirect(fallback);
  const article = await getNewsArticle(slug);
  const course = article?.courses.find((c) => c.id === courseId);
  if (!article || !course) return NextResponse.redirect(new URL(article ? `/actualites/${slug}` : "/actualites", request.url));
  await recordNewsEvent(slug, "course", courseId);
  return NextResponse.redirect(new URL(course.accessible ? `/espace/formations/${course.id}` : `/formations/${course.id}`, request.url));
}
