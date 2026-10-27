"use client";

import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

function formatDate(value: string | null): string {
  if (value === null) return "Belum pernah dipakai";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function PasskeyManager() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await refresh();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(passkey: Passkey) {
    const label = passkey.name ?? "passkey ini";
    if (!window.confirm(`Cabut ${label}? Perangkat itu tidak akan bisa masuk lagi.`)) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkeys/${passkey.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Gagal mencabut passkey.");
      await refresh();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Passkey</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Perangkat yang boleh masuk ke akun ini.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addPasskey} disabled={busy}>
          Tambah passkey
        </Button>
      </div>

      {error === null ? null : (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {passkeys === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{passkey.name ?? "Passkey"}</p>
                <p className="text-xs text-muted-foreground">
                  Ditambahkan {formatDate(passkey.createdAt)} · Terakhir dipakai{" "}
                  {formatDate(passkey.lastUsedAt)}
                  {passkey.backedUp ? " · Tersinkron" : ""}
                </p>
              </div>
              <Button variant="ghost" size="xs" onClick={() => revoke(passkey)} disabled={busy}>
                Cabut
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
