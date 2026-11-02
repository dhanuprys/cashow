import {
  getProfile,
  listAiProviderConfigs,
  listAuditLog,
  listOutboxEvents,
} from "@cashow/services";
import { Bot, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { AiModelManager } from "@/components/ledger/ai-model-manager";
import { AuditOutboxViewer } from "@/components/ledger/audit-outbox-viewer";
import { BackupExportCard } from "@/components/ledger/backup-export-card";
import { LinkButton } from "@/components/ledger/link-button";
import { NotificationSettingsCard } from "@/components/ledger/notification-settings-card";
import { PrivacySettingsCard } from "@/components/ledger/privacy-settings-card";
import { SettingsForm } from "@/components/ledger/settings-form";
import { SettingsShell } from "@/components/ledger/settings-shell";
import { ThemeSelector } from "@/components/ledger/theme-selector";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export const metadata = {
  title: "Pengaturan",
};

function SettingsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-8 items-start"
      aria-busy="true"
    >
      {/* Mobile bar skeleton */}
      <div className="sm:hidden flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>

      {/* Desktop sidebar skeleton */}
      <div className="hidden sm:flex flex-col gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded-xl bg-muted/60" />
        ))}
      </div>

      {/* Main card skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="h-5 w-1/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted/70" />
        <div className="pt-4 space-y-3">
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Milikmu
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfigurasi model AI, preferensi buku kas, keamanan passkey, dan data Anda.
        </p>
      </section>

      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [profile, audit, outbox, aiConfigs] = await Promise.all([
    getProfile(ctx),
    listAuditLog(ctx, { limit: 15 }),
    listOutboxEvents(ctx, { limit: 10 }),
    listAiProviderConfigs(ctx),
  ]);
  const data = unwrap(profile);
  const activeAiConfigs = aiConfigs.ok ? aiConfigs.value : [];

  const profileSlot = (
    <Card>
      <CardHeader>
        <CardTitle>Profil &amp; Preferensi Buku Kas</CardTitle>
        <CardDescription>
          Kelola nama tampilan, zona waktu, mata uang baku, dan siklus anggaran Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingsForm
          profile={{
            name: data.name ?? "",
            avatar: data.avatar ?? null,
            bio: data.bio ?? null,
            timezone: data.timezone,
            weekStartsOn: data.weekStartsOn,
            budgetMonthStartDay: data.budgetMonthStartDay,
            currency: data.currency,
            email: data.email,
          }}
        />
      </CardContent>
    </Card>
  );

  const aiSlot = (
    <Card id="ai-models">
      <CardHeader>
        <CardTitle>Model AI &amp; API Key</CardTitle>
        <CardDescription>
          Kelola token API DeepSeek, Google AI Studio, atau endpoint OpenAI untuk asisten cerdas
          Cashow.
        </CardDescription>
        <CardAction>
          <LinkButton
            href="/app/chat"
            variant="outline"
            size="sm"
            className="gap-1.5 shadow-2xs font-medium"
          >
            <Bot data-icon="inline-start" aria-hidden="true" />
            Buka AI Chat
          </LinkButton>
        </CardAction>
      </CardHeader>
      <CardContent>
        <AiModelManager configs={activeAiConfigs} />
      </CardContent>
    </Card>
  );

  const passkeySlot = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kunci Masuk (Passkey)</CardTitle>
          <CardDescription>
            Satu-satunya metode autentikasi aman tanpa kata sandi. Daftarkan perangkat Anda
            (biometrik atau kunci fisik).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesi Masuk Aktif</CardTitle>
          <CardDescription>
            Informasi status autentikasi peramban pada perangkat ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-4.5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Perangkat Ini (Sesi Saat Ini)</p>
              <p className="text-xs text-muted-foreground">
                Terautentikasi melalui kredensial Passkey WebAuthn aman.
              </p>
            </div>
          </div>

          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );

  const appearanceSlot = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tampilan Visual Antarmuka</CardTitle>
          <CardDescription>
            Pilih tema visual yang nyaman untuk mata dan perangkat Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privasi Tampilan Angka Saldo</CardTitle>
          <CardDescription>
            Kendalikan visibilitas nominal keuangan saat membuka aplikasi di ruang publik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrivacySettingsCard />
        </CardContent>
      </Card>
    </div>
  );

  const notificationsSlot = (
    <Card>
      <CardHeader>
        <CardTitle>Pemberitahuan &amp; Notifikasi</CardTitle>
        <CardDescription>
          Kelola izin notifikasi peramban untuk pengingat batas anggaran dan transaksi berulang.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationSettingsCard vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      </CardContent>
    </Card>
  );

  const backupSlot = (
    <Card>
      <CardHeader>
        <CardTitle>Pusat Data (Impor &amp; Ekspor)</CardTitle>
        <CardDescription>
          Kelola pencadangan arsip data buku kas (JSON) serta impor riwayat mutasi dari perbankan
          (CSV).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BackupExportCard />
      </CardContent>
    </Card>
  );

  const auditSlot = (
    <AuditOutboxViewer auditEntries={audit} outboxEvents={outbox} timezone={user.timezone} />
  );

  const footerInfo = (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          Mata Uang Baku: <strong className="text-foreground">{data.currency}</strong>
        </span>
        <span>•</span>
        <span>
          Zona Waktu: <strong className="text-foreground">{data.timezone}</strong>
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck
          className="size-3.5 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <span>Privasi Terjaga &amp; Data Terenkripsi</span>
      </div>
    </div>
  );

  return (
    <SettingsShell
      profileSlot={profileSlot}
      aiSlot={aiSlot}
      passkeySlot={passkeySlot}
      appearanceSlot={appearanceSlot}
      notificationsSlot={notificationsSlot}
      backupSlot={backupSlot}
      auditSlot={auditSlot}
      footerInfo={footerInfo}
      aiCount={activeAiConfigs.length}
    />
  );
}
