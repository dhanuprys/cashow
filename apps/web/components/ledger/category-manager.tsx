"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CategoryForm,
  type CategoryFormValues,
  type ParentOption,
} from "@/components/ledger/category-form";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { archiveCategoryAction } from "@/lib/actions/ledger";
import { cn } from "@/lib/utils";

export interface CategoryItem {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  parentId: string | null;
  archivedAt: string | null;
  transactionCount: number;
}

export function CategoryManager({
  categories,
  parentOptions,
}: {
  categories: CategoryItem[];
  parentOptions: (kind: "INCOME" | "EXPENSE") => ParentOption[];
}) {
  const [activeTab, setActiveTab] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryFormValues | undefined>(undefined);
  const [dialogDefaultKind, setDialogDefaultKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [dialogDefaultParentId, setDialogDefaultParentId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Aggregate stats
  const stats = useMemo(() => {
    let expenseCount = 0;
    let incomeCount = 0;
    let expenseTxCount = 0;
    let incomeTxCount = 0;
    let archivedCount = 0;

    for (const c of categories) {
      if (c.archivedAt !== null) {
        archivedCount++;
      } else {
        if (c.kind === "EXPENSE") {
          expenseCount++;
          expenseTxCount += c.transactionCount;
        } else {
          incomeCount++;
          incomeTxCount += c.transactionCount;
        }
      }
    }

    return { expenseCount, incomeCount, expenseTxCount, incomeTxCount, archivedCount };
  }, [categories]);

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (!showArchived && c.archivedAt !== null) return false;
      if (activeTab !== "ALL" && c.kind !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const parentName = c.parentId ? byId.get(c.parentId)?.name?.toLowerCase() : "";
        if (!matchesName && !parentName?.includes(q)) return false;
      }
      return true;
    });
  }, [categories, showArchived, activeTab, searchQuery, byId]);

  // Build tree structure for display
  const { roots, childrenMap } = useMemo(() => {
    const roots: CategoryItem[] = [];
    const childrenMap = new Map<string, CategoryItem[]>();

    for (const c of filteredCategories) {
      if (c.parentId && byId.has(c.parentId)) {
        const list = childrenMap.get(c.parentId) ?? [];
        list.push(c);
        childrenMap.set(c.parentId, list);
      } else {
        roots.push(c);
      }
    }

    return { roots, childrenMap };
  }, [filteredCategories, byId]);

  function handleOpenCreate(kind?: "INCOME" | "EXPENSE", parentId?: string) {
    setEditingCategory(undefined);
    setDialogDefaultKind(kind ?? (activeTab === "INCOME" ? "INCOME" : "EXPENSE"));
    setDialogDefaultParentId(parentId ?? null);
    setDialogOpen(true);
  }

  function handleOpenEdit(c: CategoryItem) {
    setEditingCategory({
      id: c.id,
      name: c.name,
      kind: c.kind,
      parentId: c.parentId,
    });
    setDialogDefaultKind(c.kind);
    setDialogDefaultParentId(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "EXPENSE" ? "ALL" : "EXPENSE")}
          className={cn(
            "flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border p-3.5 shadow-2xs transition-all cursor-pointer text-left w-full",
            activeTab === "EXPENSE"
              ? "border-rose-500/50 bg-rose-500/10 ring-1 ring-rose-500/30"
              : "border-border/80 bg-card/80 hover:bg-muted/40",
          )}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400">
              <TrendingDown className="size-3.5" aria-hidden="true" />
              <span>Kategori Pengeluaran</span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
              {stats.expenseTxCount} total mutasi terkait
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-2">
            <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {stats.expenseCount}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "INCOME" ? "ALL" : "INCOME")}
          className={cn(
            "flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border p-3.5 shadow-2xs transition-all cursor-pointer text-left w-full",
            activeTab === "INCOME"
              ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
              : "border-border/80 bg-card/80 hover:bg-muted/40",
          )}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              <span>Kategori Pemasukan</span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
              {stats.incomeTxCount} total mutasi terkait
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-2">
            <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {stats.incomeCount}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "flex flex-row items-center justify-between sm:flex-col sm:items-start rounded-2xl border p-3.5 shadow-2xs transition-all cursor-pointer text-left w-full",
            showArchived
              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
              : "border-border/80 bg-card/80 hover:bg-muted/40",
          )}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Archive className="size-3.5" aria-hidden="true" />
              <span>Arsip Kategori</span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
              {showArchived ? "Menampilkan arsip" : "Disembunyikan"}
            </p>
          </div>
          <div className="text-right sm:text-left sm:mt-2">
            <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {stats.archivedCount}
            </p>
          </div>
        </button>
      </div>

      {/* Toolbar & Filters */}
      <Card>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kategori atau subkategori…"
                className="pl-9 w-full"
                aria-label="Cari kategori"
              />
            </div>

            {/* Filter buttons & Action CTA */}
            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    activeTab === "ALL"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("EXPENSE")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    activeTab === "EXPENSE"
                      ? "bg-background text-rose-700 dark:text-rose-400 shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("INCOME")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    activeTab === "INCOME"
                      ? "bg-background text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Pemasukan
                </button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenCreate()}
                className="gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Kategori
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Content List */}
      <div className="space-y-4">
        {roots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <Layers className="size-8 stroke-[1.5] text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? "Tidak ada kategori yang cocok" : "Belum ada kategori"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {searchQuery
                  ? "Coba gunakan kata kunci pencarian yang lain atau atur filter tab."
                  : "Buat kategori untuk mengelompokkan catatan transaksi dan mempermudah budgeting."}
              </p>
              {!searchQuery && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpenCreate()}
                  className="mt-3 gap-1.5"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Buat Kategori Pertama
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {roots.map((root) => {
              const children = childrenMap.get(root.id) ?? [];
              const isIncome = root.kind === "INCOME";

              return (
                <div
                  key={root.id}
                  className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-colors hover:border-border"
                >
                  {/* Parent Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                          isIncome
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                        )}
                        aria-hidden="true"
                      >
                        {isIncome ? (
                          <TrendingUp className="size-4" />
                        ) : (
                          <TrendingDown className="size-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base text-foreground break-words">
                            {root.name}
                          </span>
                          <Badge
                            variant={isIncome ? "default" : "secondary"}
                            className="text-[10px] py-0 px-1.5 font-medium"
                          >
                            {isIncome ? "Pemasukan" : "Pengeluaran"}
                          </Badge>
                          {root.archivedAt !== null && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              Arsip
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <Link
                            href={`/app/transactions?categoryId=${root.id}`}
                            className="hover:text-primary hover:underline font-medium"
                          >
                            {root.transactionCount} transaksi
                          </Link>
                          {children.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{children.length} subkategori</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 w-full sm:w-auto justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenCreate(root.kind, root.id)}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Tambah subkategori di bawah kategori ini"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        Subkategori
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenEdit(root)}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                        Ubah
                      </Button>

                      <form action={archiveCategoryAction}>
                        <input type="hidden" name="categoryId" value={root.id} />
                        <input
                          type="hidden"
                          name="archived"
                          value={root.archivedAt === null ? "true" : "false"}
                        />
                        <SubmitButton
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-foreground"
                          pendingLabel="…"
                        >
                          {root.archivedAt === null ? (
                            <>
                              <Archive className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">Arsipkan {root.name}</span>
                            </>
                          ) : (
                            <>
                              <ArchiveRestore className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">Aktifkan {root.name}</span>
                            </>
                          )}
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  {/* Subcategories (Children) */}
                  {children.length > 0 && (
                    <div className="bg-muted/15 border-t border-border/60 divide-y divide-border/40">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 pl-8 sm:pl-12 gap-2 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ChevronRight
                              className="size-3.5 text-muted-foreground/60 shrink-0"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {child.name}
                                </span>
                                {child.archivedAt !== null && (
                                  <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                    Arsip
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                <Link
                                  href={`/app/transactions?categoryId=${child.id}`}
                                  className="hover:text-primary hover:underline"
                                >
                                  {child.transactionCount} transaksi
                                </Link>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 self-end sm:self-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleOpenEdit(child)}
                              className="gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Pencil className="size-3" aria-hidden="true" />
                              Ubah
                            </Button>

                            <form action={archiveCategoryAction}>
                              <input type="hidden" name="categoryId" value={child.id} />
                              <input
                                type="hidden"
                                name="archived"
                                value={child.archivedAt === null ? "true" : "false"}
                              />
                              <SubmitButton
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-foreground"
                                pendingLabel="…"
                              >
                                {child.archivedAt === null ? (
                                  <>
                                    <Archive className="size-3" aria-hidden="true" />
                                    <span className="sr-only">Arsipkan {child.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <ArchiveRestore className="size-3" aria-hidden="true" />
                                    <span className="sr-only">Aktifkan {child.name}</span>
                                  </>
                                )}
                              </SubmitButton>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dialog for Create & Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-lg sm:rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/40">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <FolderTree className="size-4 sm:size-5 text-primary shrink-0" aria-hidden="true" />
              <span>
                {editingCategory
                  ? `Ubah Kategori: ${editingCategory.name}`
                  : "Tambah Kategori Baru"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingCategory
                ? "Perbarui nama atau induk kategori ini."
                : "Tentukan nama, jenis transaksi, dan relasi induk kategori."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-6">
            <CategoryForm
              key={editingCategory?.id ?? `new-${dialogDefaultKind}-${dialogDefaultParentId}`}
              category={editingCategory}
              parents={parentOptions(dialogDefaultKind)}
              defaultKind={dialogDefaultKind}
              defaultParentId={dialogDefaultParentId}
              onSuccess={() => setDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
