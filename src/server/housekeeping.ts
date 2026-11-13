import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushNotifications } from "@/server/notifications";
import { purgeExpiredRequests } from "@/server/queries/enterprise";

/**
 * Daily housekeeping, run by the scheduled job (/api/cron/daily) and, as a
 * fallback, when the Enterprise team opens its inbox:
 *  - last month's usage reading for every running company space;
 *  - deletions CONFIRMED by a second person whose 30 days have passed (the
 *    database re-checks every condition at that moment), then their files;
 *  - the retention purge of old enterprise requests;
 *  - the day's e-mail reminders, then whatever is left in the e-mail outbox.
 * Nothing here decides a deletion: it only carries out what people confirmed.
 */
export async function runHousekeeping() {
  const admin = createAdminClient();
  const [{ data: readings, error: readErr }, { data: done, error: delErr }] = await Promise.all([
    admin.rpc("auto_record_usage"),
    admin.rpc("execute_due_deletions"),
  ]);
  if (readErr) console.error("[housekeeping] usage", readErr.message);
  if (delErr) console.error("[housekeeping] deletions", delErr.message);
  let files = 0;
  let filesFailed = 0;
  // The rows are already gone: a failed removal is retried once, then logged
  // with the paths so the files can be removed by hand.
  const removeWithRetry = async (bucket: string, paths: string[]) => {
    let { error } = await admin.storage.from(bucket).remove(paths);
    if (error) ({ error } = await admin.storage.from(bucket).remove(paths));
    if (error) console.error(`[housekeeping] ${bucket} not removed`, error.message, JSON.stringify(paths));
    return !error;
  };
  for (const d of (done ?? []) as Array<{ files: string[]; logo: string | null }>) {
    for (let i = 0; i < d.files.length; i += 100) {
      const batch = d.files.slice(i, i + 100);
      if (await removeWithRetry("course-media", batch)) files += batch.length;
      else filesFailed += batch.length;
    }
    if (d.logo && !(await removeWithRetry("enterprise-logos", [d.logo]))) filesFailed += 1;
  }
  const purged = await purgeExpiredRequests().catch((e) => {
    console.error("[housekeeping] retention", e);
    return 0;
  });
  const { data: reminders, error: remErr } = await admin.rpc("queue_daily_notifications");
  if (remErr) console.error("[housekeeping] reminders", remErr.message);
  // Actualités programmées dont l'heure est passée : e-mail à leur public.
  const { data: news, error: newsErr } = await admin.rpc("queue_due_news_emails");
  if (newsErr) console.error("[housekeeping] news e-mails", newsErr.message);
  const emails = await flushNotifications(100);
  return { readings: (readings as number) ?? 0, deletions: ((done ?? []) as unknown[]).length, files, filesFailed, purged, reminders: (reminders as number) ?? 0, news: (news as number) ?? 0, emails };
}
