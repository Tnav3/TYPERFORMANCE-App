"use client";
// Turn on push notifications for this device (with iPhone home-screen guidance).
import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/app/notifications/actions";

type State = "checking" | "unsupported" | "ios-needs-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushSetup({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-needs-install" : "unsupported");
        return;
      }
      if (ios && !standalone) return setState("ios-needs-install");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    if (!vapidKey) return setError("Notifications aren't set up on the server yet.");
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent });
      if (!r.ok) setError(r.error);
      else setState("on");
    } catch {
      setError("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  const btn = "min-h-12 w-full rounded-xl font-extrabold uppercase tracking-wide";
  return (
    <div>
      {state === "checking" && <p className="text-muted">Checking this device…</p>}
      {state === "ios-needs-install" && (
        <div className="space-y-2 text-sm">
          <p className="font-bold">On iPhone, add the app to your Home Screen first:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Tap the Share button in Safari (square with an arrow).</li>
            <li>Tap <span className="font-bold">Add to Home Screen</span>, then Add.</li>
            <li>Open TYPERFORMANCE from your Home Screen and come back to this page.</li>
          </ol>
          <p className="text-muted">Apple only allows notifications for web apps opened from the Home Screen (iOS 16.4 or later).</p>
        </div>
      )}
      {state === "unsupported" && <p className="text-muted">This browser can&apos;t receive notifications. Try Chrome on Android or the Home Screen app on iPhone.</p>}
      {state === "denied" && (
        <p className="text-sm text-muted">Notifications are blocked for this app. Turn them on in your phone&apos;s Settings → Notifications, then reload.</p>
      )}
      {state === "off" && (
        <button onClick={enable} disabled={busy} className={`${btn} bg-brand text-white disabled:opacity-60`}>
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
      {state === "on" && (
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold text-ok">On for this device ✓</p>
          <button onClick={disable} disabled={busy} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold">
            Turn off
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
