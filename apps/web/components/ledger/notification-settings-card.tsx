"use client";

import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Info,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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

const NOTIFICATION_CHANNELS = [
  {
    icon: PiggyBank,
    title: "Peringatan Batas Anggaran",
    description:
      "Menerima pemberitahuan seketika saat pengeluaran kategori mendekati atau melampaui limit bulanan.",
  },
  {
    icon: CalendarClock,
    title: "Jadwal Transaksi Berulang",
    description:
      "Pengingat otomatis saat tagihan rutin, cicilan, atau pendapatan terjadwal jatuh tempo.",
  },
  {
    icon: ShieldCheck,
    title: "Aktivitas Keamanan Akun",
    description:
      "Pemberitahuan saat ada pendaftaran passkey baru atau perubahan penting pada profil akun Anda.",
  },
];

export function NotificationSettingsCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    subscribePushAction,
    initialActionState,
  );
  const [permission, setPermission] = useState<string>("default");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      setPermission("granted");
      toast.add({
        title: "Notifikasi Diaktifkan",
        description: "Perangkat ini sekarang terhubung untuk menerima notifikasi penting.",
      });
    }
  }, [state]);

  async function handleEnablePush() {
    setLocalError(null);
    setBusy(true);

    if (!vapidPublicKey) {
      setLocalError("Layanan push notification belum diatur pada konfigurasi server.");
      setBusy(false);
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLocalError("Peramban ini tidak mendukung standar Web Push Notifications.");
      setBusy(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
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
      setLocalError("Izin notifikasi ditolak oleh peramban atau langganan tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  const isGranted = permission === "granted" || state.status === "success";
  const isDenied = permission === "denied";

  return (
    <div className="space-y-6">
      {/* Device Push Subscription Status */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Notifikasi Web Push Perangkat Ini
              </p>
              {isGranted ? (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  Aktif
                </Badge>
              ) : isDenied ? (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <AlertCircle className="size-3" aria-hidden="true" />
                  Izin Diblokir
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Belum Aktif
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Menerima notifikasi instan langsung di peramban tanpa perlu membuka aplikasi secara
              terus-menerus.
            </p>
          </div>
        </div>

        <div className="self-start sm:self-center shrink-0">
          {!isGranted && (
            <Button
              type="button"
              size="sm"
              onClick={handleEnablePush}
              disabled={busy || isDenied}
              className="gap-1.5 text-xs font-medium"
            >
              <Bell className="size-3.5" aria-hidden="true" />
              {busy ? "Menghubungkan..." : "Aktifkan di Perangkat Ini"}
            </Button>
          )}
        </div>
      </div>

      {localError && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{localError}</span>
        </div>
      )}

      {/* Notification Channels List */}
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Kategori Pemberitahuan
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {NOTIFICATION_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.title}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{channel.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {channel.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Helpful Hint */}
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
        <Info className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          Izin notifikasi dikelola secara mandiri oleh setiap peramban perangkat. Jika sebelumnya
          pernah diblokir, Anda dapat mengaktifkannya kembali melalui ikon gembok pada bilah alamat
          peramban.
        </p>
      </div>
    </div>
  );
}
