import { type Money, ZERO } from "./money";

/**
 * Reconciliation maths from the plan (§2):
 *
 *   expected(t) = B_prev + Σ(occurredAt ∈ (t_prev, t])(income − expense ± transfers)
 *   gap         = B_new − expected(t)
 *
 * A negative gap is unlogged spending (or a fee); a positive gap is unlogged
 * income. Transactions exactly at `t` count toward that snapshot; transactions
 * exactly at `t_prev` were already in the previous stated balance, so they are
 * excluded from the interval.
 */

export type AccountMovementKind =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT";

export interface AccountMovement {
  kind: AccountMovementKind;
  amount: Money;
}

/** Signed effect of one movement on the account being reconciled. */
export function movementDelta(movement: AccountMovement): Money {
  switch (movement.kind) {
    case "EXPENSE":
    case "TRANSFER_OUT":
      return -movement.amount;
    case "INCOME":
    case "TRANSFER_IN":
    case "ADJUSTMENT":
      return movement.amount;
  }
}

/** Apply every movement in the interval to the previous stated balance. */
export function expectedBalance(
  previousBalance: Money,
  movements: readonly AccountMovement[],
): Money {
  return movements.reduce(
    (balance, movement) => balance + movementDelta(movement),
    previousBalance,
  );
}

/** Positive means the bank holds more than the ledger explains. */
export function reconciliationGap(actualBalance: Money, expected: Money): Money {
  return actualBalance - expected;
}

export type GapKind = "BALANCED" | "UNLOGGED_SPENDING" | "UNLOGGED_INCOME";

export function gapKind(gap: Money): GapKind {
  if (gap === ZERO) return "BALANCED";
  return gap < ZERO ? "UNLOGGED_SPENDING" : "UNLOGGED_INCOME";
}

/**
 * The estimated live balance after the latest snapshot: the stated balance
 * plus every movement strictly after the snapshot instant. Without a snapshot
 * the opening balance is the base and the interval is open.
 */
export function estimatedLiveBalance(
  baseBalance: Money,
  movementsSinceBase: readonly AccountMovement[],
): Money {
  return expectedBalance(baseBalance, movementsSinceBase);
}
