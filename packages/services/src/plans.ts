import {
  derivePlanStatus,
  firstIssue,
  type LocalDate,
  localDateSchema,
  type PlanItemStatus,
  type PlanStatus,
  parseDbTimestamp,
  planCreateSchema,
  planItemOutstanding,
  planItemProgress,
  planItemStatus,
  planItemUpdateSchema,
  planUpdateSchema,
  toLocalDate,
} from "@cashow/domain";
import { writeAudit } from "./audit";
import { nowOf, type QueryClient, type UseCaseContext, userTimezone } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

/**
 * Payment plans: a project's chained income. Every figure here is derived from
 * the plan's items and the live incomes linked to each item (plan §2). The
 * database only stores the label, expected amount and due date.
 */

export interface PlanItemSummary {
  id: string;
  planId: string;
  label: string;
  expectedAmount: bigint;
  receivedAmount: bigint;
  outstanding: bigint;
  progress: number;
  status: PlanItemStatus;
  dueOn: LocalDate | null;
  note: string | null;
  sortOrder: number;
  incomeCount: number;
}

export interface PlanSummary {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  expectedTotal: bigint;
  receivedTotal: bigint;
  outstanding: bigint;
  progress: number;
  status: PlanStatus;
  itemCount: number;
  items: PlanItemSummary[];
}

export interface PlanItemOption {
  id: string;
  label: string;
  planId: string;
  planName: string;
  expectedAmount: bigint;
  receivedAmount: bigint;
  outstanding: bigint;
  dueOn: LocalDate | null;
  status: PlanItemStatus;
}

interface PlanRow {
  planId: string;
  planName: string;
  description: string | null;
  archivedAt: string | null;
  planCreatedAt: string;
  itemId: string | null;
  itemLabel: string | null;
  expectedAmount: string | null;
  received: string;
  incomeCount: bigint;
  dueOn: string | null;
  itemNote: string | null;
  sortOrder: bigint | null;
}

const PLAN_ROW_CODECS = {
  planId: "pg/text@1",
  planName: "pg/text@1",
  description: { codecId: "pg/text@1", nullable: true },
  archivedAt: { codecId: "pg/text@1", nullable: true },
  planCreatedAt: "pg/text@1",
  itemId: { codecId: "pg/text@1", nullable: true },
  itemLabel: { codecId: "pg/text@1", nullable: true },
  expectedAmount: { codecId: "pg/text@1", nullable: true },
  received: "pg/text@1",
  incomeCount: "pg/int8@1",
  dueOn: { codecId: "pg/text@1", nullable: true },
  itemNote: { codecId: "pg/text@1", nullable: true },
  sortOrder: { codecId: "pg/int8@1", nullable: true },
} as const;

