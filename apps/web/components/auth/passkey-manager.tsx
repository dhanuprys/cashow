"use client";

import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import {
  AlertTriangle,
  Cloud,
  Fingerprint,
  KeyRound,
  Laptop,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { authErrorMessage, postJson } from "@/lib/auth/client";

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type OptionsResponse = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null): string {
  if (value === null) return "Belum pernah dipakai";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function getPasskeyIcon(passkey: Passkey) {
  const name = (passkey.name ?? "").toLowerCase();
  if (name.includes("iphone") || name.includes("android") || name.includes("phone")) {
    return Smartphone;
  }
  if (name.includes("mac") || name.includes("windows") || name.includes("pc")) {
    return Laptop;
  }
  if (passkey.backedUp) {
    return Cloud;
  }
  return Fingerprint;
}

export function PasskeyManager() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<Passkey | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/passkeys", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await response.json()) as { passkeys?: Passkey[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Gagal memuat passkey.");
      setPasskeys(data.passkeys ?? []);
    } catch (caught) {
      setError(authErrorMessage(caught));
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addPasskey() {
    setBusy(true);
    setError(null);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("Browser ini belum mendukung passkey.");
      }

      const { challengeId, options } = await postJson<OptionsResponse>(
        "/api/auth/register/options",
        {},
      );
      const response = await startRegistration({ optionsJSON: options });
      await postJson("/api/auth/register/verify", { challengeId, response });
      toast.add({
        title: "Passkey Berhasil Didaftarkan",
        description: "Perangkat ini sekarang dapat digunakan untuk masuk.",
      });
      await refresh();
    } catch (caught) {
      const message = authErrorMessage(caught);
      setError(message);
      toast.add({
        title: "Gagal Mendaftarkan Passkey",
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(passkey: Passkey) {
    setToRevoke(passkey);
  }

  async function confirmRevoke() {
    const passkey = toRevoke;
    if (passkey === null) return;
    setToRevoke(null);

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkeys/${passkey.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Gagal mencabut passkey.");
      toast.add({
        title: "Passkey Dicabut",
        description: `Passkey "${passkey.name ?? "Perangkat"}" telah dihapus.`,
      });
      await refresh();
    } catch (caught) {
      const message = authErrorMessage(caught);
      setError(message);
      toast.add({
        title: "Gagal Mencabut Passkey",
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  const isSolePasskey = (passkeys?.length ?? 0) <= 1;

  return (
    <div className="space-y-5">
      {/* Top action & status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">
            {passkeys === null ? "Memeriksa perangkat..." : `${passkeys.length} passkey aktif`}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPasskey}
          disabled={busy}
          className="gap-1.5 text-xs font-medium"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {busy ? "Menghubungkan..." : "Tambah Passkey Baru"}
        </Button>
      </div>

      {/* Security Info Callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
        <KeyRound className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Passkey menggunakan standar FIDO2 / WebAuthn. Kunci privat tersimpan di perangkat keras
          (Secure Enclave / TPM / Biometrik) Anda, tidak pernah dikirim ke server, dan kebal dari
          serangan phishing maupun kebocoran kredensial.
        </p>
      </div>

      {error !== null ? (
        <div
          className="rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Loading Skeleton */}
      {passkeys === null ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-border/60 p-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-48 rounded bg-muted/70" />
                </div>
              </div>
              <div className="h-8 w-16 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      ) : passkeys.length === 0 ? (
        <Empty className="border border-dashed border-border py-8">
          <EmptyHeader>
            <KeyRound className="size-8 text-muted-foreground" aria-hidden="true" />
            <EmptyTitle>Belum ada passkey terdaftar</EmptyTitle>
            <EmptyDescription>
              Tambahkan biometrik perangkat ini (Face ID, Touch ID, Windows Hello) atau kunci
              keamanan fisik untuk masuk secara instan tanpa perlu password.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={addPasskey}
              disabled={busy}
              className="gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Daftarkan Passkey Sekarang
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border bg-card/50 overflow-hidden">
          {passkeys.map((passkey) => {
            const Icon = getPasskeyIcon(passkey);

            return (
              <div
                key={passkey.id}
                className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {passkey.name ?? "Kunci Keamanan"}
                      </p>
                      {passkey.backedUp && (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                          <Cloud className="size-2.5" aria-hidden="true" />
                          Tersinkron Cloud
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>Ditambahkan {formatDate(passkey.createdAt)}</span>
                      <span>•</span>
                      <span>Terakhir: {formatDate(passkey.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="self-end sm:self-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(passkey)}
                    disabled={busy}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Cabut
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revocation Warning Alert Dialog */}
      <AlertDialog
        open={toRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setToRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
              Cabut {toRevoke?.name ?? "Passkey ini"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1">
              <p>
                Perangkat ini tidak akan dapat digunakan lagi untuk masuk ke akun Anda secara
                langsung.
              </p>
              {isSolePasskey && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    Perhatian: Ini adalah satu-satunya passkey yang terdaftar. Sangat disarankan
                    untuk menambahkan passkey cadangan sebelum mencabut passkey ini agar Anda tidak
                    kehilangan akses masuk.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void confirmRevoke()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Cabut Kunci
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
