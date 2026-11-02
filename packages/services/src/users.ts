import { firstIssue, profileUpdateSchema } from "@cashow/domain";
import { writeAudit } from "./audit";
import type { UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

export interface Profile {
  id: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  email: string | null;
  timezone: string;
  weekStartsOn: number;
  budgetMonthStartDay: number;
  currency: string;
}

/** The owner's profile and reporting preferences. */
export async function getProfile(ctx: UseCaseContext): Promise<Result<Profile>> {
  try {
    const row = await ctx.db.orm.public.User.where({ id: ctx.userId }).first();
    if (row === null) return err(new LedgerError("NOT_FOUND", "Pengguna tidak ditemukan."));
    return ok({
      id: row.id,
      name: row.name,
      avatar: row.avatar ?? null,
      bio: row.bio ?? null,
      email: row.email,
      timezone: row.timezone,
      weekStartsOn: row.weekStartsOn,
      budgetMonthStartDay: row.budgetMonthStartDay,
      currency: row.currency,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Preferences are edited from `/app/settings`. Changing the timezone does not
 * rewrite historical `occurredOn` values: the stored date records what the
 * owner saw when the row was entered, and reports group on that stored date.
 */
export async function updateProfile(ctx: UseCaseContext, input: unknown): Promise<Result<Profile>> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const after = await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.User.where({ id: ctx.userId }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Pengguna tidak ditemukan.");

      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.avatar !== undefined) patch.avatar = data.avatar;
      if (data.bio !== undefined) patch.bio = data.bio;
      if (data.timezone !== undefined) patch.timezone = data.timezone;
      if (data.weekStartsOn !== undefined) patch.weekStartsOn = data.weekStartsOn;
      if (data.budgetMonthStartDay !== undefined) {
        patch.budgetMonthStartDay = data.budgetMonthStartDay;
      }
      if (data.currency !== undefined) patch.currency = data.currency;

      if (Object.keys(patch).length === 0) return before;

      const updated = await tx.orm.public.User.where({ id: ctx.userId }).update(patch);
      if (updated === null) throw new LedgerError("NOT_FOUND", "Pengguna tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "User",
        entityId: ctx.userId,
        action: "UPDATE",
        before,
        after: updated,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "User",
        aggregateId: ctx.userId,
        eventType: "user.updated",
        payload: { before, after: updated },
      });

      return updated;
    });

    return ok({
      id: after.id,
      name: after.name,
      avatar: after.avatar ?? null,
      bio: after.bio ?? null,
      email: after.email,
      timezone: after.timezone,
      weekStartsOn: after.weekStartsOn,
      budgetMonthStartDay: after.budgetMonthStartDay,
      currency: after.currency,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}
