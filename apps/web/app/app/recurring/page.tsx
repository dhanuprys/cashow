import { formatMoney } from "@cashow/domain";
import { listAccounts, listCategories, listRecurring, listRecurringDrafts } from "@cashow/services";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Calendar, Clock } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import {
  DeleteRecurringButton,
  EditRecurringDialog,
  RecurringDraftRow,
  RecurringForm,
  RunRecurringButton,
  ToggleRecurringActiveButton,
} from "@/components/ledger/recurring-form";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Transaksi berulang",
};

export default function RecurringPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Otomasi Jadwal
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Transaksi Berulang
          </h1>
        </div>
        <RunRecurringButton />
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-40 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton />
          </div>
        }
      >
        <Recurring />
      </Suspense>
    </div>
  );
}

async function Recurring() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [templatesResult, accountsResult, categoriesResult, draftsResult] = await Promise.all([
    listRecurring(ctx),
    listAccounts(ctx),
    listCategories(ctx),
    listRecurringDrafts(ctx),
  ]);
  const templates = unwrap(templatesResult);
  const accounts = unwrap(accountsResult).filter((a) => a.archivedAt === null);
  const categories = unwrap(categoriesResult).filter((c) => c.archivedAt === null);
  const drafts = unwrap(draftsResult);

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        {templates.filter((t) => t.active).length} template aktif dari total {templates.length}{" "}
        jadwal tersimpan.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {drafts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Draf menunggu konfirmasi</CardTitle>
                <CardDescription>
                  Tidak ada uang berpindah sampai Anda mengonfirmasi draf ini.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {drafts.map((draft) => (
                    <RecurringDraftRow key={draft.id} draft={draft} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {templates.length === 0 ? (
            <Card>
              <CardContent>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada template</EmptyTitle>
                    <EmptyDescription>
                      Buat template untuk sewa, langganan, atau gaji yang terjadwal.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => {
              const income = template.type === "INCOME";
              const transfer = template.type === "TRANSFER";
              const frequencyLabel =
                template.frequency === "MONTHLY"
                  ? "Bulanan"
                  : template.frequency === "WEEKLY"
                    ? "Mingguan"
                    : template.frequency === "DAILY"
                      ? "Harian"
                      : "Tahunan";

              return (
                <Card
                  key={template.id}
                  className={cn(!template.active && "opacity-75 bg-muted/20")}
                >
                  <CardHeader>
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        aria-hidden="true"
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl",
                          income
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : transfer
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                        )}
                      >
                        {income ? (
                          <ArrowDownLeft className="size-4" />
                        ) : transfer ? (
                          <ArrowLeftRight className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <CardTitle className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground text-sm sm:text-base break-words">
                            {template.merchant ??
                              template.counterparty ??
                              template.note ??
                              (transfer
                                ? `Transfer ke ${template.destinationAccountName ?? "akun lain"}`
                                : (template.categoryName ??
                                  (income ? "Pemasukan rutin" : "Pengeluaran rutin")))}
                          </span>
                          <Badge
                            variant={template.active ? "default" : "outline"}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {template.active ? "Aktif" : "Dijeda"}
                          </Badge>
                          <span className="inline-flex shrink-0 items-center rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {frequencyLabel}
                          </span>
                        </CardTitle>

                        <CardDescription className="text-xs text-muted-foreground break-words mt-1">
                          {transfer ? (
                            <>
                              {template.accountName} → {template.destinationAccountName ?? "—"}
                            </>
                          ) : (
                            <>
                              {template.accountName}
                              {template.categoryName ? ` · ${template.categoryName}` : ""}
                            </>
                          )}
                          {template.note ? ` · ${template.note}` : ""}
                        </CardDescription>
                      </div>
                    </div>

                    <CardAction className="text-right">
                      <p
                        className={cn(
                          "text-base sm:text-lg font-semibold tabular-nums tracking-tight",
                          income
                            ? "text-emerald-700 dark:text-emerald-400"
                            : transfer
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-foreground",
                        )}
                      >
                        {income ? "+" : transfer ? "" : "−"}
                        {formatMoney(template.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                        <Calendar className="size-3" aria-hidden="true" />
                        <span>
                          Jadwal: {new Date(template.nextRunAt).toLocaleDateString("id-ID")}
                        </span>
                      </p>
                    </CardAction>
                  </CardHeader>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>
                        {template.lastRunAt
                          ? `Terakhir jalan: ${new Date(template.lastRunAt).toLocaleDateString("id-ID")}`
                          : "Belum pernah dijalankan"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <ToggleRecurringActiveButton id={template.id} active={template.active} />
                      <EditRecurringDialog
                        template={{
                          id: template.id,
                          type: template.type,
                          amount: template.amount.toString(),
                          accountId: template.accountId,
                          destinationAccountId: template.destinationAccountId,
                          categoryId: template.categoryId,
                          merchant: template.merchant,
                          counterparty: template.counterparty,
                          note: template.note,
                          frequency: template.frequency,
                          dayOfMonth: template.dayOfMonth,
                          dayOfWeek: template.dayOfWeek,
                        }}
                        accounts={accounts}
                        categories={categories}
                      />
                      <DeleteRecurringButton id={template.id} />
                    </div>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template baru</CardTitle>
            <CardDescription>Buat transaksi terjadwal.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecurringForm accounts={accounts} categories={categories} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
