import { formatMoney } from "@cashow/domain";
import { listAccounts, listGoals } from "@cashow/services";
import {
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Lock,
  PauseCircle,
  ShieldCheck,
  Target,
  Wallet,
} from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import {
  CreateGoalDialog,
  DeleteReservationButton,
  EditGoalDialog,
  GoalForm,
  ReserveGoalDialog,
} from "@/components/ledger/goal-form";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { archiveGoalAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Target Tabungan",
};

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<ContentSkeleton />}>
        <GoalsContent />
      </Suspense>
    </div>
  );
}

async function GoalsContent() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [goalsResult, accountsResult] = await Promise.all([listGoals(ctx), listAccounts(ctx)]);

  const goals = unwrap(goalsResult);
  const accounts = unwrap(accountsResult).filter((a) => a.archivedAt === null);

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0n);
  const totalSaved = goals.reduce((sum, g) => sum + g.savedAmount, 0n);
  const overallProgress =
    totalTarget > 0n ? Math.min(Number((totalSaved * 100n) / totalTarget), 100) : 0;

  // Track cash committed to active goal reservations per account
  const reservedByAccount = new Map<string, bigint>();
  for (const goal of goals) {
    for (const reservation of goal.reservations) {
      const current = reservedByAccount.get(reservation.accountId) ?? 0n;
      reservedByAccount.set(reservation.accountId, current + reservation.amount);
    }
  }

  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    free: account.balance - (reservedByAccount.get(account.id) ?? 0n),
  }));

  const reservableAccounts = accountOptions.filter((account) => account.free > 0n);

  return (
    <div className="space-y-6">
      {/* Header section with mobile-friendly action */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Alokasi Dana
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Target Tabungan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sisihkan uang untuk impian dan dana darurat tanpa mengubah saldo riil di rekening bank.
          </p>
        </div>

        {/* Quick action button for all viewports */}
        <div className="flex items-center gap-2">
          <CreateGoalDialog />
        </div>
      </section>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardDescription className="text-xs font-medium text-muted-foreground">
              Total Dana Dicadangkan
            </CardDescription>
            <CardAction>
              <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Coins className="size-4" aria-hidden="true" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatMoney(totalSaved)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totalTarget > 0n
                ? `${overallProgress}% dari target ${formatMoney(totalTarget)}`
                : "Belum ada target aktif"}
            </p>
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardDescription className="text-xs font-medium text-muted-foreground">
              Status Target
            </CardDescription>
            <CardAction>
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <Target className="size-4" aria-hidden="true" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground">
              {goals.filter((g) => g.status === "ACTIVE").length}{" "}
              <span className="text-sm font-normal text-muted-foreground">aktif</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {goals.filter((g) => g.status === "COMPLETED").length} target telah tercapai penuh
            </p>
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardDescription className="text-xs font-medium text-primary">
              Prinsip Saldo Riil Bank
            </CardDescription>
            <CardAction>
              <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Saldo rekening bank Anda tetap 100% utuh dan akurat dengan m-Banking. Reservasi hanya
              membatasi agar tidak terpakai belanja harian.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left Column: Goals List */}
        <div className="space-y-4">
          {goals.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Empty className="border border-dashed border-border/80">
                  <EmptyMedia variant="icon">
                    <Target className="size-5 text-muted-foreground" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Belum ada target tabungan</EmptyTitle>
                    <EmptyDescription>
                      Buat pos tabungan untuk dana darurat, liburan, atau gadget impian tanpa
                      mengubah saldo riil bank Anda.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <CreateGoalDialog label="Mulai Target Pertama" />
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            goals.map((goal) => {
              const isCompleted = goal.savedAmount >= goal.targetAmount;

              return (
                <Card
                  key={goal.id}
                  className={cn(
                    "transition-all",
                    isCompleted && "border-emerald-500/40 bg-emerald-500/[0.02]",
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold text-foreground text-sm sm:text-base break-words">
                        {goal.name}
                      </span>
                      {isCompleted ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 text-white text-[10px] py-0 px-2 gap-1 font-medium"
                        >
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>Tercapai</span>
                        </Badge>
                      ) : goal.status === "PAUSED" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 gap-1 text-muted-foreground font-medium"
                        >
                          <PauseCircle className="size-3" aria-hidden="true" />
                          <span>Dijeda</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                          Aktif
                        </Badge>
                      )}
                    </CardTitle>

                    <CardDescription className="text-xs text-muted-foreground break-words">
                      Target:{" "}
                      <strong className="text-foreground font-semibold tabular-nums">
                        {formatMoney(goal.targetAmount)}
                      </strong>
                      {goal.targetDate && (
                        <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                          <Calendar className="size-3" aria-hidden="true" />
                          <span>Batas: {goal.targetDate}</span>
                        </span>
                      )}
                      {goal.description && (
                        <span className="block mt-0.5 text-muted-foreground/90">
                          {goal.description}
                        </span>
                      )}
                    </CardDescription>

                    <CardAction className="text-right">
                      <p className="text-base sm:text-lg font-semibold tabular-nums tracking-tight text-foreground">
                        {formatMoney(goal.savedAmount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {goal.remainingAmount > 0n
                          ? `Kurang ${formatMoney(goal.remainingAmount)}`
                          : "Target terpenuhi"}
                      </p>
                    </CardAction>
                  </CardHeader>

                  <CardContent className="space-y-3.5">
                    {/* Accessible Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">Progres tabungan</span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {goal.progressPercent.toFixed(0)}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.min(goal.progressPercent, 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progres target ${goal.name}`}
                        className="h-2.5 overflow-hidden rounded-full bg-muted/80"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isCompleted ? "bg-emerald-500 dark:bg-emerald-400" : "bg-primary",
                          )}
                          style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Pacing Info if Target Date exists */}
                    {goal.monthlyPacing !== null && !isCompleted && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-3.5 text-primary" aria-hidden="true" />
                          <span>
                            Sisa waktu:{" "}
                            <strong className="text-foreground">
                              {goal.monthsRemaining === 1
                                ? "Bulan ini"
                                : `${goal.monthsRemaining} bulan`}
                            </strong>
                          </span>
                        </span>
                        <span>
                          Saran alokasi:{" "}
                          <strong className="text-foreground tabular-nums">
                            {formatMoney(goal.monthlyPacing)} / bulan
                          </strong>
                        </span>
                      </div>
                    )}

                    {/* Breakdown of reserved funds per account */}
                    {goal.reservations.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Lock className="size-3 text-primary" aria-hidden="true" />
                            <span>Cadangan dana per rekening:</span>
                          </span>
                          <span>{goal.reservations.length} alokasi aktif</span>
                        </div>
                        <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-muted/15 text-xs">
                          {goal.reservations.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="grid size-6 shrink-0 place-items-center rounded-md bg-background border border-border/60 text-muted-foreground">
                                  <Wallet className="size-3" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-foreground truncate block">
                                    {r.accountName}
                                  </span>
                                  {r.note && (
                                    <span className="text-muted-foreground text-[11px] truncate block">
                                      {r.note}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatMoney(r.amount)}
                                </span>
                                <DeleteReservationButton
                                  reservationId={r.id}
                                  amount={r.amount}
                                  accountName={r.accountName}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
                        Belum ada dana yang dicadangkan. Sisihkan sebagian saldo rekening untuk
                        target ini.
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-xs">
                    <div className="text-[11px] text-muted-foreground">
                      {isCompleted ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          Target telah tercapai penuh
                        </span>
                      ) : (
                        <span>
                          Terkumpul {formatMoney(goal.savedAmount)} dari{" "}
                          {formatMoney(goal.targetAmount)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <ReserveGoalDialog
                        goalId={goal.id}
                        goalName={goal.name}
                        accounts={reservableAccounts}
                        remainingAmount={goal.remainingAmount}
                        monthlyPacing={goal.monthlyPacing}
                      />
                      <EditGoalDialog
                        goal={{
                          id: goal.id,
                          name: goal.name,
                          description: goal.description,
                          targetAmount: goal.targetAmount.toString(),
                          targetDate: goal.targetDate,
                          status: goal.status,
                        }}
                      />
                      <form action={archiveGoalAction}>
                        <input type="hidden" name="goalId" value={goal.id} />
                        <ConfirmSubmitButton
                          variant="ghost"
                          className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          message={`Tutup target "${goal.name}"? Semua cadangan dana (${formatMoney(goal.savedAmount)}) akan dilepas kembali ke saldo bebas akun. Saldo rekening bank Anda tetap utuh.`}
                          title="Tutup target tabungan"
                          aria-label={`Tutup target ${goal.name}`}
                        >
                          <Archive className="size-3" aria-hidden="true" />
                          <span>Tutup</span>
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>

        {/* Right Column: Create Goal Card (Desktop form) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Buat Target Baru</CardTitle>
              <CardDescription className="text-xs">
                Tentukan target nominal untuk dana darurat, pembelian aset, atau tabungan rencana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GoalForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
