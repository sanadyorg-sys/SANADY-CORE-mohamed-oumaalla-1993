import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewsArticleForm } from "@/components/admin/news-forms";
import { Card, CardBody, PageHeader } from "@/components/ui/surface";
import { requireStaff } from "@/server/auth";
import { getNewsCategories, newsFormOptions } from "@/server/queries/news";

export const metadata: Metadata = { title: "Nouvel article" };

export default async function NewNewsArticlePage() {
  const viewer = await requireStaff(["admin", "manager", "partners"]);
  const [categories, options] = await Promise.all([getNewsCategories(), newsFormOptions()]);
  return (
    <>
      <Link href="/admin/actualites" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Actualités
      </Link>
      <PageHeader title="Nouvel article" description="Rédigez le brouillon ; vous ajouterez ensuite l’image de couverture, puis l’article sera publié ou programmé." />
      <Card className="max-w-4xl">
        <CardBody>
          <NewsArticleForm categories={categories} {...options} canPublish={viewer.isSanadyAdmin} />
        </CardBody>
      </Card>
    </>
  );
}
