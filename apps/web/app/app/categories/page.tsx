import { listCategories } from "@cashow/services";
import { Archive, ArchiveRestore, Sparkles, Tags } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryForm } from "@/components/ledger/category-form";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { archiveCategoryAction, seedCategoriesAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export const metadata = {
  title: "Kategori",
};

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Struktur
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Kategori
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kategori bisa punya subkategori. Jenisnya tidak berubah setelah dibuat.
          </p>
        </div>
        <form action={seedCategoriesAction}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Menyiapkan…">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Pasang Kategori Standar
          </SubmitButton>
        </form>
      </section>

      <Suspense fallback={<ContentSkeleton />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const categories = unwrap(await listCategories(ctx, { withTransactionCount: true }));
  const byId = new Map(categories.map((category) => [category.id, category]));

  const parentOptions = (kind: "INCOME" | "EXPENSE") =>
    categories
      .filter((category) => category.kind === kind && category.archivedAt === null)
      .map((category) => ({
        id: category.id,
        name: category.name,
        parentName: category.parentId === null ? null : (byId.get(category.parentId)?.name ?? null),
        kind: category.kind,
      }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {(["EXPENSE", "INCOME"] as const).map((kind) => {
            const rows = categories.filter((category) => category.kind === kind);
            return (
              <Card key={kind}>
                <CardHeader>
                  <CardTitle>{kind === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}</CardTitle>
                  <CardDescription>{rows.length} kategori.</CardDescription>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <Empty className="border">
                      <EmptyHeader>
                        <EmptyTitle>Belum ada kategori</EmptyTitle>
                        <EmptyDescription>
                          Buat kategori pengeluaran atau pemasukan.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <ul className="space-y-2">
                      {rows.map((category) => (
                        <li key={category.id} className="rounded-2xl border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                                <Tags className="size-3.5" aria-hidden="true" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                  <span className="break-words line-clamp-2">{category.name}</span>
                                  {category.archivedAt === null ? null : (
                                    <Badge variant="secondary" className="shrink-0">
                                      Arsip
                                    </Badge>
                                  )}
                                  {category.parentId === null ? null : (
                                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                      di bawah {byId.get(category.parentId)?.name ?? "induk"}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {category.transactionCount} transaksi
                                </p>
                              </div>
                            </div>

                            <form action={archiveCategoryAction} className="shrink-0">
                              <input type="hidden" name="categoryId" value={category.id} />
                              <input
                                type="hidden"
                                name="archived"
                                value={category.archivedAt === null ? "true" : "false"}
                              />
                              <SubmitButton variant="ghost" size="icon-sm" pendingLabel="…">
                                {category.archivedAt === null ? (
                                  <>
                                    <Archive aria-hidden="true" />
                                    <span className="sr-only">Arsipkan {category.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <ArchiveRestore aria-hidden="true" />
                                    <span className="sr-only">Aktifkan {category.name}</span>
                                  </>
                                )}
                              </SubmitButton>
                            </form>
                          </div>

                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              Ubah kategori
                            </summary>
                            <div className="mt-3">
                              <CategoryForm
                                category={{
                                  id: category.id,
                                  name: category.name,
                                  kind: category.kind,
                                  parentId: category.parentId,
                                }}
                                parents={parentOptions(category.kind)}
                              />
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tambah kategori</CardTitle>
            <CardDescription>Mulai dari jenis pengeluaran atau pemasukan.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm parents={[...parentOptions("EXPENSE"), ...parentOptions("INCOME")]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
