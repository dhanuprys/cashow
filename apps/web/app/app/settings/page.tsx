import { getProfile, listAuditLog, listOutboxEvents } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { SettingsForm } from "@/components/ledger/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayDateTime } from "@/lib/format";
import { unwrap } from "@/lib/ledger";

const ACTION_LABEL: Record<string, string> = {
  CREATE: "dibuat",
  UPDATE: "diubah",
  SOFT_DELETE: "dihapus",
  RESTORE: "dipulihkan",
  ARCHIVE: "diarsipkan",
  UNARCHIVE: "diaktifkan",
};

const ENTITY_LABEL: Record<string, string> = {
  Transaction: "Transaksi",
  Account: "Akun",
  Category: "Kategori",
  Attachment: "Lampiran",
  User: "Pengaturan",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [profile, audit, outbox] = await Promise.all([
    getProfile(ctx),
    listAuditLog(ctx, { limit: 15 }),
    listOutboxEvents(ctx, { limit: 5 }),
  ]);
  const data = unwrap(profile);
  const activity = audit;

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
          Preferensi laporan, passkey, dan jejak perubahan.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil & laporan</CardTitle>
            <CardDescription>{data.email ?? "Tanpa email"} · pemilik tunggal.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              profile={{
                name: data.name ?? "",
                timezone: data.timezone,
                weekStartsOn: data.weekStartsOn,
                budgetMonthStartDay: data.budgetMonthStartDay,
                currency: data.currency,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passkey</CardTitle>
            <CardDescription>
              Satu-satunya cara masuk. Simpan lebih dari satu perangkat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasskeyManager />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas terakhir</CardTitle>
          <CardDescription>Audit log mencatat setiap perubahan buku.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                    </span>{" "}
                    {ACTION_LABEL[entry.action] ?? entry.action.toLowerCase()}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {displayDateTime(entry.createdAt, user.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status antrean</CardTitle>
          <CardDescription>
            Outbox ditulis bersama setiap perubahan, siap dipakai worker di fase berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">Antrean kosong.</p>
          ) : (
            <ul className="space-y-2">
              {outbox.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs">{event.eventType}</span>
                  </span>
                  <Badge variant={event.status === "PENDING" ? "secondary" : "outline"}>
                    {event.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Cashow self-hosted · {data.currency} · {data.timezone}
      </p>
    </div>
  );
}
