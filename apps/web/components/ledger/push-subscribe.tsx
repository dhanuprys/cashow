"use client";

import { Bell, BellOff } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  markNotificationReadAction,
  snoozeNotificationAction,
  subscribePushAction,
} from "@/lib/actions/ledger";
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

/** Mark-read and snooze controls rendered next to each inbox item. */
export function NotificationActions({ id, read }: { id: string; read: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {read ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <BellOff className="size-3" aria-hidden="true" />
          Sudah dibaca
        </span>
      ) : (
        <form action={markNotificationReadAction}>
          <input type="hidden" name="notificationId" value={id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Bell className="size-3" aria-hidden="true" />
            Tandai dibaca
          </button>
        </form>
      )}
      <form action={snoozeNotificationAction} className="flex items-center gap-1">
        <input type="hidden" name="notificationId" value={id} />
        <input type="hidden" name="minutes" value="60" />
        <button type="submit" className="text-[11px] text-muted-foreground hover:text-foreground">
          Tunda 1 jam
        </button>
      </form>
    </div>
  );
}
