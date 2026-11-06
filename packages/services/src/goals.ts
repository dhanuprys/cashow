import {
  firstIssue,
  formatMoney,
  type GoalStatus,
  goalCreateSchema,
  goalPacing,
  goalReservationSchema,
  goalUpdateSchema,
  toLocalDate,
} from "@cashow/domain";
import { getAccount } from "./accounts";
import { writeAudit } from "./audit";
import { nowOf, type UseCaseContext, userSettings } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";

export interface GoalReservationItem {
  id: string;
  goalId: string;
  accountId: string;
  accountName: string;
  amount: bigint;
  note: string | null;
  createdAt: string;
}

export interface GoalSummary {
  id: string;
  name: string;
  description: string | null;
  targetAmount: bigint;
  targetDate: string | null;
  color: string | null;
  icon: string | null;
  status: GoalStatus;
  savedAmount: bigint;
  progressPercent: number;
  remainingAmount: bigint;
  monthlyPacing: bigint | null;
  monthsRemaining: number | null;
  reservations: GoalReservationItem[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listGoals(ctx: UseCaseContext): Promise<Result<GoalSummary[]>> {
  try {
    const goals = await ctx.db.orm.public.Goal.where({
      userId: ctx.userId,
      archivedAt: null,
    }).all();

    const reservations = await ctx.db.orm.public.GoalReservation.where({
      userId: ctx.userId,
    }).all();

    const accounts = await ctx.db.orm.public.Account.where({ userId: ctx.userId }).all();
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));

    const settings = await userSettings(ctx);
    const today = toLocalDate(nowOf(ctx), settings.timezone);

    // Group reservations by goal
    const reservationsByGoal = new Map<string, GoalReservationItem[]>();
    for (const r of reservations) {
      const list = reservationsByGoal.get(r.goalId) ?? [];
      list.push({
        id: r.id,
        goalId: r.goalId,
        accountId: r.accountId,
        accountName: accountNames.get(r.accountId) ?? "Akun tidak dikenal",
        amount: BigInt(r.amount),
        note: r.note,
        createdAt: String(r.createdAt),
      });
      reservationsByGoal.set(r.goalId, list);
    }

    const summaries: GoalSummary[] = goals.map((g) => {
      const goalReservations = reservationsByGoal.get(g.id) ?? [];
      const savedAmount = goalReservations.reduce((sum, r) => sum + r.amount, 0n);
      const target = BigInt(g.targetAmount);
      const remainingAmount = target > savedAmount ? target - savedAmount : 0n;
      const progressPercent = target > 0n ? Number((savedAmount * 100n) / target) : 0;

      const { monthsRemaining, monthlyPacing } = goalPacing(remainingAmount, g.targetDate, today);

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        targetAmount: target,
        targetDate: g.targetDate,
        color: g.color,
        icon: g.icon,
        status: (g.status as GoalStatus) ?? "ACTIVE",
        savedAmount,
        progressPercent: Math.min(progressPercent, 100),
        remainingAmount,
        monthlyPacing,
        monthsRemaining,
        reservations: goalReservations,
        archivedAt: g.archivedAt ? String(g.archivedAt) : null,
        createdAt: String(g.createdAt),
        updatedAt: String(g.updatedAt),
      };
    });

    return ok(summaries);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createGoal(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = goalCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const created = await ctx.db.orm.public.Goal.create({
      userId: ctx.userId,
      name: data.name,
      description: data.description,
      targetAmount: data.targetAmount,
      targetDate: data.targetDate || null,
      color: data.color || null,
      icon: data.icon || null,
      status: "ACTIVE",
    });

    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "GOAL",
      entityId: created.id,
      action: "CREATE",
      after: {
        name: data.name,
        targetAmount: String(data.targetAmount),
        targetDate: data.targetDate,
      },
    });

    return ok({ id: created.id });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateGoal(
  ctx: UseCaseContext,
  id: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = goalUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const existing = await ctx.db.orm.public.Goal.where({
      id,
      userId: ctx.userId,
    }).first();

    if (!existing) {
      return err(new LedgerError("NOT_FOUND", "Target tidak ditemukan."));
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.targetAmount !== undefined) patch.targetAmount = data.targetAmount;
    if (data.targetDate !== undefined) patch.targetDate = data.targetDate;
    if (data.color !== undefined) patch.color = data.color;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.status !== undefined) patch.status = data.status;

    if (Object.keys(patch).length > 0) {
      await ctx.db.orm.public.Goal.where({ id, userId: ctx.userId }).update(patch);
    }

    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "GOAL",
      entityId: id,
      action: "UPDATE",
      after: {
        id,
        ...patch,
      },
    });

    return ok({ id });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export interface GoalReservationTotals {
  total: bigint;
  byAccount: Record<string, bigint>;
  byGoal: Record<string, bigint>;
}

