"use client";

import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authErrorMessage, postJson } from "@/lib/auth/client";

type OptionsResponse = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function SetupForm({ setupTokenRequired }: { setupTokenRequired: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("Browser ini belum mendukung passkey.");
      }

      const { challengeId, options } = await postJson<OptionsResponse>(
        "/api/auth/register/options",
        {
          name,
          email,
          setupToken: setupToken === "" ? undefined : setupToken,
        },
      );

      const response = await startRegistration({ optionsJSON: options });

      await postJson("/api/auth/register/verify", { challengeId, response });

      router.replace("/app");
      router.refresh();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="text-sm font-medium" htmlFor="setup-name">
          Nama
        </label>
        <input
          className={inputClass}
          id="setup-name"
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nama kamu"
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="setup-email">
          Email <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <input
          className={inputClass}
          id="setup-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={200}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="kamu@contoh.id"
        />
      </div>

      {setupTokenRequired ? (
        <div>
          <label className="text-sm font-medium" htmlFor="setup-token">
            Token setup
          </label>
          <input
            className={inputClass}
            id="setup-token"
            name="setup-token"
            type="password"
            autoComplete="off"
            required
            value={setupToken}
            onChange={(event) => setSetupToken(event.target.value)}
            placeholder="Dari SETUP_TOKEN di server"
          />
        </div>
      ) : null}

      {error === null ? null : (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button className="w-full" size="lg" type="submit" disabled={busy}>
        {busy ? "Menunggu passkey…" : "Buat passkey pemilik"}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Passkey menggantikan kata sandi. Setelah dibuat, masuk hanya bisa lewat perangkat ini atau
        passkey lain yang kamu tambahkan.
      </p>
    </form>
  );
}
