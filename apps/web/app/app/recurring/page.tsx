import { formatMoney } from "@cashow/domain";
import { listAccounts, listCategories, listRecurring } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  DeleteRecurringButton,
  RecurringForm,
  RunRecurringButton,
} from "@/components/ledger/recurring-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export default function RecurringPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <Recurring />
    </Suspense>
  );
}

async function Recurring() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [templatesResult, accountsResult, categoriesResult] = await Promise.all([
    listRecurring(ctx),
    listAccounts(ctx),
    listCategories(ctx),
  ]);
  const templates = unwrap(templatesResult);
  const accounts = unwrap(accountsResult).filter((a) => a.archivedAt === null);
  const categories = unwrap(categoriesResult).filter((c) => c.archivedAt === null);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Transaksi berulang
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Template berulang
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {templates.filter((t) => t.active).length} template aktif.
          </p>
        </div>
        <RunRecurringButton />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
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
            templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {template.type} · {formatMoney(template.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {template.accountName} · {template.frequency} · berikutnya{" "}
                        {new Date(template.nextRunAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <DeleteRecurringButton id={template.id} />
                  </div>
                </CardContent>
              </Card>
            ))
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
