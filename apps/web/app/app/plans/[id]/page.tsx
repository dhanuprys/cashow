import { formatMoney } from "@cashow/domain";
import { getPlan, listTransactions } from "@cashow/services";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { LinkButton } from "@/components/ledger/link-button";
import { PlanForm } from "@/components/ledger/plan-form";
import { PlanItemForm } from "@/components/ledger/plan-item-form";
import { SubmitButton } from "@/components/ledger/submit-button";
import { TransactionList } from "@/components/ledger/transaction-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { archivePlanAction, deletePlanItemAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayLocalDate, PLAN_ITEM_STATUS_LABEL, PLAN_STATUS_LABEL } from "@/lib/format";
import { ledgerErrorCode, unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <PlanDetail params={params} />
    </Suspense>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "RECEIVED" || status === "COMPLETED") return "secondary";
  if (status === "OVERDUE") return "destructive";
  if (status === "OVER_RECEIVED") return "outline";
  return "default";
}

async function PlanDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const { id } = await params;

  const result = await getPlan(ctx, id);
  if (!result.ok) {
    if (ledgerErrorCode(result.error) === "NOT_FOUND") notFound();
    throw result.error;
  }
  const plan = result.value;
  const payments = unwrap(await listTransactions(ctx, { planId: plan.id, limit: 200 }));
  const archived = plan.archivedAt !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Semua rencana
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(plan.status)}>
                  {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
                </Badge>
                {archived ? <Badge variant="secondary">Arsip</Badge> : null}
              </div>
              <CardTitle className="mt-3 text-2xl">{plan.name}</CardTitle>
              {plan.description === null ? null : (
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {archived ? (
                <form action={archivePlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="archived" value="false" />
                  <SubmitButton size="sm" variant="outline">
                    <ArchiveRestore aria-hidden="true" />
                    Aktifkan
                  </SubmitButton>
                </form>
              ) : (
                <>
                  <LinkButton
                    href={`/app/transactions/new?type=INCOME&planItemId=${
                      plan.items.find((item) => item.outstanding > 0n)?.id ?? ""
                    }`}
                    size="sm"
                  >
                    <Plus aria-hidden="true" />
                    Catat pembayaran
                  </LinkButton>
                  <form action={archivePlanAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="archived" value="true" />
                    <SubmitButton size="sm" variant="outline" pendingLabel="Mengarsipkan…">
                      <Archive aria-hidden="true" />
                      Arsipkan
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Diharapkan</p>
              <p className="mt-1 font-semibold tabular-nums">{formatMoney(plan.expectedTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diterima</p>
              <p className="mt-1 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(plan.receivedTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sisa</p>
              <p className="mt-1 font-semibold tabular-nums">{formatMoney(plan.outstanding)}</p>
            </div>
          </div>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  plan.status === "COMPLETED" ? "bg-emerald-500" : "bg-foreground/70",
                )}
                style={{ width: `${plan.progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{plan.progress}% diterima</p>
          </div>

          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Ubah nama &amp; keterangan
            </summary>
            <div className="mt-3 rounded-2xl border border-border p-4">
              <PlanForm plan={{ id: plan.id, name: plan.name, description: plan.description }} />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tahap pembayaran</CardTitle>
          <CardDescription>
            Status, sisa, dan progres dihitung dari pemasukan yang dikaitkan ke tiap tahap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.items.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Belum ada tahap</EmptyTitle>
                <EmptyDescription>
                  Pecah nilai proyek menjadi DP, termin, dan pelunasan.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="space-y-4">
              {plan.items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{item.label}</span>
                        <Badge variant={statusVariant(item.status)}>
                          {PLAN_ITEM_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Diterima {formatMoney(item.receivedAmount)} dari{" "}
                        {formatMoney(item.expectedAmount)}
                        {item.dueOn === null
                          ? ""
                          : ` · jatuh tempo ${displayLocalDate(item.dueOn)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.outstanding)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">sisa</p>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.status === "RECEIVED" || item.status === "OVER_RECEIVED"
                          ? "bg-emerald-500"
                          : "bg-foreground/70",
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  {item.note === null ? null : (
                    <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {archived ? null : (
                      <LinkButton
                        href={`/app/transactions/new?type=INCOME&planItemId=${item.id}`}
                        variant="outline"
                        size="sm"
                      >
                        <CircleDollarSign aria-hidden="true" />
                        Catat pembayaran
                      </LinkButton>
                    )}
                    {item.incomeCount > 0 ? null : (
                      <form action={deletePlanItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="planId" value={plan.id} />
                        <ConfirmSubmitButton
                          message="Hapus tahap ini? Tindakan ini tidak bisa dibatalkan."
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" />
                          Hapus tahap
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>

                  {archived ? null : (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Ubah tahap
                      </summary>
                      <div className="mt-3 rounded-xl bg-muted/30 p-4">
                        <PlanItemForm
                          planId={plan.id}
                          item={{
                            id: item.id,
                            label: item.label,
                            expectedAmount: item.expectedAmount.toString(),
                            dueOn: item.dueOn,
                            note: item.note,
                          }}
                        />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}

          {archived ? (
            <p className="text-xs text-muted-foreground">
              Rencana yang diarsipkan tidak bisa diubah atau menerima pembayaran baru.
            </p>
          ) : (
            <details className="rounded-2xl border border-border p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Pencil className="size-4" aria-hidden="true" />
                Tambah tahap
              </summary>
              <div className="mt-4">
                <PlanItemForm planId={plan.id} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pembayaran</CardTitle>
          <CardDescription>{payments.total} pemasukan dikaitkan ke rencana ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionList
            items={payments.items}
            empty={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Belum ada pembayaran</EmptyTitle>
                  <EmptyDescription>
                    Catat pemasukan dan pilih tahap yang sedang dibayar.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
