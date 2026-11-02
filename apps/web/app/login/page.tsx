import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Masuk ke Buku Kas",
  description:
    "Masuk ke buku kas mandiri Cashow menggunakan passkey biometrik atau username dan kata sandi.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Masuk ke Buku Kas"
          subtitle="Buka akses buku kas menggunakan passkey biometrik atau kombinasi username dan kata sandi."
        >
          <p className="text-sm text-muted-foreground">Memeriksa status sesi…</p>
        </AuthShell>
      }
    >
      <LoginGate />
    </Suspense>
  );
}

async function LoginGate() {
  await connection();

  const user = await getSessionUser();
  if (user !== null) redirect("/app");

  return (
    <AuthShell
      title="Masuk ke Buku Kas"
      subtitle="Buka akses buku kas menggunakan passkey biometrik atau kombinasi username dan kata sandi."
      footerLink={{
        href: "/setup",
        label: "Belum punya akun?",
        actionText: "Daftar di sini",
      }}
    >
      <LoginForm hasExistingUser={true} />
    </AuthShell>
  );
}
