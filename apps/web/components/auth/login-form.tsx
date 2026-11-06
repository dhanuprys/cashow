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

export function LoginForm({
  hasExistingUser,
  googleAuthEnabled,
}: {
  hasExistingUser: boolean;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const usernameId = useId();
  const passwordId = useId();

  // Get returnTo from window if present for Google OAuth link
  const [mode, setMode] = useState<LoginMode>(hasExistingUser ? "passkey" : "password");
  const returnToParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")
      : null;
  const googleAuthHref = returnToParam
    ? `/api/auth/google?returnTo=${encodeURIComponent(returnToParam)}`
    : "/api/auth/google";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("error");
    }
    return null;
  });

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function enterApp() {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      if (returnTo?.startsWith("/app")) {
        router.replace(returnTo);
        router.refresh();
        return;
      }
    }
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
        identifier: identifier.trim(),
        username: identifier.trim(),
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
              Username atau Email
            </label>
            <input
              className={cn(inputClass, "mt-1.5")}
              id={usernameId}
              name="identifier"
              type="text"
              autoComplete="username"
              required
              maxLength={128}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username atau alamat email"
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

      {/* Google OAuth Option */}
      {googleAuthEnabled && (
        <div className="space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="bg-card px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground absolute">
              atau
            </span>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2.5"
            type="button"
            render={<a href={googleAuthHref} />}
          >
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Masuk dengan Google
          </Button>
        </div>
      )}

      {/* Microcopy trust indicator */}
      <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" weight="fill" />
        <span>Sesi aman dan terenkripsi langsung di perangkat.</span>
      </div>
    </div>
  );
}
