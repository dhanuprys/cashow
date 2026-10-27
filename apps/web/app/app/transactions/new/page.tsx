import { listAccounts, listCategories, listOpenIncomes } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import { TransactionForm } from "@/components/ledger/transaction-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayLocalDate, nowLocalInput } from "@/lib/format";
import { unwrap } from "@/lib/ledger";

export default function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <NewTransaction searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTransaction({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const params = await searchParams;

  const [accounts, categories, incomes] = await Promise.all([
    listAccounts(ctx),
    listCategories(ctx),
    listOpenIncomes(ctx),
  ]);

  const accountList = unwrap(accounts).filter((account) => account.archivedAt === null);
  const categoryList = unwrap(categories);
  const byId = new Map(categoryList.map((category) => [category.id, category]));
  const defaultType = params.type === "INCOME" ? "INCOME" : "EXPENSE";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Catatan baru
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Tambah transaksi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jumlah, akun, dan tanggal. Alokasi ke pemasukan bersifat opsional.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail transaksi</CardTitle>
          <CardDescription>Semua jumlah dalam rupiah utuh.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            accounts={accountList.map((account) => ({ id: account.id, name: account.name }))}
            categories={categoryList
              .filter((category) => category.archivedAt === null)
              .map((category) => ({
                id: category.id,
                name: category.name,
                kind: category.kind,
                parentName:
                  category.parentId === null ? null : (byId.get(category.parentId)?.name ?? null),
              }))}
            incomes={unwrap(incomes).map((income) => ({
              id: income.id,
              label: income.categoryName ?? income.note ?? "Pemasukan",
              occurredOn: displayLocalDate(income.occurredOn),
              free: income.free.toString(),
            }))}
            defaultType={defaultType}
            defaultOccurredAtLocal={nowLocalInput(new Date(), user.timezone)}
            timezone={user.timezone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
