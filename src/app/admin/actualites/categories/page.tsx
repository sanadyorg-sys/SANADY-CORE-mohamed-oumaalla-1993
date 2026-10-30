import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewsCategoryManager } from "@/components/admin/news-forms";
import { Card, CardBody, PageHeader } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/server/auth";
import { getNewsCategories } from "@/server/queries/news";

export const metadata: Metadata = { title: "Catégories d’actualités" };

export default async function NewsCategoriesPage() {
  await requireStaff(["admin"]);
  const supabase = await createClient();
  const [categories, { data }] = await Promise.all([
    getNewsCategories(),
    supabase.from("news_articles").select("category_id").not("category_id", "is", null).limit(5000),
  ]);
  const usage: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ category_id: string }>) usage[r.category_id] = (usage[r.category_id] ?? 0) + 1;
  return (
    <>
      <Link href="/admin/actualites" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Actualités
      </Link>
      <PageHeader
        title="Catégories d’actualités"
        description="L’ordre ci-dessous est celui des filtres de la page Actualités. L’adresse d’une catégorie ne change pas quand on la renomme."
      />
      <Card className="max-w-4xl">
        <CardBody>
          <NewsCategoryManager categories={categories} usage={usage} />
        </CardBody>
      </Card>
    </>
  );
}
