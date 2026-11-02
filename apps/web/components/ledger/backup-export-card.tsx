"use client";

import {
  ArrowRight,
  CreditCard,
  Download,
  FileJson,
  FileSpreadsheet,
  PieChart,
  Receipt,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

const DATA_PILLARS = [
  {
    icon: Receipt,
    title: "Transaksi & Mutasi",
    description: "Seluruh catatan pemasukan, pengeluaran, transfer, dan lampiran.",
  },
  {
    icon: CreditCard,
    title: "Akun & Saldo",
    description: "Rekening bank, dompet digital, kartu kredit, dan kas tunai.",
  },
  {
    icon: PieChart,
    title: "Kategori & Anggaran",
    description: "Struktur pos keuangan dan alokasi batas anggaran bulanan.",
  },
  {
    icon: Zap,
    title: "Aturan & Rencana",
    description: "Aturan otomatisasi kategorisasi dan rencana pembayaran berkala.",
  },
];

export function BackupExportCard() {
  const [downloading, setDownloading] = useState(false);

  function handleDownloadClick() {
    setDownloading(true);
    toast.add({
      title: "Mengunduh Cadangan",
      description: "File cadangan JSON sedang disiapkan oleh server...",
    });
    setTimeout(() => setDownloading(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* What's included grid */}
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Cakupan Data Cadangan
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DATA_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-foreground">{pillar.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Ownership Callout */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4.5 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold text-foreground">
            Kepemilikan &amp; Portabilitas Data Penuh
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Seluruh data buku kas Anda tersimpan secara privat dan aman. Ekspor ini menghasilkan
          dokumen data berformat JSON standar yang dapat Anda unduh untuk keperluan arsip pribadi,
          analisis lanjutan, atau pencadangan mandiri kapan saja.
        </p>
      </div>

      {/* Download Action Footer */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-border/60">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 font-mono text-[11px]">
            <FileJson className="size-3" aria-hidden="true" />
            cashow-backup.json
          </Badge>
          <span className="text-xs text-muted-foreground">• Format JSON standar</span>
        </div>

        <a
          href="/api/backup/export"
          download
          onClick={handleDownloadClick}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="size-4" aria-hidden="true" />
          {downloading ? "Menyiapkan File..." : "Unduh Cadangan Lengkap"}
        </a>
      </div>

      {/* CSV Import Hub Section */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-4.5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Impor Riwayat Transaksi (CSV)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Punya catatan dari perbankan atau spreadsheet Excel? Unggah file CSV untuk mengimpor
                mutasi secara massal ke buku kas Anda.
              </p>
            </div>
          </div>

          <Link
            href="/app/import"
            className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center shrink-0 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileSpreadsheet className="size-3.5 text-primary" aria-hidden="true" />
            Buka Halaman Impor
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Kolom yang didukung:</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">tanggal</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">jumlah</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">jenis</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">catatan</span>
        </div>
      </div>
    </div>
  );
}