export async function listPlans(
  ctx: UseCaseContext,
  options: { includeArchived?: boolean } = {},
): Promise<Result<PlanSummary[]>> {
  try {
    const timezone = await userTimezone(ctx.db, ctx.userId);
    const today = toLocalDate(nowOf(ctx), timezone);
    const includeArchived = options.includeArchived === true;
    const rows = await loadPlanRows(ctx.db, ctx.userId, null, includeArchived);
    return ok(buildPlans(rows, today));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getPlan(ctx: UseCaseContext, planId: string): Promise<Result<PlanSummary>> {
  try {
    const timezone = await userTimezone(ctx.db, ctx.userId);
    const today = toLocalDate(nowOf(ctx), timezone);
    const rows = await loadPlanRows(ctx.db, ctx.userId, planId, true);
    const plan = buildPlans(rows, today)[0];
    if (plan === undefined) return err(new LedgerError("NOT_FOUND", "Rencana tidak ditemukan."));
    return ok(plan);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createPlan(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<PlanSummary>> {
  const parsed = planCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const planId = await ctx.db.transaction(async (tx) => {
      const plan = await tx.orm.public.PaymentPlan.create({
        userId: ctx.userId,
        name: data.name,
        description: data.description,
      });

      let sortOrder = 0;
      for (const item of data.items) {
        await tx.orm.public.PaymentPlanItem.create({
          userId: ctx.userId,
          planId: plan.id,
          label: item.label,
          expectedAmount: item.expectedAmount,
          dueOn: item.dueOn,
          note: item.note,
          sortOrder,
        });
        sortOrder += 1;
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlan",
        entityId: plan.id,
        action: "CREATE",
        after: { plan, items: data.items },
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlan",
        aggregateId: plan.id,
        eventType: "payment_plan.created",
        payload: { plan, items: data.items },
      });

      return plan.id;
    });

    return getPlan(ctx, planId);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updatePlan(
  ctx: UseCaseContext,
  planId: string,
  input: unknown,
): Promise<Result<PlanSummary>> {
  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.PaymentPlan.where({
        id: planId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");
      if (before.archivedAt !== null) {
        throw new LedgerError("CONFLICT", "Rencana yang diarsipkan tidak bisa diubah.");
      }

      const after = await tx.orm.public.PaymentPlan.where({
        id: planId,
        userId: ctx.userId,
      }).update({
        name: parsed.data.name,
        description: parsed.data.description,
      });
      if (after === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlan",
        entityId: planId,
        action: "UPDATE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlan",
        aggregateId: planId,
        eventType: "payment_plan.updated",
        payload: { before, after },
      });
    });

    return getPlan(ctx, planId);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function setPlanArchived(
  ctx: UseCaseContext,
  planId: string,
  archived: boolean,
): Promise<Result<PlanSummary>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.PaymentPlan.where({
        id: planId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");

      const after = await tx.orm.public.PaymentPlan.where({
        id: planId,
        userId: ctx.userId,
      }).update({
        archivedAt: archived ? new Date().toISOString() : null,
      });
      if (after === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlan",
        entityId: planId,
        action: archived ? "ARCHIVE" : "UNARCHIVE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlan",
        aggregateId: planId,
        eventType: archived ? "payment_plan.archived" : "payment_plan.unarchived",
        payload: after,
      });
    });

    return getPlan(ctx, planId);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createPlanItem(
  ctx: UseCaseContext,
  planId: string,
  input: unknown,
): Promise<Result<PlanSummary>> {
  const parsed = planItemUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    await ctx.db.transaction(async (tx) => {
      const plan = await tx.orm.public.PaymentPlan.where({
        id: planId,
        userId: ctx.userId,
      }).first();
      if (plan === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");
      if (plan.archivedAt !== null) {
        throw new LedgerError("CONFLICT", "Rencana yang diarsipkan tidak bisa diubah.");
      }

      const existing = await tx.orm.public.PaymentPlanItem.where({
        planId,
        userId: ctx.userId,
      }).all();
      const sortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

      const item = await tx.orm.public.PaymentPlanItem.create({
        userId: ctx.userId,
        planId,
        label: parsed.data.label,
        expectedAmount: parsed.data.expectedAmount,
        dueOn: parsed.data.dueOn,
        note: parsed.data.note,
        sortOrder,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlanItem",
        entityId: item.id,
        action: "CREATE",
        after: item,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlanItem",
        aggregateId: item.id,
        eventType: "payment_plan_item.created",
        payload: item,
      });
    });

    return getPlan(ctx, planId);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updatePlanItem(
  ctx: UseCaseContext,
  itemId: string,
  input: unknown,
): Promise<Result<PlanSummary>> {
  const parsed = planItemUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    const planId = await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.PaymentPlanItem.where({
        id: itemId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Tahap pembayaran tidak ditemukan.");

      const plan = await tx.orm.public.PaymentPlan.where({
        id: before.planId,
        userId: ctx.userId,
      }).first();
      if (plan === null) throw new LedgerError("NOT_FOUND", "Rencana tidak ditemukan.");
      if (plan.archivedAt !== null) {
        throw new LedgerError("CONFLICT", "Rencana yang diarsipkan tidak bisa diubah.");
      }

      const after = await tx.orm.public.PaymentPlanItem.where({
        id: itemId,
        userId: ctx.userId,
      }).update({
        label: parsed.data.label,
        expectedAmount: parsed.data.expectedAmount,
        dueOn: parsed.data.dueOn,
        note: parsed.data.note,
      });
      if (after === null) {
        throw new LedgerError("NOT_FOUND", "Tahap pembayaran tidak ditemukan.");
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlanItem",
        entityId: itemId,
        action: "UPDATE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlanItem",
        aggregateId: itemId,
        eventType: "payment_plan_item.updated",
        payload: { before, after },
      });

      return before.planId;
    });

    return getPlan(ctx, planId);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deletePlanItem(
  ctx: UseCaseContext,
  itemId: string,
): Promise<Result<{ planId: string }>> {
  try {
    const planId = await ctx.db.transaction(async (tx) => {
      const item = await tx.orm.public.PaymentPlanItem.where({
        id: itemId,
        userId: ctx.userId,
      }).first();
      if (item === null) throw new LedgerError("NOT_FOUND", "Tahap pembayaran tidak ditemukan.");

      const linked = await tx.orm.public.Transaction.where({
        planItemId: itemId,
        userId: ctx.userId,
      }).all();
      if (linked.some((transaction) => transaction.deletedAt === null)) {
        throw new LedgerError(
          "CONFLICT",
          "Tahap ini sudah punya pembayaran. Hapus atau pindahkan pembayarannya dulu.",
        );
      }

      await tx.orm.public.PaymentPlanItem.where({
        id: itemId,
        userId: ctx.userId,
      }).delete();

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "PaymentPlanItem",
        entityId: itemId,
        action: "SOFT_DELETE",
        before: item,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "PaymentPlanItem",
        aggregateId: itemId,
        eventType: "payment_plan_item.deleted",
        payload: item,
      });

      return item.planId;
    });

    return ok({ planId });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** Items with money still owed, for the income form's plan picker. */
export async function listPlanItemOptions(
  ctx: UseCaseContext,
  options: { includeItemId?: string } = {},
): Promise<Result<PlanItemOption[]>> {
  try {
    const timezone = await userTimezone(ctx.db, ctx.userId);
    const today = toLocalDate(nowOf(ctx), timezone);
    const includeItemId = options.includeItemId ?? "";
    const plan = ctx.db.raw.sql`
      SELECT i."id" AS id,
             i."label" AS label,
             p."id" AS "planId",
             p."name" AS "planName",
             i."expectedAmount"::text AS "expectedAmount",
             COALESCE(SUM(t."amount"), 0)::text AS received,
             i."dueOn"::text AS "dueOn"
      FROM "public"."PaymentPlanItem" i
      JOIN "public"."PaymentPlan" p ON p."id" = i."planId"
      LEFT JOIN "public"."Transaction" t
        ON t."planItemId" = i."id" AND t."deletedAt" IS NULL
      WHERE i."userId" = ${ctx.userId}
        AND (p."archivedAt" IS NULL OR i."id" = ${includeItemId})
      GROUP BY i."id", i."label", p."id", p."name", i."expectedAmount", i."dueOn", i."createdAt"
      ORDER BY p."createdAt" DESC, i."sortOrder" ASC, i."createdAt" ASC
    `
      .returnsRow({
        id: "pg/text@1",
        label: "pg/text@1",
        planId: "pg/text@1",
        planName: "pg/text@1",
        expectedAmount: "pg/text@1",
        received: "pg/text@1",
        dueOn: { codecId: "pg/text@1", nullable: true },
      })
      .build();

    const rows = await ctx.db.query(plan);
    const items: PlanItemOption[] = [];
    for (const row of rows) {
      const expectedAmount = BigInt(row.expectedAmount);
      const receivedAmount = BigInt(row.received);
      const outstanding = planItemOutstanding(expectedAmount, receivedAmount);
      if (outstanding === 0n && row.id !== includeItemId) continue;
      items.push({
        id: row.id,
        label: row.label,
        planId: row.planId,
        planName: row.planName,
        expectedAmount,
        receivedAmount,
        outstanding,
        dueOn: row.dueOn,
        status: planItemStatus({
          expectedAmount,
          receivedAmount,
          dueOn: row.dueOn,
          today,
        }),
      });
    }
    return ok(items);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** Validate a due date inside a direct service call, matching the form schema. */
export function normaliseDueOn(value: unknown): LocalDate | null {
  const parsed = localDateSchema.safeParse(value);
  if (!parsed.success) {
    throw new LedgerError("VALIDATION", firstIssue(parsed.error));
  }
  return parsed.data;
}

async function loadPlanRows(
  client: QueryClient,
  userId: string,
  planId: string | null,
  includeArchived: boolean,
): Promise<PlanRow[]> {
  const targetPlan = planId ?? "";
  const plan = client.raw.sql`
    SELECT p."id" AS "planId",
           p."name" AS "planName",
           p."description" AS description,
           p."archivedAt"::text AS "archivedAt",
           p."createdAt"::text AS "planCreatedAt",
           i."id" AS "itemId",
           i."label" AS "itemLabel",
           i."expectedAmount"::text AS "expectedAmount",
           COALESCE(SUM(t."amount"), 0)::text AS received,
           count(t."id")::bigint AS "incomeCount",
           i."dueOn"::text AS "dueOn",
           i."note" AS "itemNote",
           i."sortOrder"::bigint AS "sortOrder"
    FROM "public"."PaymentPlan" p
    LEFT JOIN "public"."PaymentPlanItem" i ON i."planId" = p."id"
    LEFT JOIN "public"."Transaction" t
      ON t."planItemId" = i."id" AND t."deletedAt" IS NULL
    WHERE p."userId" = ${userId}
      AND (NULLIF(${targetPlan}, '')::text IS NULL OR p."id" = ${targetPlan})
      AND (${includeArchived} OR p."archivedAt" IS NULL)
    GROUP BY p."id", p."name", p."description", p."archivedAt", p."createdAt",
             i."id", i."label", i."expectedAmount", i."dueOn", i."note",
             i."sortOrder", i."createdAt"
    ORDER BY (p."archivedAt" IS NOT NULL), p."createdAt" DESC,
             i."sortOrder" ASC, i."createdAt" ASC
  `
    .returnsRow(PLAN_ROW_CODECS)
    .build();

  return client.query(plan);
}

function buildPlans(rows: PlanRow[], today: LocalDate): PlanSummary[] {
  const plans = new Map<string, PlanSummary>();

  for (const row of rows) {
    let plan = plans.get(row.planId);
    if (plan === undefined) {
      plan = {
        id: row.planId,
        name: row.planName,
        description: row.description,
        archivedAt: row.archivedAt === null ? null : parseDbTimestamp(row.archivedAt).toISOString(),
        createdAt: parseDbTimestamp(row.planCreatedAt).toISOString(),
        expectedTotal: 0n,
        receivedTotal: 0n,
        outstanding: 0n,
        progress: 0,
        status: "ACTIVE",
        itemCount: 0,
        items: [],
      };
      plans.set(row.planId, plan);
    }

    if (row.itemId === null || row.itemLabel === null || row.expectedAmount === null) continue;

    const expectedAmount = BigInt(row.expectedAmount);
    const receivedAmount = BigInt(row.received);
    const status = planItemStatus({
      expectedAmount,
      receivedAmount,
      dueOn: row.dueOn,
      today,
    });

    plan.items.push({
      id: row.itemId,
      planId: row.planId,
      label: row.itemLabel,
      expectedAmount,
      receivedAmount,
      outstanding: planItemOutstanding(expectedAmount, receivedAmount),
      progress: planItemProgress(expectedAmount, receivedAmount),
      status,
      dueOn: row.dueOn,
      note: row.itemNote,
      sortOrder: Number(row.sortOrder ?? 0n),
      incomeCount: Number(row.incomeCount),
    });
  }

  for (const plan of plans.values()) {
    plan.itemCount = plan.items.length;
    plan.expectedTotal = plan.items.reduce((sum, item) => sum + item.expectedAmount, 0n);
    plan.receivedTotal = plan.items.reduce((sum, item) => sum + item.receivedAmount, 0n);
    plan.outstanding = plan.items.reduce((sum, item) => sum + item.outstanding, 0n);
    plan.progress = planItemProgress(plan.expectedTotal, plan.receivedTotal);
    plan.status = derivePlanStatus(plan.items);
  }

  return [...plans.values()];
}
