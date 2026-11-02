"use client";

import type { AuditEntry, OutboxEntry } from "@cashow/services";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Edit2,
  History,
  Info,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { displayDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; badgeClass: string }> = {
  CREATE: {
    label: "Dibuat",
    icon: Plus,
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  UPDATE: {
    label: "Diubah",
    icon: Edit2,
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  SOFT_DELETE: {
    label: "Dihapus",
    icon: Trash2,
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  RESTORE: {
    label: "Dipulihkan",
    icon: RotateCcw,
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  ARCHIVE: {
    label: "Diarsipkan",
    icon: Archive,
    badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  },
  UNARCHIVE: {
    label: "Diaktifkan",
    icon: RotateCcw,
    badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  },
};

const ENTITY_LABELS: Record<string, string> = {
  Transaction: "Transaksi",
  Account: "Akun",
  Category: "Kategori",
  Attachment: "Lampiran",
  User: "Profil",
  AiProviderConfig: "Model AI",
  Plan: "Rencana",
  RecurringRule: "Transaksi Berulang",
  Rule: "Aturan",
  Budget: "Anggaran",
};

const EVENT_LABELS: Record<string, string> = {
  "transaction.created": "Pencatatan Transaksi",
  "transaction.updated": "Pembaruan Transaksi",
  "transaction.deleted": "Penghapusan Transaksi",
  "account.created": "Pendaftaran Akun Baru",
  "account.updated": "Pembaruan Akun",
  "account.archived": "Pengarsipan Akun",
  "budget.created": "Alokasi Anggaran",
  "budget.updated": "Penyesuaian Anggaran",
  "category.created": "Penambahan Kategori",
  "category.updated": "Pembaruan Kategori",
  "rule.created": "Pembuatan Aturan Otomatis",
  "rule.updated": "Penyesuaian Aturan",
  "plan.created": "Pembuatan Rencana Keuangan",
};

function formatEventTitle(eventType: string): string {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];
  return eventType
    .split(".")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function AuditOutboxViewer({
  auditEntries,
  outboxEvents,
  timezone,
}: {
  auditEntries: AuditEntry[];
  outboxEvents: OutboxEntry[];
  timezone: string;
}) {
  return (
    <div className="space-y-6">
      {/* Activity History Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">Riwayat Aktivitas Akun</CardTitle>
              <CardDescription>
                Mencatat kronologi setiap perubahan data buku kas Anda untuk transparansi dan
                akurasi.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 font-mono text-[11px]">
              <History className="size-3" aria-hidden="true" />
              {auditEntries.length} aktivitas terbaru
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <Empty className="border border-dashed border-border py-8">
              <EmptyHeader>
                <History className="size-8 text-muted-foreground" aria-hidden="true" />
                <EmptyTitle>Belum ada catatan aktivitas</EmptyTitle>
                <EmptyDescription>
                  Setiap pembuatan transaksi, pembaruan anggaran, atau penyesuaian akun akan
                  tercatat di sini.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card/40 overflow-hidden">
              {auditEntries.map((entry) => {
                const actionMeta = ACTION_CONFIG[entry.action] ?? {
                  label: entry.action.toLowerCase(),
                  icon: Edit2,
                  badgeClass: "bg-muted text-muted-foreground border-border",
                };
                const ActionIcon = actionMeta.icon;
                const entityName = ENTITY_LABELS[entry.entityType] ?? entry.entityType;

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3.5 transition-colors hover:bg-muted/20 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium shrink-0",
                          actionMeta.badgeClass,
                        )}
                      >
                        <ActionIcon className="size-3" aria-hidden="true" />
                        {actionMeta.label}
                      </span>

                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <span className="font-semibold text-foreground text-xs sm:text-sm">
                          {entityName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 self-start sm:self-center">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{displayDateTime(entry.createdAt, timezone)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Data Synchronization Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">Status Pembaruan Data</CardTitle>
              <CardDescription>
                Memastikan seluruh proses kalkulasi saldo, laporan, dan data buku kas terbarui
                secara konsisten.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <RefreshCw
                className="size-3 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Otomatis
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {outboxEvents.length === 0 ? (
            <Empty className="border border-dashed border-border py-8">
              <EmptyHeader>
                <CheckCircle2 className="size-8 text-emerald-500" aria-hidden="true" />
                <EmptyTitle>Semua Data Telah Terkini</EmptyTitle>
                <EmptyDescription>
                  Tidak ada pembaruan tertunda. Seluruh mutasi dan rekap keuangan telah berhasil
                  disinkronkan.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card/40 overflow-hidden">
              {outboxEvents.map((event) => {
                const isPending = event.status === "PENDING";
                const isFailed = event.status === "FAILED";
                const title = formatEventTitle(event.eventType);

                return (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3.5 transition-colors hover:bg-muted/20 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Layers className="size-3.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-medium text-foreground truncate">{title}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {isPending ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                        >
                          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Dalam Proses
                        </Badge>
                      ) : isFailed ? (
                        <Badge variant="destructive" className="gap-1 text-[11px]">
                          <AlertCircle className="size-3" aria-hidden="true" />
                          Perlu Perhatian
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          Selesai
                        </Badge>
                      )}

                      <span className="font-mono text-[11px] text-muted-foreground">
                        {displayDateTime(event.createdAt, timezone)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">
              Sistem memproses kalkulasi dan pembukuan data secara otomatis di latar belakang untuk
              memastikan pengalaman antarmuka yang cepat dan responsif.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
