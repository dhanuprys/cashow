import { categoryInputSchema, categoryUpdateSchema, firstIssue } from "@cashow/domain";
import { writeAudit } from "./audit";
import type { DbTransaction, QueryClient, UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

export type CategoryKind = "INCOME" | "EXPENSE";

export interface CategorySummary {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  archivedAt: string | null;
  /** Live transactions that use this category. */
  transactionCount: number;
}

interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  parentId: string;
  icon: string;
  color: string;
  archivedAt: string;
  transactionCount: bigint;
}

/**
 * Categories for the owner.
 *
 * The transaction count is a correlated subquery per row, so it is opt-in:
 * pickers that only need names (the dashboard, quick add) skip it entirely.
 */
export async function listCategories(
  ctx: UseCaseContext,
  options: { withTransactionCount?: boolean } = {},
): Promise<Result<CategorySummary[]>> {
  const withCount = options.withTransactionCount ?? false;
  const columns = {
    id: "pg/text@1",
    name: "pg/text@1",
    kind: "pg/text@1",
    parentId: "pg/text@1",
    icon: "pg/text@1",
    color: "pg/text@1",
    archivedAt: "pg/text@1",
    transactionCount: "pg/int8@1",
  } as const;

  try {
    const plan = withCount
      ? ctx.db.raw.sql`
          SELECT c."id" AS id,
                 c."name" AS name,
                 c."kind" AS kind,
                 COALESCE(c."parentId", '') AS "parentId",
                 COALESCE(c."icon", '') AS icon,
                 COALESCE(c."color", '') AS color,
                 COALESCE(c."archivedAt"::text, '') AS "archivedAt",
                 (SELECT count(*) FROM "public"."Transaction" t
                   WHERE t."categoryId" = c."id" AND t."deletedAt" IS NULL)::bigint
                   AS "transactionCount"
          FROM "public"."Category" c
          WHERE c."userId" = ${ctx.userId}
          ORDER BY c."kind", (c."archivedAt" IS NOT NULL), c."name"
        `
          .returnsRow(columns)
          .build()
      : ctx.db.raw.sql`
          SELECT c."id" AS id,
                 c."name" AS name,
                 c."kind" AS kind,
                 COALESCE(c."parentId", '') AS "parentId",
                 COALESCE(c."icon", '') AS icon,
                 COALESCE(c."color", '') AS color,
                 COALESCE(c."archivedAt"::text, '') AS "archivedAt",
                 0::bigint AS "transactionCount"
          FROM "public"."Category" c
          WHERE c."userId" = ${ctx.userId}
          ORDER BY c."kind", (c."archivedAt" IS NOT NULL), c."name"
        `
          .returnsRow(columns)
          .build();

    const rows = await ctx.db.query(plan);
    return ok(rows.map(mapCategory));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getCategory(
  client: QueryClient,
  userId: string,
  categoryId: string,
): Promise<CategorySummary | null> {
  const plan = client.raw.sql`
    SELECT c."id" AS id,
           c."name" AS name,
           c."kind" AS kind,
           COALESCE(c."parentId", '') AS "parentId",
           COALESCE(c."icon", '') AS icon,
           COALESCE(c."color", '') AS color,
           COALESCE(c."archivedAt"::text, '') AS "archivedAt",
           (SELECT count(*) FROM "public"."Transaction" t
             WHERE t."categoryId" = c."id" AND t."deletedAt" IS NULL)::bigint AS "transactionCount"
    FROM "public"."Category" c
    WHERE c."userId" = ${userId} AND c."id" = ${categoryId}
  `
    .returnsRow({
      id: "pg/text@1",
      name: "pg/text@1",
      kind: "pg/text@1",
      parentId: "pg/text@1",
      icon: "pg/text@1",
      color: "pg/text@1",
      archivedAt: "pg/text@1",
      transactionCount: "pg/int8@1",
    })
    .build();

  const rows = await client.query(plan);
  const row = rows[0];
  return row === undefined ? null : mapCategory(row);
}

export async function createCategory(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<CategorySummary>> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    const created = await ctx.db.transaction(async (tx) => {
      if (parsed.data.parentId !== null) {
        const parent = await tx.orm.public.Category.where({
          id: parsed.data.parentId,
          userId: ctx.userId,
        }).first();
        if (parent === null) throw new LedgerError("VALIDATION", "Kategori induk tidak ditemukan.");
        if (parent.kind !== parsed.data.kind) {
          throw new LedgerError("VALIDATION", "Kategori induk harus sejenis.");
        }
      }

      const category = await tx.orm.public.Category.create({
        userId: ctx.userId,
        name: parsed.data.name,
        kind: parsed.data.kind as CategoryKind,
        parentId: parsed.data.parentId,
        icon: parsed.data.icon,
        color: parsed.data.color,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Category",
        entityId: category.id,
        action: "CREATE",
        after: category,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Category",
        aggregateId: category.id,
        eventType: "category.created",
        payload: category,
      });

      return category;
    });

    const summary = await getCategory(ctx.db, ctx.userId, created.id);
    if (summary === null) throw new LedgerError("INTERNAL", "Kategori gagal dibaca kembali.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateCategory(
  ctx: UseCaseContext,
  categoryId: string,
  input: unknown,
): Promise<Result<CategorySummary>> {
  const parsed = categoryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Category.where({
        id: categoryId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");

      if (parsed.data.parentId !== undefined && parsed.data.parentId !== null) {
        await assertParentAllowed(tx, ctx.userId, sphere(before), categoryId, parsed.data.parentId);
      }

      const update: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) update.name = parsed.data.name;
      if (parsed.data.parentId !== undefined) update.parentId = parsed.data.parentId;
      if (parsed.data.icon !== undefined) update.icon = parsed.data.icon;
      if (parsed.data.color !== undefined) update.color = parsed.data.color;

      const after = await tx.orm.public.Category.where({
        id: categoryId,
        userId: ctx.userId,
      }).update(update);
      if (after === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Category",
        entityId: categoryId,
        action: "UPDATE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Category",
        aggregateId: categoryId,
        eventType: "category.updated",
        payload: { before, after },
      });
    });

    const summary = await getCategory(ctx.db, ctx.userId, categoryId);
    if (summary === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function setCategoryArchived(
  ctx: UseCaseContext,
  categoryId: string,
  archived: boolean,
): Promise<Result<CategorySummary>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Category.where({
        id: categoryId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");

      if (archived) {
        const activeChildren = await tx.orm.public.Category.where({
          userId: ctx.userId,
          parentId: categoryId,
        })
          .where((row) => row.archivedAt.isNull())
          .all();
        if (activeChildren.length > 0) {
          throw new LedgerError("CONFLICT", "Arsipkan atau pindahkan subkategori terlebih dulu.");
        }
      }

      const after = await tx.orm.public.Category.where({
        id: categoryId,
        userId: ctx.userId,
      }).update({ archivedAt: archived ? new Date().toISOString() : null });
      if (after === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Category",
        entityId: categoryId,
        action: archived ? "ARCHIVE" : "UNARCHIVE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Category",
        aggregateId: categoryId,
        eventType: archived ? "category.archived" : "category.unarchived",
        payload: after,
      });
    });

    const summary = await getCategory(ctx.db, ctx.userId, categoryId);
    if (summary === null) throw new LedgerError("NOT_FOUND", "Kategori tidak ditemukan.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Default categories for a new owner. The quick-add sheet is only fast if a
 * category exists on the first tap; setup calls this once.
 */
export async function ensureDefaultCategories(tx: DbTransaction, userId: string): Promise<void> {
  const existing = await tx.orm.public.Category.where({ userId }).first();
  if (existing !== null) return;

  const defaults: ReadonlyArray<{ name: string; kind: CategoryKind }> = [
    { name: "Gaji", kind: "INCOME" },
    { name: "Pembayaran proyek", kind: "INCOME" },
    { name: "Dukungan keluarga", kind: "INCOME" },
    { name: "Pengembalian", kind: "INCOME" },
    { name: "Lainnya", kind: "INCOME" },
    { name: "Makan", kind: "EXPENSE" },
    { name: "Transportasi", kind: "EXPENSE" },
    { name: "Belanja", kind: "EXPENSE" },
    { name: "Tagihan", kind: "EXPENSE" },
    { name: "Kesehatan", kind: "EXPENSE" },
    { name: "Hiburan", kind: "EXPENSE" },
    { name: "Lainnya", kind: "EXPENSE" },
  ];

  for (const category of defaults) {
    const created = await tx.orm.public.Category.create({
      userId,
      name: category.name,
      kind: category.kind,
    });
    await writeAudit(tx, {
      userId,
      entityType: "Category",
      entityId: created.id,
      action: "CREATE",
      after: created,
      actorId: null,
    });
  }
}

/**
 * Seed a rich set of Indonesian standard categories for an owner, skipping any
 * that already exist. Useful if the owner starts fresh or wants standard presets.
 */
export async function seedStandardCategories(
  ctx: UseCaseContext,
): Promise<Result<{ created: number }>> {
  const defaults: ReadonlyArray<{ name: string; kind: CategoryKind }> = [
    { name: "Makanan & Minuman", kind: "EXPENSE" },
    { name: "Transportasi", kind: "EXPENSE" },
    { name: "Belanja Harian", kind: "EXPENSE" },
    { name: "Tagihan & Utilitas", kind: "EXPENSE" },
    { name: "Kesehatan & Medis", kind: "EXPENSE" },
    { name: "Hiburan & Rekreasi", kind: "EXPENSE" },
    { name: "Pendidikan", kind: "EXPENSE" },
    { name: "Keluarga & Donasi", kind: "EXPENSE" },
    { name: "Gaji Pokok", kind: "INCOME" },
    { name: "Bonus & Tunjangan", kind: "INCOME" },
    { name: "Hasil Usaha", kind: "INCOME" },
    { name: "Investasi & Bunga", kind: "INCOME" },
  ];

  try {
    let createdCount = 0;
    await ctx.db.transaction(async (tx) => {
      const existing = await tx.orm.public.Category.where({ userId: ctx.userId }).all();
      const existingNames = new Set(
        existing.map((c) => `${c.kind}:${c.name.toLowerCase().trim()}`),
      );

      for (const item of defaults) {
        const key = `${item.kind}:${item.name.toLowerCase().trim()}`;
        if (!existingNames.has(key)) {
          const created = await tx.orm.public.Category.create({
            userId: ctx.userId,
            name: item.name,
            kind: item.kind,
          });
          await writeAudit(tx, {
            userId: ctx.userId,
            entityType: "Category",
            entityId: created.id,
            action: "CREATE",
            after: created,
            actorId: null,
          });
          createdCount++;
        }
      }
    });

    return ok({ created: createdCount });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

function sphere(category: { kind: string }): CategoryKind {
  return category.kind as CategoryKind;
}

/** Walk the parent chain so an edit cannot create a cycle. */
async function assertParentAllowed(
  tx: DbTransaction,
  userId: string,
  kind: CategoryKind,
  categoryId: string,
  parentId: string,
): Promise<void> {
  if (parentId === categoryId) {
    throw new LedgerError("VALIDATION", "Kategori tidak bisa menjadi induk dirinya sendiri.");
  }

  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor !== null) {
    if (cursor === categoryId) {
      throw new LedgerError("VALIDATION", "Kategori tidak bisa dipindah ke bawah subkategorinya.");
    }
    if (seen.has(cursor)) throw new LedgerError("CONFLICT", "Struktur kategori berputar.");
    seen.add(cursor);

    const parent: { kind: string; parentId: string | null } | null =
      await tx.orm.public.Category.where({
        id: cursor,
        userId,
      }).first();
    if (parent === null) throw new LedgerError("VALIDATION", "Kategori induk tidak ditemukan.");
    if (parent.kind !== kind) {
      throw new LedgerError("VALIDATION", "Kategori induk harus sejenis.");
    }
    cursor = parent.parentId;
  }
}

function mapCategory(row: CategoryRow): CategorySummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as CategoryKind,
    parentId: row.parentId === "" ? null : row.parentId,
    icon: row.icon === "" ? null : row.icon,
    color: row.color === "" ? null : row.color,
    archivedAt: row.archivedAt === "" ? null : row.archivedAt,
    transactionCount: Number(row.transactionCount),
  };
}
