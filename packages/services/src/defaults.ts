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
}
