"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { subscribePushAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushSubscribe({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    subscribePushAction,
    initialActionState,
  );

  async function enable() {
    if (vapidPublicKey === "") {
      alert("VAPID public key belum dikonfigurasi.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Browser ini tidak mendukung push.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    const formData = new FormData();
    formData.set("endpoint", json.endpoint ?? "");
    formData.set("p256dh", json.keys?.p256dh ?? "");
    formData.set("auth", json.keys?.auth ?? "");
    formData.set("label", navigator.userAgent.slice(0, 80));
    formAction(formData);
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">Push notification</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Aktifkan notifikasi push di perangkat ini.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" onClick={enable}>
          Aktifkan push
        </Button>
        {state.status === "success" ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Aktif.</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-xs text-destructive">{state.message}</span>
        ) : null}
      </div>
    </div>
  );
}
