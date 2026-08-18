"use client";

import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "denied" | "subscribed" | "idle";

export function PushSubscribeButton({ label = "Enable push alerts" }: { label?: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "idle");
      });
    }).catch(() => setState("unsupported"));
  }, []);

  const subscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!res.ok) throw new Error("subscribe API failed");
      setState("subscribed");
    } catch (err) {
      console.error("push subscribe error", err);
      setState("idle");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("subscribed");
    }
  };

  if (state === "unsupported") return null;

  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-400">
        <span className="h-3 w-3 animate-spin rounded-full border border-stone-300 border-t-stone-500" />
        Checking…
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
        🔕 Notifications blocked — enable in browser settings
      </span>
    );
  }

  if (state === "subscribed") {
    return (
      <button
        type="button"
        onClick={unsubscribe}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
        title="Click to turn off push notifications on this device"
      >
        🔔 Push alerts on — tap to turn off
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      title="Get a notification even when this tab is closed or the screen is off"
    >
      🔔 {label}
    </button>
  );
}
