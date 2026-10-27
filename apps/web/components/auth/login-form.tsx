"use client";

import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authErrorMessage, postJson } from "@/lib/auth/client";

type OptionsResponse = {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setError(null);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("Browser ini belum mendukung passkey.");
      }

      const { challengeId, options } = await postJson<OptionsResponse>(
        "/api/auth/login/options",
        {},
      );

      const response = await startAuthentication({ optionsJSON: options });

      await postJson("/api/auth/login/verify", { challengeId, response });

      router.replace("/app");
      router.refresh();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error === null ? null : (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button className="w-full" size="lg" onClick={onSignIn} disabled={busy}>
        {busy ? "Menunggu passkey…" : "Masuk dengan passkey"}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Tidak ada kata sandi. Browser akan meminta sidik jari, wajah, atau PIN perangkatmu.
      </p>
    </div>
  );
}
