import { formatMoney } from "@cashow/domain";
import { listAccounts, listCategories, listTransactions } from "@cashow/services";
import { ArrowLeftRight, Download, Plus, Search } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { DatePicker } from "@/components/ledger/date-picker";
import { LinkButton } from "@/components/ledger/link-button";
import { TransactionList } from "@/components/ledger/transaction-list";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

interface TransactionSearchParams {
  type?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
  from?: string;
  to?: string;
  deleted?: string;
  page?: string;
}

export const metadata = {
  title: "Transaksi",
};

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Buku besar
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Transaksi
          </h1>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <LinkButton href="/app/transactions/new?type=TRANSFER" variant="outline">
            <ArrowLeftRight aria-hidden="true" />
            Transfer
          </LinkButton>
          <LinkButton href="/app/transactions/new">
            <Plus aria-hidden="true" />
            Tambah transaksi
          </LinkButton>
        </div>
      </section>

      <Suspense fallback={<ListSkeleton />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Transactions({ searchParams }: { searchParams: Promise<TransactionSearchParams> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const params = await searchParams;

  const page = Math.max(Number(params.page ?? "1") || 1, 1);
  const type =
    params.type === "INCOME" || params.type === "EXPENSE" || params.type === "TRANSFER"
      ? params.type
      : undefined;
  const includeDeleted = params.deleted === "1";

  const [result, accounts, categories] = await Promise.all([
    listTransactions(ctx, {
      type,
      accountId: params.accountId === "" ? undefined : params.accountId,
      categoryId: params.categoryId === "" ? undefined : params.categoryId,
      search: params.search,
      from: params.from === "" ? undefined : params.from,
      to: params.to === "" ? undefined : params.to,
      includeDeleted,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listAccounts(ctx),
    listCategories(ctx),
  ]);

  const list = unwrap(result);
  const accountList = unwrap(accounts);
  const categoryList = unwrap(categories);
  const totalPages = Math.max(Math.ceil(list.total / PAGE_SIZE), 1);
  const hasFilters =
    type !== undefined ||
    (params.accountId ?? "") !== "" ||
    (params.categoryId ?? "") !== "" ||
    (params.search ?? "") !== "" ||
    (params.from ?? "") !== "" ||
    (params.to ?? "") !== "" ||
    includeDeleted;

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (type !== undefined) query.set("type", type);
    for (const key of ["accountId", "categoryId", "search", "from", "to"] as const) {
      const value = params[key];
      if (value !== undefined && value !== "") query.set(key, value);
    }
    if (includeDeleted) query.set("deleted", "1");
    query.set("page", String(target));
    return `/app/transactions?${query.toString()}`;
  }

  const net = list.totalIncome - list.totalExpense;

  const exportQuery = new URLSearchParams();
  if (type !== undefined) exportQuery.set("type", type);
  for (const key of ["accountId", "categoryId", "search", "from", "to"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") exportQuery.set(key, value);
  }
  if (includeDeleted) exportQuery.set("deleted", "1");
  const exportHref = `/api/transactions/export?${exportQuery.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="-mt-3 text-sm text-muted-foreground">
          {list.total} catatan{includeDeleted ? " termasuk yang dihapus" : ""}.
        </p>
        <a
          href={exportHref}
          download
          className="-mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-muted"
        >
          <Download className="size-3.5 text-muted-foreground" aria-hidden="true" />
          Ekspor CSV
        </a>
      </div>

      {/* Aggregate Stats for the Filtered Query */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-2xs">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Pemasukan</p>
            <p className="text-[11px] text-muted-foreground hidden sm:block">Aliran kas masuk</p>
          </div>
          <p className="text-base sm:text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            +{formatMoney(list.totalIncome)}
          </p>
        </div>
        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-2xs">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Pengeluaran</p>
            <p className="text-[11px] text-muted-foreground hidden sm:block">Aliran kas keluar</p>
          </div>
          <p className="text-base sm:text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
            −{formatMoney(list.totalExpense)}
          </p>
        </div>
        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-2xs">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Arus Bersih (Net)</p>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Selisih masuk & keluar
            </p>
          </div>
          <p
            className={cn(
              "text-base sm:text-lg font-semibold tabular-nums",
              net >= 0n
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400",
            )}
          >
            {net >= 0n ? "+" : "−"}
            {formatMoney(net >= 0n ? net : -net)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-3.5 sm:p-5">
          <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" method="get">
            <div className="relative w-full sm:min-w-[200px] sm:flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Cari catatan, toko, kategori…"
                className="pl-9 w-full"
                aria-label="Cari transaksi"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full sm:w-auto sm:flex-1">
              <NativeSelect
                name="type"
                defaultValue={type ?? ""}
                aria-label="Jenis"
                className="w-full"
              >
                <NativeSelectOption value="">Semua jenis</NativeSelectOption>
                <NativeSelectOption value="EXPENSE">Pengeluaran</NativeSelectOption>
                <NativeSelectOption value="INCOME">Pemasukan</NativeSelectOption>
                <NativeSelectOption value="TRANSFER">Transfer</NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                name="accountId"
                defaultValue={params.accountId ?? ""}
                aria-label="Akun"
                className="w-full"
              >
                <NativeSelectOption value="">Semua akun</NativeSelectOption>
                {accountList.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <NativeSelect
                name="categoryId"
                defaultValue={params.categoryId ?? ""}
                aria-label="Kategori"
                className="w-full"
              >
                <NativeSelectOption value="">Semua kategori</NativeSelectOption>
                {categoryList.map((category) => (
                  <NativeSelectOption key={category.id} value={category.id}>
                    {category.kind === "INCOME" ? "Masuk" : "Keluar"} · {category.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex-1">
              <DatePicker name="from" defaultValue={params.from ?? ""} ariaLabel="Dari tanggal" />
              <DatePicker name="to" defaultValue={params.to ?? ""} ariaLabel="Sampai tanggal" />
            </div>
            <div className="flex flex-col sm:flex-row w-full items-stretch sm:items-center justify-between border-t border-border/40 pt-3 gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="deleted"
                  value="1"
                  defaultChecked={includeDeleted}
                  className="size-4 rounded border-border"
                />
                Tampilkan yang dihapus
              </label>
              <div className="flex items-center gap-2 justify-end">
                {hasFilters ? (
                  <LinkButton href="/app/transactions" variant="ghost" size="sm">
                    Reset
                  </LinkButton>
                ) : null}
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 w-full sm:w-auto"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2 sm:p-6">
          <TransactionList
            items={list.items}
            empty={
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>
                    {hasFilters ? "Tidak ada yang cocok" : "Belum ada transaksi"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? "Coba longgarkan filter atau hapus kata kunci."
                      : "Mulai dari satu pemasukan atau pengeluaran."}
                  </EmptyDescription>
                </EmptyHeader>
                <LinkButton href="/app/transactions/new" size="sm">
                  <Plus aria-hidden="true" />
                  Tambah transaksi
                </LinkButton>
              </Empty>
            }
          />
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <LinkButton href={pageHref(page - 1)} variant="outline" size="sm">
                Sebelumnya
              </LinkButton>
            ) : null}
            {page < totalPages ? (
              <LinkButton href={pageHref(page + 1)} variant="outline" size="sm">
                Berikutnya
              </LinkButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="-mt-3 h-4 w-36 animate-pulse rounded-md bg-muted" />
      <div className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="space-y-2">
        {["a", "b", "c", "d", "e", "f"].map((id) => (
          <div key={id} className="flex items-center gap-3 rounded-2xl border border-border p-4">
            <div className="size-9 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-1/4 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
