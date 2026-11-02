"use client";

import { Bell, BellOff } from "lucide-react";
import { useActionState, useState } from "react";
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
  const [localError, setLocalError] = useState<string | null>(null);
  const errorText = localError ?? (state.status === "error" ? state.message : null);

  async function enable() {
    setLocalError(null);
    if (vapidPublicKey === "") {
      setLocalError("Kunci publik VAPID belum dikonfigurasi di server.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLocalError("Browser ini tidak mendukung notifikasi push.");
      return;
    }
    try {
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
    } catch {
      setLocalError("Izin notifikasi ditolak atau langganan gagal dibuat.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">Push notification</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Aktifkan notifikasi push di perangkat ini.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={enable}>
          Aktifkan push
        </Button>
        <span aria-live="polite">
          {state.status === "success" ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">Aktif.</span>
          ) : null}
          {errorText === null ? null : (
            <span className="text-xs text-destructive">{errorText}</span>
          )}
        </span>
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
            className="inline-flex min-h-9 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Bell className="size-3" aria-hidden="true" />
            Tandai dibaca
          </button>
        </form>
      )}
      <form action={snoozeNotificationAction} className="flex items-center gap-1">
        <input type="hidden" name="notificationId" value={id} />
        <input type="hidden" name="minutes" value="60" />
        <button
          type="submit"
          className="inline-flex min-h-9 items-center text-[11px] text-muted-foreground hover:text-foreground"
        >
          Tunda 1 jam
        </button>
      </form>
    </div>
  );
}
