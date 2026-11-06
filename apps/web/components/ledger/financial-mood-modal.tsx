"use client";

import type { FinancialMood, FinancialMoodStatus } from "@cashow/domain";
import { formatMoney } from "@cashow/domain";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FinancialMoodDialogProps {
  mood: FinancialMood;
  income: bigint;
  expense: bigint;
  maxBudgetUsed: number | null;
}

function MoodIllustration({ status }: { status: FinancialMoodStatus }) {
  if (status === "THRIVING") {
    return (
      <div className="relative mx-auto flex size-28 items-center justify-center rounded-3xl bg-linear-to-b from-emerald-500/15 to-emerald-500/5 ring-1 ring-emerald-500/30">
        <svg
          viewBox="0 0 100 100"
          className="size-20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Background soft circle */}
          <circle cx="50" cy="50" r="42" fill="#10B981" fillOpacity="0.1" />
          <circle cx="50" cy="50" r="32" stroke="#10B981" strokeWidth="2" strokeDasharray="3 3" />
          {/* Upward flourishing chart bars */}
          <rect x="26" y="54" width="10" height="22" rx="3" fill="#10B981" fillOpacity="0.5" />
          <rect x="42" y="42" width="10" height="34" rx="3" fill="#10B981" fillOpacity="0.75" />
          <rect x="58" y="28" width="10" height="48" rx="3" fill="#10B981" />
          {/* Dynamic rising arrow & sparkles */}
          <path
            d="M30 46L46 36L58 40L74 24"
            stroke="#059669"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M66 24H74V32" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="76" cy="18" r="3" fill="#34D399" />
          <circle cx="28" cy="28" r="2" fill="#6EE7B7" />
        </svg>
      </div>
    );
  }

  if (status === "BALANCED") {
    return (
      <div className="relative mx-auto flex size-28 items-center justify-center rounded-3xl bg-linear-to-b from-amber-500/15 to-amber-500/5 ring-1 ring-amber-500/30">
        <svg
          viewBox="0 0 100 100"
          className="size-20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Subtle balanced scale */}
          <circle cx="50" cy="50" r="42" fill="#F59E0B" fillOpacity="0.1" />
          {/* Balance fulcrum */}
          <path d="M50 32V68" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 72H62" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
          {/* Horizontal balance arm */}
          <path d="M26 38L50 36L74 38" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          {/* Left pan */}
          <path d="M26 38L22 52H30L26 38Z" fill="#F59E0B" fillOpacity="0.4" />
          <path d="M18 52H34" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
          {/* Right pan */}
          <path d="M74 38L70 52H78L74 38Z" fill="#F59E0B" fillOpacity="0.4" />
          <path d="M66 52H82" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
          {/* Steady central indicator */}
          <circle cx="50" cy="36" r="4" fill="#B45309" />
          <circle cx="78" cy="24" r="2.5" fill="#FBBF24" />
        </svg>
      </div>
    );
  }

  // ATTENTION status
  return (
    <div className="relative mx-auto flex size-28 items-center justify-center rounded-3xl bg-linear-to-b from-rose-500/15 to-rose-500/5 ring-1 ring-rose-500/30">
      <svg
        viewBox="0 0 100 100"
        className="size-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Warning circle container */}
        <circle cx="50" cy="50" r="42" fill="#F43F5E" fillOpacity="0.1" />
        <circle cx="50" cy="50" r="34" stroke="#F43F5E" strokeWidth="2" strokeDasharray="4 4" />
        {/* Soft shield / alert polygon */}
        <path
          d="M50 24L74 34V52C74 65 64 74 50 78C36 74 26 65 26 52V34L50 24Z"
          fill="#F43F5E"
          fillOpacity="0.2"
          stroke="#E11D48"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Exclamation point */}
        <line
          x1="50"
          y1="40"
          x2="50"
          y2="54"
          stroke="#BE123C"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="63" r="2.5" fill="#BE123C" />
      </svg>
    </div>
  );
}

