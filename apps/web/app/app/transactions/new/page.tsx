import {
  listAccounts,
  listCategories,
  listOpenIncomes,
  listPlanItemOptions,
} from "@cashow/services";

import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { PageSkeleton } from "@/components/ledger/page-skeleton";
import { TransactionForm } from "@/components/ledger/transaction-form";
import { TransferForm } from "@/components/ledger/transfer-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayLocalDate, nowLocalInput } from "@/lib/format";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Catat transaksi",
};

/**
 * Fields delivered by the PWA share target (`manifest.webmanifest`).
 * `type`/`planItemId` are the app's own deep links.
 */
interface NewTransactionParams {
  type?: string;
  planItemId?: string;
  title?: string;
  text?: string;
  url?: string;
  amount?: string;
  accountId?: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
}

/**
 * A share sheet usually sends the page title and the page URL separately from
 * the selected text. Join whatever arrived into one readable note instead of
 * dropping the payload on the floor.
 */
function sharedNote(params: NewTransactionParams): string | undefined {
  if (params.note !== undefined && params.note.trim() !== "") return params.note;
  const parts = [params.text, params.url, params.title]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "");
  const unique = [...new Set(parts)];
  return unique.length === 0 ? undefined : unique.join("\n").slice(0, 1000);
}

export default function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<NewTransactionParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewTransaction searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTransaction({ searchParams }: { searchParams: Promise<NewTransactionParams> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const params = await searchParams;

  const [accounts, categories, incomes, planItems] = await Promise.all([
    listAccounts(ctx),
    listCategories(ctx),
    listOpenIncomes(ctx),
    listPlanItemOptions(ctx),
  ]);

  const accountList = unwrap(accounts).filter((account) => account.archivedAt === null);
  const categoryList = unwrap(categories);
  const byId = new Map(categoryList.map((category) => [category.id, category]));
  const nowInput = nowLocalInput(new Date(), user.timezone);

  const isTransfer = params.type === "TRANSFER";
  const isIncome = params.type === "INCOME";
  const isExpense = !isTransfer && !isIncome;
  const defaultType = isIncome ? "INCOME" : "EXPENSE";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/app/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke transaksi
      </Link>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {isTransfer ? "Pindah dana" : "Catatan baru"}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {isTransfer ? "Transfer antar akun" : "Catat transaksi"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isTransfer
              ? "Perpindahan antar akun sendiri tidak mengubah total kekayaan; biaya transfer dicatat terpisah."
              : "Jumlah, akun, dan tanggal. Alokasi ke pemasukan bersifat opsional."}
          </p>
        </div>

        {/* Unified 3-Type Segmented Pill Switcher */}
        <div className="flex rounded-full bg-muted p-1 w-fit">
          <Link
            href="/app/transactions/new?type=EXPENSE"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              isExpense
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pengeluaran
          </Link>
          <Link
            href="/app/transactions/new?type=INCOME"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              isIncome
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pemasukan
          </Link>
          <Link
            href="/app/transactions/new?type=TRANSFER"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              isTransfer
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Transfer
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isTransfer ? "Detail transfer" : "Detail transaksi"}</CardTitle>
          <CardDescription>Semua jumlah dalam rupiah utuh.</CardDescription>
        </CardHeader>
        <CardContent>
          {isTransfer ? (
            accountList.length < 2 ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Butuh minimal dua akun aktif untuk membuat transfer.</p>
                <LinkButton href="/app/accounts" variant="outline" size="sm">
                  <ArrowLeftRight aria-hidden="true" />
                  Kelola akun
                </LinkButton>
              </div>
            ) : (
              <TransferForm
                accounts={accountList.map((account) => ({
                  id: account.id,
                  name: account.name,
                }))}
                categories={categoryList
                  .filter((category) => category.archivedAt === null && category.kind === "EXPENSE")
                  .map((category) => ({ id: category.id, name: category.name }))}
                defaultOccurredAtLocal={nowInput}
                timezone={user.timezone}
              />
            )
          ) : (
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
              planItems={unwrap(planItems).map((item) => ({
                id: item.id,
                label: item.label,
                planName: item.planName,
                outstanding: item.outstanding.toString(),
                dueOn: item.dueOn,
              }))}
              defaultPlanItemId={params.planItemId}
              defaultType={defaultType}
              defaultAmount={params.amount}
              defaultAccountId={params.accountId}
              defaultCategoryId={params.categoryId}
              defaultMerchant={params.merchant}
              defaultOccurredAtLocal={nowInput}
              defaultNote={sharedNote(params)}
              timezone={user.timezone}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
