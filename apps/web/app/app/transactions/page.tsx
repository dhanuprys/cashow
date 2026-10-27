import { listAccounts, listCategories, listTransactions } from "@cashow/services";
import { ArrowLeftRight, Plus, Search } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { TransactionList } from "@/components/ledger/transaction-list";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

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

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Transactions searchParams={searchParams} />
    </Suspense>
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
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} catatan{includeDeleted ? " termasuk yang dihapus" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <Card>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
            <div className="relative lg:col-span-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Cari catatan, toko, kategori…"
                className="pl-9"
                aria-label="Cari transaksi"
              />
            </div>
            <NativeSelect name="type" defaultValue={type ?? ""} aria-label="Jenis">
              <NativeSelectOption value="">Semua jenis</NativeSelectOption>
              <NativeSelectOption value="EXPENSE">Pengeluaran</NativeSelectOption>
              <NativeSelectOption value="INCOME">Pemasukan</NativeSelectOption>
              <NativeSelectOption value="TRANSFER">Transfer</NativeSelectOption>
            </NativeSelect>
            <NativeSelect name="accountId" defaultValue={params.accountId ?? ""} aria-label="Akun">
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
            >
              <NativeSelectOption value="">Semua kategori</NativeSelectOption>
              {categoryList.map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {category.kind === "INCOME" ? "Masuk" : "Keluar"} · {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="flex gap-2">
              <Input
                type="date"
                name="from"
                defaultValue={params.from ?? ""}
                aria-label="Dari tanggal"
              />
              <Input
                type="date"
                name="to"
                defaultValue={params.to ?? ""}
                aria-label="Sampai tanggal"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground lg:col-span-2">
              <input
                type="checkbox"
                name="deleted"
                value="1"
                defaultChecked={includeDeleted}
                className="size-4 rounded border-border"
              />
              Tampilkan yang dihapus
            </label>
            <div className="flex items-center gap-2 lg:col-span-4 lg:justify-end">
              {hasFilters ? (
                <LinkButton href="/app/transactions" variant="ghost" size="sm">
                  Reset
                </LinkButton>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Terapkan
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
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
    <div className="space-y-6">
      <div className="h-16 w-48 animate-pulse rounded-2xl bg-muted" />
      <div className="h-32 animate-pulse rounded-4xl bg-muted" />
      <div className="h-96 animate-pulse rounded-4xl bg-muted" />
    </div>
  );
}
