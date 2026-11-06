"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { changePasswordAction } from "@/lib/actions/ledger";
import { initialActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./submit-button";

interface PasswordCardProps {
  hasPassword: boolean;
  username: string | null;
  email: string | null;
}

export function PasswordCard({ hasPassword, username, email }: PasswordCardProps) {
  const [state, formAction] = useActionState(changePasswordAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  const currentPasswordId = useId();
  const usernameId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength checks
  const criteria = useMemo(() => {
    return {
      minLength: newPassword.length >= 6,
      hasLetter: /[a-zA-Z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
    };
  }, [newPassword]);

  const strengthScore = useMemo(() => {
    let score = 0;
    if (criteria.minLength) score += 1;
    if (criteria.hasLetter) score += 1;
    if (criteria.hasNumber) score += 1;
    if (newPassword.length >= 10) score += 1;
    return score;
  }, [criteria, newPassword.length]);

  const passwordsMatch = useMemo(() => {
    if (confirmPassword.length === 0) return null;
    return confirmPassword === newPassword;
  }, [confirmPassword, newPassword]);

  useEffect(() => {
    if (state.status === "success") {
      toast.add({
        title: hasPassword ? "Kata Sandi Diperbarui" : "Kata Sandi Dibuat",
        description: state.message ?? "Kata sandi akun Anda berhasil disimpan.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      formRef.current?.reset();
    } else if (state.status === "error" && state.message) {
      toast.add({
        title: "Gagal Menyimpan",
        description: state.message,
      });
    }
  }, [state, hasPassword]);

  const loginIdentifier = username || email;

  return (
    <Card id="password-settings">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-4" aria-hidden="true" />
          </div>
          <CardTitle>{hasPassword ? "Ubah Kata Sandi" : "Buat Kata Sandi"}</CardTitle>
        </div>
        <CardDescription>
          {hasPassword
            ? "Perbarui kata sandi akun untuk menjaga keamanan akses buku kas Anda."
            : "Tambahkan kata sandi agar Anda dapat masuk menggunakan username atau email selain Passkey."}
        </CardDescription>
        <CardAction>
          {hasPassword ? (
            <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3" aria-hidden="true" />
              Aktif
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-muted-foreground">
              <KeyRound className="size-3" aria-hidden="true" />
              Belum Diatur
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-5">
          {/* Active identifier hint */}
          {loginIdentifier && (
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
              <p>
                Akun masuk saat ini:{" "}
                <span className="font-semibold text-foreground">{loginIdentifier}</span>
              </p>
            </div>
          )}

          <FieldGroup className="gap-4">
            {/* If user needs to set a username */}
            {!username && !hasPassword && (
              <Field>
                <FieldLabel htmlFor={usernameId}>Username Akun</FieldLabel>
                <Input
                  id={usernameId}
                  name="username"
                  type="text"
                  autoComplete="username"
                  required={!email}
                  minLength={3}
                  maxLength={64}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: dhanu99 (minimal 3 karakter)"
                />
                <FieldDescription>
                  Digunakan sebagai tanda pengenal saat masuk dengan kata sandi.
                </FieldDescription>
              </Field>
            )}

            {/* Current Password Field */}
            {hasPassword && (
              <Field>
                <FieldLabel htmlFor={currentPasswordId}>Kata Sandi Saat Ini</FieldLabel>
                <div className="relative">
                  <Input
                    id={currentPasswordId}
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi lama"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showCurrentPassword
                        ? "Sembunyikan kata sandi saat ini"
                        : "Tampilkan kata sandi saat ini"
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </Field>
            )}

            {/* New Password Field */}
            <Field>
              <FieldLabel htmlFor={newPasswordId}>
                {hasPassword ? "Kata Sandi Baru" : "Kata Sandi"}
              </FieldLabel>
              <div className="relative">
                <Input
                  id={newPasswordId}
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showNewPassword ? "Sembunyikan kata sandi baru" : "Tampilkan kata sandi baru"
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>

              {/* Password strength bar */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        strengthScore <= 1
                          ? "w-1/3 bg-rose-500"
                          : strengthScore <= 3
                            ? "w-2/3 bg-amber-500"
                            : "w-full bg-emerald-500",
                      )}
                    />
                  </div>

                  {/* Criteria chips */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors",
                        criteria.minLength
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {criteria.minLength ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <span className="size-1 rounded-full bg-muted-foreground" />
                      )}
                      Min. 6 karakter
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors",
                        criteria.hasLetter
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {criteria.hasLetter ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <span className="size-1 rounded-full bg-muted-foreground" />
                      )}
                      Huruf
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors",
                        criteria.hasNumber
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {criteria.hasNumber ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <span className="size-1 rounded-full bg-muted-foreground" />
                      )}
                      Angka
                    </span>
                  </div>
                </div>
              )}
            </Field>

            {/* Confirm Password Field */}
            <Field>
              <FieldLabel htmlFor={confirmPasswordId}>Konfirmasi Kata Sandi Baru</FieldLabel>
              <div className="relative">
                <Input
                  id={confirmPasswordId}
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showConfirmPassword
                      ? "Sembunyikan konfirmasi kata sandi"
                      : "Tampilkan konfirmasi kata sandi"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>

              {/* Match indicator */}
              {passwordsMatch !== null && (
                <div className="mt-1 flex items-center gap-1 text-[11px]">
                  {passwordsMatch ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Kata sandi cocok
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-500 font-medium">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Konfirmasi kata sandi belum sama
                    </span>
                  )}
                </div>
              )}
            </Field>
          </FieldGroup>

          {/* Action error summary if returned from server */}
          {state.status === "error" && state.message && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <p>{state.message}</p>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end pt-2">
            <SubmitButton
              disabled={
                newPassword.length < 6 ||
                (confirmPassword.length > 0 && confirmPassword !== newPassword)
              }
              pendingLabel="Menyimpan…"
              className="w-full sm:w-auto"
            >
              {hasPassword ? "Perbarui Kata Sandi" : "Simpan Kata Sandi"}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
