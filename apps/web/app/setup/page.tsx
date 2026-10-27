import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { getAuthConfig } from "@/lib/auth/config";
import { hasAnyUser } from "@/lib/auth/setup";

export default function SetupPage() {
  return (
    <AuthShell
      title="Siapkan pemilik"
      subtitle="Buat passkey pertama. Setelah ini pendaftaran publik ditutup dan akun hanya bisa dibuka dengan passkey."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Memeriksa status setup…</p>}>
        <SetupGate />
      </Suspense>
    </AuthShell>
  );
}

async function SetupGate() {
  await connection();

  if (await hasAnyUser()) redirect("/login");

  return <SetupForm setupTokenRequired={getAuthConfig().setupTokenRequired} />;
}