/**
 * Reservations that still protect money. Only reservations belonging to live
 * (non-archived) goals count: archiving a goal releases its set-asides, and a
 * stray row from an archived goal must never silently shrink Safe To Spend.
 */
export async function getGoalReservationTotals(
  ctx: UseCaseContext,
): Promise<Result<GoalReservationTotals>> {
  try {
    const goals = await ctx.db.orm.public.Goal.where({
      userId: ctx.userId,
      archivedAt: null,
    }).all();
    const liveGoalIds = new Set(goals.map((goal) => goal.id));

    const rows = await ctx.db.orm.public.GoalReservation.where({
      userId: ctx.userId,
    }).all();

    const totals: GoalReservationTotals = { total: 0n, byAccount: {}, byGoal: {} };
    for (const row of rows) {
      if (!liveGoalIds.has(row.goalId)) continue;
      const amount = BigInt(row.amount);
      totals.total += amount;
      totals.byGoal[row.goalId] = (totals.byGoal[row.goalId] ?? 0n) + amount;
      totals.byAccount[row.accountId] = (totals.byAccount[row.accountId] ?? 0n) + amount;
    }

    return ok(totals);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function archiveGoal(ctx: UseCaseContext, id: string): Promise<Result<void>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const existing = await tx.orm.public.Goal.where({
        id,
        userId: ctx.userId,
      }).first();

      if (!existing) throw new LedgerError("NOT_FOUND", "Target tidak ditemukan.");
      // Closing twice must not release anything twice.
      if (existing.archivedAt !== null) return;

      const reservations = await tx.orm.public.GoalReservation.where({
        goalId: id,
        userId: ctx.userId,
      }).all();
      const released = reservations.reduce((sum, row) => sum + BigInt(row.amount), 0n);

      for (const reservation of reservations) {
        await tx.orm.public.GoalReservation.where({ id: reservation.id }).delete();
      }

      await tx.orm.public.Goal.where({ id, userId: ctx.userId }).update({
        archivedAt: nowOf(ctx).toISOString(),
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "GOAL",
        entityId: id,
        action: "ARCHIVE",
        after: {
          releasedReservations: reservations.length,
          releasedAmount: String(released),
        },
      });
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function addGoalReservation(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = goalReservationSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    // Verify goal exists
    const goal = await ctx.db.orm.public.Goal.where({
      id: data.goalId,
      userId: ctx.userId,
    }).first();

    if (!goal) {
      return err(new LedgerError("NOT_FOUND", "Target tidak ditemukan."));
    }
    if (goal.archivedAt !== null) {
      return err(new LedgerError("CONFLICT", "Target ini sudah ditutup."));
    }

    // The reservation is virtual money: it must be backed by cash that is
    // actually free on the chosen account. Real bank balances never change.
    const account = await getAccount(ctx.db, ctx.userId, data.accountId);
    if (account === null) {
      return err(new LedgerError("NOT_FOUND", "Akun tidak ditemukan."));
    }
    if (account.archivedAt !== null) {
      return err(new LedgerError("CONFLICT", "Akun ini sudah diarsipkan."));
    }

    const totals = await getGoalReservationTotals(ctx);
    if (!totals.ok) return totals;
    const alreadyReserved = totals.value.byAccount[data.accountId] ?? 0n;
    const free = account.balance - alreadyReserved;
    if (data.amount > free) {
      return err(
        new LedgerError(
          "VALIDATION",
          `Saldo bebas ${account.name} hanya ${formatMoney(free > 0n ? free : 0n)}. Kurangi jumlah cadangan atau pilih akun lain.`,
        ),
      );
    }

    const reservation = await ctx.db.orm.public.GoalReservation.create({
      userId: ctx.userId,
      goalId: data.goalId,
      accountId: data.accountId,
      amount: data.amount,
      note: data.note,
    });

    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "GOAL_RESERVATION",
      entityId: reservation.id,
      action: "CREATE",
      after: {
        goalId: data.goalId,
        accountId: data.accountId,
        amount: String(data.amount),
      },
    });

    return ok({ id: reservation.id });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function removeGoalReservation(
  ctx: UseCaseContext,
  reservationId: string,
): Promise<Result<void>> {
  try {
    const existing = await ctx.db.orm.public.GoalReservation.where({
      id: reservationId,
      userId: ctx.userId,
    }).first();

    if (!existing) {
      return err(new LedgerError("NOT_FOUND", "Reservasi dana tidak ditemukan."));
    }

    await ctx.db.orm.public.GoalReservation.where({ id: reservationId }).delete();

    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "GOAL_RESERVATION",
      entityId: reservationId,
      action: "SOFT_DELETE",
      after: {
        goalId: existing.goalId,
        accountId: existing.accountId,
        amount: String(existing.amount),
      },
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}
