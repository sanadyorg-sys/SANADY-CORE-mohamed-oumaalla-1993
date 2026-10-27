"use client";

import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/browser";

const CHUNK_SIZE = 6 * 1024 * 1024; // Required by Supabase resumable uploads.

export interface UploadHandle<T = void> {
  promise: Promise<T>;
  abort: () => void;
}

/** A refusal whose message is meant for the user (e.g. returned by the server). */
export class UploadRefused extends Error {}

export interface BunnyUploadTicket {
  videoId: string;
  libraryId: string;
  expires: number;
  signature: string;
}

/**
 * Resumable (TUS) upload straight to Bunny Stream. The server first creates
 * the video and returns a signed ticket for it (the API key stays on the
 * server); the promise resolves with the Bunny video ID.
 */
export function uploadToBunny({
  file,
  getTicket,
  onProgress,
}: {
  file: File;
  getTicket: () => Promise<{ ok: true; ticket: BunnyUploadTicket } | { ok: false; message: string }>;
  onProgress?: (ratio: number) => void;
}): UploadHandle<string> {
  let upload: Upload | null = null;
  let aborted = false;

  const promise = (async () => {
    const res = await getTicket();
    if (!res.ok) throw new UploadRefused(res.message);
    const { ticket } = res;
    await new Promise<void>((resolve, reject) => {
      if (aborted) return reject(new Error("Téléversement annulé."));
      upload = new Upload(file, {
        endpoint: "https://video.bunnycdn.com/tusupload",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 50 * 1024 * 1024,
        headers: {
          AuthorizationSignature: ticket.signature,
          AuthorizationExpire: String(ticket.expires),
          VideoId: ticket.videoId,
          LibraryId: ticket.libraryId,
        },
        metadata: { filetype: fileType(file) || "application/octet-stream", title: file.name },
        // Each attempt targets a new Bunny video: never resume an older one.
        storeFingerprintForResuming: false,
        onError: (error) => reject(error),
        onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
        onSuccess: () => resolve(),
      });
      upload.start();
    });
    return ticket.videoId;
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      void (upload as Upload | null)?.abort(true);
    },
  };
}

/**
 * Resumable (TUS) upload to Supabase Storage with the administrator's
 * session. Storage RLS decides whether the upload is allowed. Interrupted
 * uploads resume automatically; large videos are supported.
 */
export function uploadToStorage({
  bucket,
  path,
  file,
  onProgress,
}: {
  bucket: "course-media" | "course-covers" | "library";
  path: string;
  file: File;
  onProgress?: (ratio: number) => void;
}): UploadHandle {
  let upload: Upload | null = null;
  let aborted = false;

  const promise = (async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expirée : reconnectez-vous.");

    await new Promise<void>((resolve, reject) => {
      upload = new Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: CHUNK_SIZE,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: fileType(file) || "application/octet-stream",
          cacheControl: "3600",
        },
        onError: (error) => reject(error),
        onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
        onSuccess: () => resolve(),
      });
      if (aborted) return reject(new Error("Téléversement annulé."));
      upload.findPreviousUploads().then((previous) => {
        if (previous[0]) upload!.resumeFromPreviousUpload(previous[0]);
        upload!.start();
      });
    });
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      void (upload as Upload | null)?.abort(true);
    },
  };
}

/** Canonical type per extension: the storage buckets accept these exact values. */
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  zip: "application/zip",
};

/** Types browsers report for the same formats (Windows reports ZIP as x-zip-compressed). */
const TYPE_ALIASES: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

/**
 * The file's type as the storage bucket expects it. Browsers sometimes send an
 * alias or nothing at all (Windows without the matching software installed):
 * fall back to the extension.
 */
export function fileType(file: File): string {
  const reported = TYPE_ALIASES[file.type] ?? file.type;
  if (reported && reported !== "application/octet-stream") return reported;
  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  return TYPE_BY_EXTENSION[ext] ?? reported ?? "";
}

/** Safe object name: keeps the extension, removes accents and spaces. */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const id = crypto.randomUUID().slice(0, 8);
  return `${id}-${base || "fichier"}${ext ? `.${ext}` : ""}`;
}

/** Reads a local video file's duration (seconds) without uploading it. */
export function readVideoDuration(file: File, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;
    // Some codecs never report metadata: give up after a while (duration stays unknown).
    const finish = (d: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(d && d > 0 ? d : null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}
