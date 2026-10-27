import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/setup";

export default function LoginPage() {
  return (
    <AuthShell
      title="Masuk"
      subtitle="Gunakan passkey yang sudah terdaftar di perangkatmu. Tidak ada kata sandi."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Memeriksa sesi…</p>}>
        <LoginGate />
      </Suspense>
    </AuthShell>
  );
}

async function LoginGate() {
  await connection();

  if (!(await hasAnyUser())) redirect("/setup");
  if ((await getSessionUser()) !== null) redirect("/app");

  return <LoginForm />;
}
