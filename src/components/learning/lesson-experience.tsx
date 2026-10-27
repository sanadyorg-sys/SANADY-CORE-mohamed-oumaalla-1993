"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { Download, FileText, PlayCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import type { ProgressUpdate } from "@/lib/types";
import { VideoPlayer } from "./video-player";

const PdfReader = dynamic(() => import("./pdf-reader"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[1/1.2] w-full" />,
});

export type LessonMedia =
  | { kind: "video"; source: { type: "mp4" | "hls"; url: string; poster?: string } }
  | { kind: "pdf"; url: string; pageCount: number; downloadUrl?: string | null }
  | { kind: "unavailable"; message: string; /** Keeps the media's frame (16:9 or page) in the layout. */ lessonKind?: "video" | "pdf" };

/**
 * Hosts the lesson media and reacts to progress updates from the server
 * (completion notice, curriculum refresh, certificate announcement).
 * In preview mode (administrators) no progress is recorded.
 */
export function LessonExperience({
  lessonId,
  media,
  resumePosition,
  watchedBuckets,
  pagesViewed,
  completionThreshold,
  preview = false,
}: {
  lessonId: string;
  media: LessonMedia;
  resumePosition: number;
  watchedBuckets: number[];
  pagesViewed: number[];
  completionThreshold: number;
  preview?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const announced = useRef(false);

  const onProgress = useCallback(
    (update: ProgressUpdate) => {
      if (update.lesson_completed_now && !announced.current) {
        announced.current = true;
        toast({ tone: "success", title: "Leçon terminée", description: "Votre progression a été enregistrée." });
        router.refresh();
      }
      if (update.certificate_issued) {
        toast({
          tone: "success",
          title: "Formation terminée",
          description: "Félicitations ! Votre certificat est disponible dans « Mes certificats ».",
        });
      }
    },
    [router, toast],
  );

  if (media.kind === "unavailable") {
    if (!media.lessonKind) return <Alert tone="warning" title="Contenu indisponible">{media.message}</Alert>;
    const video = media.lessonKind === "video";
    const Icon = video ? PlayCircle : FileText;
    return (
      <div
        role="status"
        className={
          video
            ? "relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-brand-900 p-6 text-center text-white"
            : "relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink-50 p-6 text-center sm:aspect-[16/10]"
        }
      >
        {video ? <div aria-hidden className="absolute inset-0 bg-dots-light opacity-60" /> : null}
        <span className={video ? "relative flex size-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20" : "flex size-16 items-center justify-center rounded-2xl bg-surface text-ink-500 shadow-sm ring-1 ring-line"}>
          <Icon className="size-7" aria-hidden />
        </span>
        <p className={video ? "relative mt-4 max-w-md text-body text-white/80" : "mt-4 max-w-md text-body text-ink-600"}>{media.message}</p>
      </div>
    );
  }

  if (media.kind === "video") {
    return (
      <VideoPlayer
        lessonId={lessonId}
        source={media.source}
        resumePosition={preview ? 0 : resumePosition}
        initialBuckets={watchedBuckets}
        completionThreshold={completionThreshold}
        onProgress={preview ? undefined : onProgress}
        trackProgress={!preview}
      />
    );
  }

  return (
    <div className="space-y-3">
      {media.downloadUrl ? (
        <div className="flex justify-end">
          <a href={media.downloadUrl} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Download aria-hidden /> Télécharger le document
          </a>
        </div>
      ) : null}
      <PdfReader
        lessonId={lessonId}
        url={media.url}
        pageCount={media.pageCount}
        resumePage={preview ? 1 : resumePosition}
        initialViewed={pagesViewed}
        completionThreshold={completionThreshold}
        onProgress={preview ? undefined : onProgress}
        trackProgress={!preview}
      />
    </div>
  );
}
