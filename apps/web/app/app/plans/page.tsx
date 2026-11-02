import { formatMoney } from "@cashow/domain";
import { listPlans } from "@cashow/services";
import { ChevronRight, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { PlanForm } from "@/components/ledger/plan-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayLocalDate, PLAN_STATUS_LABEL } from "@/lib/format";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Rencana",
};

export default function PlansPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Pemasukan bertahap
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Rencana pembayaran
          </h1>
        </div>
        <LinkButton href="/app/transactions/new?type=INCOME">
          <Plus aria-hidden="true" />
          Catat pembayaran
        </LinkButton>
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-48 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton />
          </div>
        }
      >
        <Plans />
      </Suspense>
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "secondary";
  if (status === "OVERDUE") return "destructive";
  return "default";
}

async function Plans() {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const plans = unwrap(await listPlans(ctx, { includeArchived: true }));
  const live = plans.filter((plan) => plan.archivedAt === null);
  const archived = plans.filter((plan) => plan.archivedAt !== null);
  const outstanding = live.reduce((sum, plan) => sum + plan.outstanding, 0n);

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        {live.length} rencana aktif · sisa {formatMoney(outstanding)}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {plans.length === 0 ? (
            <Card>
              <CardContent>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada rencana</EmptyTitle>
                    <EmptyDescription>
                      Buat rencana untuk proyek yang dibayar bertahap, lalu kaitkan setiap pemasukan
                      ke tahapnya.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            [...live, ...archived].map((plan) => {
              const nextItem = plan.items.find(
                (item) => item.status !== "RECEIVED" && item.status !== "OVER_RECEIVED",
              );
              return (
                <Link key={plan.id} href={`/app/plans/${plan.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/30">
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                            <Layers className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              <span className="truncate">{plan.name}</span>
                              <Badge variant={statusVariant(plan.status)}>
                                {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
                              </Badge>
                              {plan.archivedAt === null ? null : (
                                <Badge variant="secondary">Arsip</Badge>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {plan.itemCount} tahap · diterima {formatMoney(plan.receivedTotal)}{" "}
                              dari {formatMoney(plan.expectedTotal)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatMoney(plan.outstanding)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">sisa</p>
                          </div>
                          <ChevronRight
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            plan.status === "COMPLETED" ? "bg-emerald-500" : "bg-foreground/70",
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(plan.progress, plan.progress > 0 ? 3 : 0))}%`,
                          }}
                        />
                      </div>

                      {plan.description === null ? null : (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      )}
                      {nextItem === undefined ? null : (
                        <p className="text-[11px] text-muted-foreground">
                          Berikutnya: {nextItem.label}
                          {nextItem.dueOn === null
                            ? ""
                            : ` · jatuh tempo ${displayLocalDate(nextItem.dueOn)}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rencana baru</CardTitle>
            <CardDescription>Buat wadahnya dulu; tahap ditambahkan setelah ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
