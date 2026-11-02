import { parseDbTimestamp, toLocalDateTimeInput } from "@cashow/domain";
import {
  getTransaction,
  listAccounts,
  listCategories,
  listOpenIncomes,
  listPlanItemOptions,
} from "@cashow/services";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { PageSkeleton } from "@/components/ledger/page-skeleton";
import { TransactionForm } from "@/components/ledger/transaction-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayLocalDate } from "@/lib/format";
import { ledgerErrorCode, unwrap } from "@/lib/ledger";

export const metadata = {
  title: "Ubah transaksi",
};

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditTransaction params={params} />
    </Suspense>
  );
}

async function EditTransaction({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const { id } = await params;

  const detail = await getTransaction(ctx, id);
  if (!detail.ok) {
    if (ledgerErrorCode(detail.error) === "NOT_FOUND") notFound();
    throw detail.error;
  }
  const transaction = detail.value;

  if (transaction.type !== "INCOME" && transaction.type !== "EXPENSE") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Transaksi {transaction.type.toLowerCase()} tidak bisa diubah dari halaman ini.
        </p>
        <LinkButton href={`/app/transactions/${transaction.id}`} variant="outline" size="sm">
          <ArrowLeft aria-hidden="true" />
          Kembali ke detail
        </LinkButton>
      </div>
    );
  }

  const [accounts, categories, incomes, planItems] = await Promise.all([
    listAccounts(ctx),
    listCategories(ctx),
    listOpenIncomes(ctx, { excludeExpenseId: transaction.id, includeFullyAllocated: true }),
    listPlanItemOptions(ctx, { includeItemId: transaction.planItemId ?? undefined }),
  ]);

  const accountList = unwrap(accounts).filter(
    (account) => account.archivedAt === null || account.id === transaction.accountId,
  );
  const categoryList = unwrap(categories).filter(
    (category) => category.archivedAt === null || category.id === transaction.categoryId,
  );
  const byId = new Map(unwrap(categories).map((category) => [category.id, category]));

  const allocationByIncome = new Map<string, bigint>();
  for (const allocation of transaction.allocations) {
    if (transaction.type === "EXPENSE") {
      allocationByIncome.set(
        allocation.incomeId,
        (allocationByIncome.get(allocation.incomeId) ?? 0n) + allocation.amount,
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/app/transactions/${transaction.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke detail
      </Link>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Ubah catatan
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Ubah transaksi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jenis transaksi tetap. Untuk mengganti jenis, hapus lalu catat ulang.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail transaksi</CardTitle>
          <CardDescription>Perubahan tercatat di audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            accounts={accountList.map((account) => ({ id: account.id, name: account.name }))}
            categories={categoryList.map((category) => ({
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
            planItems={unwrap(planItems).map((item) => ({
              id: item.id,
              label: item.label,
              planName: item.planName,
              outstanding: item.outstanding.toString(),
              dueOn: item.dueOn,
            }))}
            initial={{
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount.toString(),
              accountId: transaction.accountId,
              categoryId: transaction.categoryId,
              planItemId: transaction.planItemId,
              merchant: transaction.merchant,
              counterparty: transaction.counterparty,
              note: transaction.note,
              occurredAtLocal: toLocalDateTimeInput(
                parseDbTimestamp(transaction.occurredAt),
                user.timezone,
              ),
              allocations: [...allocationByIncome].map(([incomeId, amount]) => ({
                incomeId,
                amount: amount.toString(),
              })),
            }}
            defaultOccurredAtLocal={toLocalDateTimeInput(
              parseDbTimestamp(transaction.occurredAt),
              user.timezone,
            )}
            timezone={user.timezone}
          />
        </CardContent>
      </Card>
    </div>
  );
}
