"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/components/toast-provider";

// Web Push uses base64url for VAPID public keys; the browser PushManager
// wants a Uint8Array. This helper converts and pads correctly.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed" | "missing_key";

export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (!publicKey) {
      setStatus("missing_key");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        setStatus(existing ? "subscribed" : "unsubscribed");
      } catch (err) {
        console.error("Service worker registration failed:", err);
        setStatus("unsupported");
      }
    })();
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        notify("Notification permission denied.", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: DOM type wants `BufferSource` with ArrayBuffer-backed views
        // but Uint8Array's underlying buffer is `ArrayBufferLike` in newer
        // TS lib defs — the runtime is fine, this is just appeasing types.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        await subscription.unsubscribe();
        notify("Couldn't save push subscription. Try again.", "error");
        return;
      }
      setStatus("subscribed");
      notify("Push notifications enabled.", "success");
    } catch (err) {
      console.error("Push enable failed:", err);
      notify("Couldn't enable push notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
      notify("Push notifications turned off.", "success");
    } catch (err) {
      console.error("Push disable failed:", err);
      notify("Couldn't turn off push notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-xs text-zinc-400">
        Checking push support…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-xs text-zinc-500">
        Your browser doesn&apos;t support push notifications.
      </div>
    );
  }

  if (status === "missing_key") {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-200">
        Push notifications aren&apos;t configured on this deployment yet.
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-xs text-zinc-500">
        You blocked notifications for this site. Re-enable in your browser&apos;s site settings.
      </div>
    );
  }

  const subscribed = status === "subscribed";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
      <div className="shrink-0">
        {subscribed ? (
          <Bell className="h-4 w-4 text-acl-orange mt-0.5" />
        ) : (
          <BellOff className="h-4 w-4 text-zinc-400 mt-0.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
          Push notifications
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {subscribed
            ? "On for this device. New Brand Vault drops will ping you here."
            : "Get a ping when a new brand drops in your Vault."}
        </p>
      </div>
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
          subscribed
            ? "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            : "bg-acl-orange text-white hover:bg-acl-orange/90"
        }`}
      >
        {busy ? "…" : subscribed ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
