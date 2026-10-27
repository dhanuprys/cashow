import { connection } from "next/server";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { requireUser } from "@/lib/auth/session";

export default function AppPage() {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <AppContent />
    </Suspense>
  );
}

async function AppContent() {
  await connection();

  const user = await requireUser();
  const displayName = user.name ?? user.email ?? "Pemilik";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Cashow
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Halo, {displayName}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email ?? "Akun pemilik"} · {user.timezone} · {user.currency}
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Fondasi siap</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Autentikasi passkey aktif dan tidak ada pendaftaran publik. Fase berikutnya menambahkan
          akun, kategori, transaksi, dan alokasi ke halaman ini.
        </p>
      </div>

      <div className="mt-6">
        <PasskeyManager />
      </div>
    </main>
  );
}

function AppSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse px-6 py-10">
      <div className="h-4 w-20 rounded bg-muted" />
      <div className="mt-4 h-9 w-56 rounded bg-muted" />
      <div className="mt-8 h-32 rounded-2xl bg-muted" />
      <div className="mt-6 h-40 rounded-2xl bg-muted" />
    </main>
  );
}
