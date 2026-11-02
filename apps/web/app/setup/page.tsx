import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { getAuthConfig } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Daftar Akun",
  description:
    "Daftarkan akun buku kas Cashow menggunakan passkey biometrik atau username dan kata sandi.",
};

export default function SetupPage() {
  return (
    <AuthShell
      title="Daftar Akun Baru"
      subtitle="Pilih passkey biometrik atau kata sandi untuk mengamankan pembukuan keuangan pribadimu."
      footerLink={{
        href: "/login",
        label: "Sudah punya akun?",
        actionText: "Masuk ke buku kas",
      }}
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Memeriksa status…</p>}>
        <SetupGate />
      </Suspense>
    </AuthShell>
  );
}

async function SetupGate() {
  await connection();

  const user = await getSessionUser();
  if (user !== null) redirect("/app");

  return <SetupForm setupTokenRequired={getAuthConfig().setupTokenRequired} />;
}
