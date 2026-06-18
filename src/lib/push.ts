import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// VAPID details are required by the Web Push protocol. Configured lazily
// so this module doesn't blow up at import time in environments where
// the keys aren't set (e.g. a local dev session running without push).
let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@athletecreatorlab.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  // Pathname (not full URL); the service worker focuses an existing tab
  // at this path if one is open, otherwise opens a new window.
  url?: string;
  // Optional notification tag — pushes with the same tag collapse on screen.
  tag?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  cleaned: number;
}

export async function pushToAthletes(
  athleteIds: string[],
  payload: PushPayload,
): Promise<PushResult> {
  if (athleteIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };
  if (!configure()) return { sent: 0, failed: 0, cleaned: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("athlete_id", athleteIds);
  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  const json = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        json,
      );
      sent += 1;
    } catch (err) {
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : 0;
      // 404 / 410 = subscription is gone (uninstalled, browser cleared, etc).
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        cleaned += 1;
      } else {
        console.error("Push send failed:", err);
        failed += 1;
      }
    }
  }
  return { sent, failed, cleaned };
}
