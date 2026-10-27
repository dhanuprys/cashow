import { ensureDefaultAccount } from "./accounts";
import { ensureDefaultCategories } from "./categories";
import type { DbTransaction } from "./context";

/**
 * First-run seed: one cash account and a small Indonesian category set, written
 * in the caller's transaction. `/setup` calls this once, right after the owner
 * row exists, so the quick-add sheet has somewhere to land.
 */
export async function ensureDefaultLedger(tx: DbTransaction, userId: string): Promise<void> {
  await ensureDefaultAccount(tx, userId);
  await ensureDefaultCategories(tx, userId);
  await ensureDefaultRules(tx, userId);
}

/**
 * System rules every owner gets, so a silently dead backup or drill surfaces in
 * the inbox instead of staying invisible. Thresholds leave headroom for one
 * missed nightly run and for the monthly drill's calendar slack (the crontab
 * runs it on the 1st, so a 40-day window tolerates a late month-end).
 */
export async function ensureDefaultRules(tx: DbTransaction, userId: string): Promise<void> {
  await tx.orm.public.Rule.create({
    userId,
    name: "Backup kedaluwarsa",
    description: "Pemberitahuan ketika cadangan terakhir lebih dari 26 jam lalu.",
    trigger: { type: "backup" } as never,
    condition: { metric: "backupAgeHours", op: "gt", value: 26 } as never,
    actions: [{ type: "notify" }] as never,
    settings: { severity: "WARNING", edgeTriggered: true } as never,
    active: true,
    version: 1,
  });
  await tx.orm.public.Rule.create({
    userId,
    name: "Uji pemulihan kedaluwarsa",
    description: "Pemberitahuan ketika uji pemulihan terakhir lebih dari 40 hari lalu.",
    trigger: { type: "backup" } as never,
    condition: { metric: "drillAgeHours", op: "gt", value: 960 } as never,
    actions: [{ type: "notify" }] as never,
    settings: { severity: "WARNING", edgeTriggered: true } as never,
    active: true,
    version: 1,
  });
}