export function FinancialMoodBanner({
  mood,
  income,
  expense,
  maxBudgetUsed,
}: FinancialMoodDialogProps) {
  const [open, setOpen] = useState(false);
  const net = income - expense;

  const statusConfig = {
    THRIVING: {
      dotColor: "bg-emerald-500",
      bannerBorder:
        "border-emerald-500/25 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08] dark:border-emerald-500/30",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      headline: "Arus Kas Kamu Sangat Sehat",
      subheadline:
        "Pemasukan mencukupi seluruh kebutuhan dan pengeluaran tetap berada jauh di bawah batas aman anggaran.",
      tips: [
        "Pertahankan alokasi tabungan dan investasi dari surplus saat ini.",
        "Anggaran bulanan masih memiliki ruang bernapas yang cukup lapang.",
        "Tidak ada overbudget atau lonjakan pengeluaran mendadak yang terdeteksi.",
      ],
    },
    BALANCED: {
      dotColor: "bg-amber-500",
      bannerBorder:
        "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.08] dark:border-amber-500/30",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      headline: "Arus Kas Berjalan Terkendali",
      subheadline:
        "Pengeluaranmu mulai mendekati sebagian porsi pemasukan atau salah satu anggaran telah terpakai di atas 75%.",
      tips: [
        "Periksa kategori pengeluaran terbesar untuk mencegah defisit sebelum akhir periode.",
        "Pantau batas belanja harian aman agar tidak terjadi defisit.",
        "Tunda pengeluaran diskresioner non-mendesak jika anggaran sudah tipis.",
      ],
    },
    ATTENTION: {
      dotColor: "bg-rose-500",
      bannerBorder:
        "border-rose-500/25 bg-rose-500/[0.05] hover:bg-rose-500/[0.08] dark:border-rose-500/30",
      badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      headline: "Kondisi Kas Membutuhkan Evaluasi",
      subheadline:
        "Total pengeluaran melebihi pemasukan bulan ini atau batas salah satu anggaran telah terlampaui 100%.",
      tips: [
        "Periksa pos belanja yang mengalami lonjakan di luar rencana pembukuan.",
        "Evaluasi transaksi terbaru dan gunakan fitur alokasi amplop untuk membatasi dana.",
        "Cek apakah ada transaksi pemasukan yang belum tercatat di buku kas.",
      ],
    },
  }[mood.status];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 transition-all cursor-pointer shadow-2xs text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          statusConfig.bannerBorder,
        )}
        aria-label={`Status keuangan: ${mood.label}. ${mood.description} Klik untuk melihat analisis mendalam.`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-tight",
              statusConfig.badgeClass,
            )}
          >
            <span className={cn("size-2 rounded-full animate-pulse", statusConfig.dotColor)} />
            <span>{mood.label}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors hidden sm:inline">
            {mood.description}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-foreground/80 group-hover:text-foreground">
          <span>Lihat analisis</span>
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl p-6">
          <DialogHeader className="text-center sm:text-center pb-2">
            <MoodIllustration status={mood.status} />

            <div className="mt-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  mood.status === "THRIVING" &&
                    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                  mood.status === "BALANCED" &&
                    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                  mood.status === "ATTENTION" && "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                )}
              >
                <Sparkles className="size-3" aria-hidden="true" />
                <span>{mood.label}</span>
              </span>

              <DialogTitle className="mt-2 font-heading text-lg font-semibold tracking-tight sm:text-xl">
                {statusConfig.headline}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                {statusConfig.subheadline}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Quick Metrics Breakdown */}
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border/70 bg-muted/30 p-3.5 text-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">Arus Kas Masuk</span>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatMoney(income)}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">Arus Kas Keluar</span>
              <p className="font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                {formatMoney(expense)}
              </p>
            </div>
            <div className="space-y-0.5 border-t border-border/50 pt-2">
              <span className="text-[11px] text-muted-foreground">Selisih Bersih (Net)</span>
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  net >= 0n
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400",
                )}
              >
                {net >= 0n ? "+" : "−"}
                {formatMoney(net >= 0n ? net : -net)}
              </p>
            </div>
            <div className="space-y-0.5 border-t border-border/50 pt-2">
              <span className="text-[11px] text-muted-foreground">Anggaran Tertinggi</span>
              <p className="font-semibold text-foreground tabular-nums">
                {maxBudgetUsed !== null ? `${maxBudgetUsed.toFixed(0)}% terpakai` : "Belum diatur"}
              </p>
            </div>
          </div>

          {/* Actionable Insights */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">
              Saran &amp; Catatan Penting:
            </span>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {statusConfig.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2
                    className={cn(
                      "size-3.5 shrink-0 mt-0.5",
                      mood.status === "THRIVING" && "text-emerald-600 dark:text-emerald-400",
                      mood.status === "BALANCED" && "text-amber-600 dark:text-amber-400",
                      mood.status === "ATTENTION" && "text-rose-600 dark:text-rose-400",
                    )}
                    aria-hidden="true"
                  />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="w-full sm:flex-1"
            >
              Tutup
            </Button>
            <LinkButton
              href="/app/budgets"
              onClick={() => setOpen(false)}
              size="sm"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5"
            >
              <span>Atur Anggaran</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </LinkButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
