import { evaluateRule, firstIssue } from "@cashow/domain";
import { z } from "zod";
import { writeAudit } from "./audit";
import { nowOf, type UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { createNotification } from "./notifications";
import { err, ok, type Result } from "./result";

const ruleInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  trigger: z.unknown(),
  condition: z.unknown(),
  actions: z.unknown().optional(),
  settings: z.unknown().optional(),
  active: z.boolean().optional(),
});

export interface RuleSummary {
  id: string;
  name: string;
  description: string | null;
  trigger: unknown;
  condition: unknown;
  actions: unknown;
  settings: unknown;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function listRules(ctx: UseCaseContext): Promise<Result<RuleSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.Rule.where({ userId: ctx.userId }).all();
    return ok(rows.map(toSummary));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createRule(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<RuleSummary>> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) return err(new LedgerError("VALIDATION", firstIssue(parsed.error as never)));
  const data = parsed.data;
  try {
    const created = await ctx.db.orm.public.Rule.create({
      userId: ctx.userId,
      name: data.name,
      description: data.description ?? null,
      trigger: data.trigger as never,
      condition: data.condition as never,
      actions: (data.actions ?? []) as never,
      settings: (data.settings ?? {}) as never,
      active: data.active ?? true,
      version: 1,
    });
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Rule",
      entityId: created.id,
      action: "CREATE",
      after: { name: created.name },
    });
    return ok(toSummary(created));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateRule(
  ctx: UseCaseContext,
  id: string,
  input: unknown,
): Promise<Result<RuleSummary>> {
  const parsed = ruleInputSchema.partial().safeParse(input);
  if (!parsed.success) return err(new LedgerError("VALIDATION", firstIssue(parsed.error as never)));
  const data = parsed.data;
  try {
    const before = await ctx.db.orm.public.Rule.where({ id, userId: ctx.userId }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Aturan tidak ditemukan."));

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.trigger !== undefined) patch.trigger = data.trigger;
    if (data.condition !== undefined) patch.condition = data.condition;
    if (data.actions !== undefined) patch.actions = data.actions;
    if (data.settings !== undefined) patch.settings = data.settings;
    if (data.active !== undefined) patch.active = data.active;

    if (Object.keys(patch).length > 0) {
      await ctx.db.orm.public.Rule.where({ id, userId: ctx.userId }).update(patch);
    }
    const after = await ctx.db.orm.public.Rule.where({ id, userId: ctx.userId }).first();
    if (after === null) throw new LedgerError("INTERNAL", "Aturan gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Rule",
      entityId: id,
      action: "UPDATE",
      before,
      after: toSummary(after),
    });
    return ok(toSummary(after));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deleteRule(ctx: UseCaseContext, id: string): Promise<Result<void>> {
  try {
    const before = await ctx.db.orm.public.Rule.where({ id, userId: ctx.userId }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Aturan tidak ditemukan."));
    await ctx.db.orm.public.Rule.where({ id, userId: ctx.userId }).deleteAll();
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Rule",
      entityId: id,
      action: "SOFT_DELETE",
      before,
      after: null,
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function runRules(ctx: UseCaseContext, triggerType: string): Promise<Result<number>> {
  try {
    const rules = await ctx.db.orm.public.Rule.where({ userId: ctx.userId, active: true }).all();
    const metrics = await computeMetrics(ctx);
    const now = nowOf(ctx);
    let firedCount = 0;

    for (const rule of rules) {
      const trigger = rule.trigger as { type?: string };
      if (trigger?.type !== undefined && trigger.type !== triggerType) continue;

      const condition = rule.condition as Parameters<typeof evaluateRule>[0];
      const result = evaluateRule(condition, metrics);
      const settings = (rule.settings ?? {}) as {
        severity?: string;
        cooldownMinutes?: number;
        edgeTriggered?: boolean;
      };
      const edgeTriggered = settings.edgeTriggered !== false;

      // Load or create state.
      const state = await ctx.db.orm.public.RuleState.where({
        userId: ctx.userId,
        ruleId: rule.id,
      }).first();
      const previousTruth =
        state === null ? false : ((state.state as { truth?: boolean })?.truth ?? false);

      const cooldownMs = (settings.cooldownMinutes ?? 0) * 60_000;
      const lastFired =
        state?.lastFiredAt === null || state?.lastFiredAt === undefined
          ? 0
          : new Date(String(state.lastFiredAt)).getTime();
      const cooldownOk = now.getTime() - lastFired >= cooldownMs;

      let shouldFire = false;
      if (result) {
        if (edgeTriggered) {
          shouldFire = !previousTruth && cooldownOk;
        } else {
          shouldFire = cooldownOk;
        }
      }

      // Dedupe key.
      const dedupeKey = shouldFire
        ? `${rule.id}:${new Date(now).toISOString().slice(0, 10)}`
        : null;

      if (shouldFire) {
        // Check dedupe.
        const existing =
          dedupeKey === null
            ? null
            : await ctx.db.orm.public.RuleFiring.where({ userId: ctx.userId, dedupeKey }).first();
        if (existing === null) {
          const notification = await createNotification(ctx, {
            title: rule.name,
            body: `Aturan "${rule.name}" terpenuhi.`,
            severity: settings.severity ?? "INFO",
            url: "/app/inbox",
            dedupeKey,
          });
          await ctx.db.orm.public.RuleFiring.create({
            userId: ctx.userId,
            ruleId: rule.id,
            dedupeKey,
            metricValues: metrics as never,
            notificationId: notification.ok ? notification.value.id : null,
          });
          firedCount += 1;
        }
      }

      // Update state.
      const statePayload = { truth: result };
      if (state === null) {
        await ctx.db.orm.public.RuleState.create({
          userId: ctx.userId,
          ruleId: rule.id,
          state: statePayload as never,
          lastEvaluatedAt: now.toISOString(),
          lastFiredAt: shouldFire ? now.toISOString() : null,
        });
      } else {
        await ctx.db.orm.public.RuleState.where({ id: state.id, userId: ctx.userId }).update({
          state: statePayload as never,
          lastEvaluatedAt: now.toISOString(),
          lastFiredAt: shouldFire ? now.toISOString() : state.lastFiredAt,
        });
      }
    }

    return ok(firedCount);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function dryRunRule(
  ctx: UseCaseContext,
  condition: unknown,
  days = 30,
): Promise<Result<{ firedDates: string[] }>> {
  try {
    const now = nowOf(ctx);
    const txs = await ctx.db.orm.public.Transaction.where({ userId: ctx.userId }).all();
    const live = txs.filter((t) => t.deletedAt === null);

    const firedDates: string[] = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      const expenseThatDay = live
        .filter((t) => t.type === "EXPENSE" && String(t.occurredOn) === date)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const metrics = await computeMetrics(ctx);
      metrics.expenseToday = expenseThatDay;
      const truth = evaluateRule(condition as Parameters<typeof evaluateRule>[0], metrics);
      if (truth) firedDates.push(date);
    }
    return ok({ firedDates });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function computeMetrics(ctx: UseCaseContext): Promise<Record<string, number>> {
  const accounts = await ctx.db.orm.public.Account.where({ userId: ctx.userId }).all();
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.openingBalance ?? 0), 0);

  const now = nowOf(ctx);
  const today = new Date(now).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const txs = await ctx.db.orm.public.Transaction.where({ userId: ctx.userId }).all();
  const live = txs.filter((t) => t.deletedAt === null);
  let expenseToday = 0;
  let expenseMonth = 0;
  let incomeMonth = 0;
  for (const t of live) {
    const on = String(t.occurredOn);
    const amt = Number(t.amount);
    if (t.type === "EXPENSE") {
      if (on === today) expenseToday += amt;
      if (on >= monthStart) expenseMonth += amt;
    }
    if (t.type === "INCOME" && on >= monthStart) incomeMonth += amt;
  }

  // Overdue plan items (single pass; avoids N+1).
  const items = await ctx.db.orm.public.PaymentPlanItem.where({ userId: ctx.userId }).all();
  const allTxs = await ctx.db.orm.public.Transaction.where({ userId: ctx.userId }).all();
  const receivedByItem = new Map<string, number>();
  for (const tx of allTxs) {
    if (tx.planItemId === null || tx.deletedAt !== null) continue;
    receivedByItem.set(tx.planItemId, (receivedByItem.get(tx.planItemId) ?? 0) + Number(tx.amount));
  }
  let overduePlanCount = 0;
  for (const item of items) {
    const received = receivedByItem.get(item.id) ?? 0;
    if (
      received < Number(item.expectedAmount) &&
      item.dueOn !== null &&
      String(item.dueOn) < today
    ) {
      overduePlanCount += 1;
    }
  }

  return {
    expenseToday,
    expenseMonth,
    incomeMonth,
    totalBalance,
    overduePlanCount,
    unallocatedIncome: 0,
  };
}

function toSummary(row: {
  id: string;
  name: string;
  description: string | null;
  trigger: unknown;
  condition: unknown;
  actions: unknown;
  settings: unknown;
  active: boolean;
  version: number;
  createdAt: unknown;
  updatedAt: unknown;
}): RuleSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trigger: row.trigger,
    condition: row.condition,
    actions: row.actions,
    settings: row.settings,
    active: row.active,
    version: row.version,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}
