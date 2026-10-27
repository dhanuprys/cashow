import type { LocalDate } from "./date";
import type { Money } from "./money";

/**
 * Payment-plan status is derived from linked incomes against the expected
 * amount (plan §2: "Derive, do not store"). A stored copy would drift every
 * time an income is edited, deleted or restored.
 *
 * - `PENDING`      nothing received yet and not past due
 * - `PARTIAL`      some money received, less than expected, not past due
 * - `RECEIVED`     exactly the expected amount
 * - `OVER_RECEIVED` more than expected
 * - `OVERDUE`      past due and not fully received
 */
export type PlanItemStatus = "PENDING" | "PARTIAL" | "RECEIVED" | "OVER_RECEIVED" | "OVERDUE";

export interface PlanItemStatusInput {
  expectedAmount: Money;
  receivedAmount: Money;
  /** Due date as a local calendar date, or null when the item has none. */
  dueOn: LocalDate | null;
  /** Today's local date in the owner's timezone. */
  today: LocalDate;
}

export function planItemStatus(input: PlanItemStatusInput): PlanItemStatus {
  const { expectedAmount, receivedAmount, dueOn, today } = input;

  if (receivedAmount > expectedAmount) return "OVER_RECEIVED";
  if (receivedAmount === expectedAmount) return "RECEIVED";

  // Not fully paid. The due date only distinguishes "late" from "in progress".
  if (dueOn !== null && dueOn < today) return "OVERDUE";
  return receivedAmount > 0n ? "PARTIAL" : "PENDING";
}

/** What is still owed on an item; never negative (extra payments are not debt). */
export function planItemOutstanding(expectedAmount: Money, receivedAmount: Money): Money {
  const remaining = expectedAmount - receivedAmount;
  return remaining > 0n ? remaining : 0n;
}

/** Whole-percent progress for a progress bar, capped at 100. */
export function planItemProgress(expectedAmount: Money, receivedAmount: Money): number {
  if (expectedAmount <= 0n) return 0;
  if (receivedAmount <= 0n) return 0;
  if (receivedAmount >= expectedAmount) return 100;
  // Integer-only maths keeps the result free of floating-point surprises.
  return Number((receivedAmount * 100n) / expectedAmount);
}

export type PlanStatus = "ACTIVE" | "COMPLETED" | "OVERDUE";

/** Roll item statuses up to the plan: completed, late, or still running. */
export function derivePlanStatus(items: readonly { status: PlanItemStatus }[]): PlanStatus {
  if (items.length === 0) return "ACTIVE";
  const allSettled = items.every(
    (item) => item.status === "RECEIVED" || item.status === "OVER_RECEIVED",
  );
  if (allSettled) return "COMPLETED";
  if (items.some((item) => item.status === "OVERDUE")) return "OVERDUE";
  return "ACTIVE";
}
