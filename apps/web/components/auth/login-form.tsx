"use client";

import {
  ArrowRight,
  Eye,
  EyeSlash,
  Fingerprint,
  Key,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { authErrorMessage, postJson } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type OptionsResponse = {
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};

type LoginMode = "passkey" | "password";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 sm:h-10";

export function LoginForm({ hasExistingUser }: { hasExistingUser: boolean }) {
  const router = useRouter();
  const usernameId = useId();
  const passwordId = useId();

  const [mode, setMode] = useState<LoginMode>(hasExistingUser ? "passkey" : "password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function enterApp() {
    router.replace("/app");
    router.refresh();
  }

  async function signInWithPasskey() {
    setBusy(true);
    setError(null);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error(
          "Browser ini belum mendukung passkey. Silakan masuk menggunakan username dan kata sandi.",
        );
      }

      const { challengeId, options } = await postJson<OptionsResponse>(
        "/api/auth/login/options",
        {},
      );

      const response = await startAuthentication({ optionsJSON: options });
      await postJson("/api/auth/login/verify", { challengeId, response });

      enterApp();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await postJson(hasExistingUser ? "/api/auth/login/password" : "/api/auth/register/password", {
        username: username.trim(),
        password,
      });
      enterApp();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan saat masuk.");
      setBusy(false);
    }
  }

  if (!hasExistingUser) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkle className="size-4 text-primary" weight="fill" />
            Inisialisasi Buku Kas
          </div>
          <p className="mt-1">
            Belum ada akun yang terdaftar di peladen ini. Daftarkan akun pemilik pertamamu untuk
            mulai mencatat keuangan.
          </p>
        </div>

        <Link
          href="/setup"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Siapkan Akun Pemilik Sekarang
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Method segmented selector */}
      <div className="grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("passkey");
            setError(null);
          }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-200",
            mode === "passkey"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Fingerprint className="size-4" weight="bold" />
          Passkey
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-200",
            mode === "password"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Key className="size-4" weight="bold" />
          Kata Sandi
        </button>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Passkey Panel */}
      {mode === "passkey" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="text-foreground font-medium">Autentikasi Perangkat</p>
            <p className="mt-1 text-[11px]">
              Browser akan meminta verifikasi biometrik seperti sidik jari, pengenalan wajah, atau
              PIN layar perangkatmu.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            type="button"
            onClick={signInWithPasskey}
            disabled={busy}
          >
            <Fingerprint className="size-4.5" weight="fill" />
            {busy ? "Menghubungkan sensor…" : "Masuk dengan Passkey"}
          </Button>
        </div>
      )}

      {/* Password Panel */}
      {mode === "password" && (
        <form className="space-y-4" onSubmit={submitPassword}>
          <div>
            <label className="block text-xs font-semibold text-foreground" htmlFor={usernameId}>
              Username
            </label>
            <input
              className={cn(inputClass, "mt-1.5")}
              id={usernameId}
              name="username"
              type="text"
              autoComplete="username"
              required
              maxLength={64}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username akunmu"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground" htmlFor={passwordId}>
              Kata Sandi
            </label>
            <div className="relative mt-1.5 flex items-center">
              <input
                className={cn(inputClass, "pr-11")}
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <EyeSlash className="size-4 shrink-0" />
                ) : (
                  <Eye className="size-4 shrink-0" />
                )}
              </button>
            </div>
          </div>

          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            {busy ? "Memverifikasi…" : "Masuk ke Akun"}
          </Button>
        </form>
      )}

      {/* Microcopy trust indicator */}
      <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" weight="fill" />
        <span>Sesi aman dan terenkripsi langsung di perangkat.</span>
      </div>
    </div>
  );
}
