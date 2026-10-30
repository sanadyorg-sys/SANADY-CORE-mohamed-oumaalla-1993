import { Skeleton } from "@/components/ui/feedback";

/** News page skeleton (same layout as the page: header band, featured article, card grid). */
export default function NewsLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement des actualités">
      <div className="border-b border-line bg-ink-25">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-5 w-[36rem] max-w-full" />
          <Skeleton className="h-12 w-[42rem] max-w-full rounded-xl" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-32 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="mb-12 h-80 w-full rounded-3xl" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
