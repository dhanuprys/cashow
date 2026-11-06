"use client";

import {
  Check,
  Eye,
  EyeSlash,
  Fingerprint,
  Key,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { authErrorMessage, postJson } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type OptionsResponse = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

type RegisterMode = "passkey" | "password";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 sm:h-10";

export function SetupForm({
  setupTokenRequired,
  googleAuthEnabled,
}: {
  setupTokenRequired: boolean;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const tokenId = useId();

  const [mode, setMode] = useState<RegisterMode>("passkey");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [avatar, setAvatar] = useState("alex");
  const [bio, setBio] = useState("");

  // Passkey form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Password form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Setup token (if required by environment)
  const [setupToken, setSetupToken] = useState("");

  // Password strength calculation
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 6,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    };
  }, [password]);

  const passwordStrengthScore = useMemo(() => {
    let score = 0;
    if (passwordCriteria.minLength) score += 1;
    if (passwordCriteria.hasLetter) score += 1;
    if (passwordCriteria.hasNumber) score += 1;
    if (password.length >= 10) score += 1;
    return score;
  }, [passwordCriteria, password.length]);

  function enterApp() {
    router.replace("/app");
    router.refresh();
  }

  // Submit handler for Passkey registration
  async function onPasskeySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error(
          "Browser atau perangkat ini belum mendukung passkey. Silakan gunakan metode username dan kata sandi.",
        );
      }

      const { challengeId, options } = await postJson<OptionsResponse>(
        "/api/auth/register/options",
        {
          name: name.trim(),
          avatar,
          bio: bio.trim() === "" ? undefined : bio.trim(),
          email: email.trim() === "" ? undefined : email.trim(),
          setupToken: setupToken === "" ? undefined : setupToken,
        },
      );

      const response = await startRegistration({ optionsJSON: options });
      await postJson("/api/auth/register/verify", { challengeId, response });

      enterApp();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setBusy(false);
    }
  }

  // Submit handler for Username + Password registration
  async function onPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (username.trim().length < 3) {
      setError("Username minimal 3 karakter.");
      setBusy(false);
      return;
    }

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      setBusy(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      setBusy(false);
      return;
    }

    try {
      await postJson("/api/auth/register/password", {
        username: username.trim(),
        email: email.trim() === "" ? undefined : email.trim(),
        name: name.trim() === "" ? undefined : name.trim(),
        avatar,
        bio: bio.trim() === "" ? undefined : bio.trim(),
        password,
      });

      enterApp();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan pendaftaran.");
      setBusy(false);
    }
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
          <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.2 font-mono text-[9px] text-primary sm:inline">
            Aman
          </span>
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

      {/* Error banner */}
      {error && (
        <div
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Avatar Picker Preview */}
      <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar avatar={avatar} name={name || username} size="lg" className="shadow-xs" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {name || username || "Karakter Anda"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Pilih ilustrasi flat yang mewakili buku kas Anda.
            </p>
          </div>
        </div>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>

      {/* Mode 1: Passkey Registration */}
      {mode === "passkey" && (
        <form className="space-y-4" onSubmit={onPasskeySubmit}>
          <div>
            <label className="block text-xs font-semibold text-foreground" htmlFor={nameId}>
              Nama Lengkap
            </label>
            <input
              className={cn(inputClass, "mt-1.5")}
              id={nameId}
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground" htmlFor={emailId}>
                Alamat Email
              </label>
              <span className="text-[11px] text-muted-foreground">Opsional</span>
            </div>
            <input
              className={cn(inputClass, "mt-1.5")}
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@domain.id"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hanya disimpan secara lokal di basis data pribadimu.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground" htmlFor="bio-passkey">
                Bio / Catatan Pribadi
              </label>
              <span className="text-[11px] text-muted-foreground">Opsional</span>
            </div>
            <input
              className={cn(inputClass, "mt-1.5")}
              id="bio-passkey"
              name="bio"
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Contoh: Fokus nabung & disiplin anggaran"
            />
          </div>

          {setupTokenRequired && (
            <div>
              <label className="block text-xs font-semibold text-foreground" htmlFor={tokenId}>
                Token Setup Server
              </label>
              <input
                className={cn(inputClass, "mt-1.5")}
                id={tokenId}
                name="setupToken"
                type="password"
                autoComplete="off"
                required
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Dari SETUP_TOKEN di berkas .env"
              />
            </div>
          )}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkle className="size-3.5 text-primary" weight="fill" />
              Keunggulan Passkey
            </div>
            <p className="mt-1 text-[11px]">
              Masuk instan menggunakan sensor biometrik (Touch ID, Face ID, atau PIN perangkat)
              tanpa perlu menghafal kata sandi.
            </p>
          </div>

          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            {busy ? "Menyiapkan passkey…" : "Daftar dengan Passkey"}
          </Button>
        </form>
      )}

      {/* Mode 2: Username & Password Registration */}
      {mode === "password" && (
        <form className="space-y-4" onSubmit={onPasswordSubmit}>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground" htmlFor={nameId}>
                Nama Lengkap
              </label>
              <span className="text-[11px] text-muted-foreground">Opsional</span>
            </div>
            <input
              className={cn(inputClass, "mt-1.5")}
              id={nameId}
              name="name"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
            />
          </div>

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
              minLength={3}
              maxLength={64}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Minimal 3 karakter"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                className="block text-xs font-semibold text-foreground"
                htmlFor="email-password"
              >
                Alamat Email
              </label>
              <span className="text-[11px] text-muted-foreground">Opsional</span>
            </div>
            <input
              className={cn(inputClass, "mt-1.5")}
              id="email-password"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@domain.id (opsional untuk login via email)"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground" htmlFor="bio-password">
                Bio / Catatan Pribadi
              </label>
              <span className="text-[11px] text-muted-foreground">Opsional</span>
            </div>
            <input
              className={cn(inputClass, "mt-1.5")}
              id="bio-password"
              name="bio"
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Contoh: Fokus nabung & disiplin anggaran"
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
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
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

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex h-1 w-full gap-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      passwordStrengthScore <= 1
                        ? "w-1/3 bg-destructive"
                        : passwordStrengthScore <= 2
                          ? "w-2/3 bg-amber-500"
                          : "w-full bg-primary",
                    )}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      passwordCriteria.minLength ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    <Check className="size-3" /> Min. 6 karakter
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      passwordCriteria.hasNumber ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    <Check className="size-3" /> Angka
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      passwordCriteria.hasLetter ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    <Check className="size-3" /> Huruf
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label
              className="block text-xs font-semibold text-foreground"
              htmlFor={confirmPasswordId}
            >
              Konfirmasi Kata Sandi
            </label>
            <div className="relative mt-1.5 flex items-center">
              <input
                className={cn(inputClass, "pr-11")}
                id={confirmPasswordId}
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  showConfirmPassword
                    ? "Sembunyikan konfirmasi kata sandi"
                    : "Tampilkan konfirmasi kata sandi"
                }
              >
                {showConfirmPassword ? (
                  <EyeSlash className="size-4 shrink-0" />
                ) : (
                  <Eye className="size-4 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {setupTokenRequired && (
            <div>
              <label className="block text-xs font-semibold text-foreground" htmlFor={tokenId}>
                Token Setup Server
              </label>
              <input
                className={cn(inputClass, "mt-1.5")}
                id={tokenId}
                name="setupToken"
                type="password"
                autoComplete="off"
                required
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Dari SETUP_TOKEN di berkas .env"
              />
            </div>
          )}

          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            {busy ? "Membuat akun…" : "Buat Akun dan Mulai"}
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
            render={<a href="/api/auth/google" />}
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
            Daftar dengan Google
          </Button>
        </div>
      )}

      {/* Friction reduction expectation strip */}
      <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" weight="fill" />
        <span>Pendaftaran selesai dalam 30 detik tanpa verifikasi email.</span>
      </div>
    </div>
  );
}
