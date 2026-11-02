import { listCategories } from "@cashow/services";
import { Sparkles } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { type CategoryItem, CategoryManager } from "@/components/ledger/category-manager";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { SubmitButton } from "@/components/ledger/submit-button";
import { seedCategoriesAction } from "@/lib/actions/ledger";
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
            Atur hierarki kategori dan subkategori untuk pengeluaran dan pemasukan Anda.
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

  const categoryItems: CategoryItem[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId,
    archivedAt: c.archivedAt,
    transactionCount: Number(c.transactionCount),
  }));

  return <CategoryManager categories={categoryItems} />;
}
