import type { Money } from "./money";

/**
 * Allocation: the amount an expense draws from an income (section 2).
 *
 * References are many-to-many and optional. The database enforces the sums;
 * these pure helpers mirror the invariant so the UI and services can check
 * before hitting the constraint.
 */

export interface AllocationProposal {
  /** The expense drawing the money. */
  expenseId: string;
  /** The income being drawn from. */
  incomeId: string;
  /** Positive whole rupiah. */
  amount: Money;
}

export interface AllocationCheck {
  amount: Money;
  /** Free amount left on the income (income amount minus already allocated). */
  incomeFree: Money;
  /** Unallocated amount left on the expense (expense amount minus already allocated). */
  expenseRemaining: Money;
}

/**
 * True when a proposed allocation is valid: positive, within the income's free
 * amount, and within the expense's remaining unallocated amount. This mirrors
 * the database constraints described in section 2.
 */
export function isAllocationValid(check: AllocationCheck): boolean {
  return (
    check.amount > 0n && check.amount <= check.incomeFree && check.amount <= check.expenseRemaining
  );
}

/** Total allocated across an entity's allocation rows. */
export function allocatedSum(amounts: readonly Money[]): Money {
  let total = 0n;
  for (const amount of amounts) total += amount;
  return total;
}

/** Whether an expense would exceed the free amount of its chosen incomes. */
export function wouldExceedIncome(
  allocations: readonly AllocationProposal[],
  incomeFreeByIncome: ReadonlyMap<string, Money>,
): boolean {
  const drawn = new Map<string, Money>();
  for (const allocation of allocations) {
    const current = drawn.get(allocation.incomeId) ?? 0n;
    drawn.set(allocation.incomeId, current + allocation.amount);
  }
  for (const [incomeId, total] of drawn) {
    const free = incomeFreeByIncome.get(incomeId);
    if (free === undefined) return true; // unknown income
    if (total > free) return true;
  }
  return false;
}

/** Whether an expense's allocations together exceed the expense amount. */
export function wouldExceedExpense(
  allocations: readonly AllocationProposal[],
  expenseAmount: Money,
): boolean {
  let total = 0n;
  for (const allocation of allocations) total += allocation.amount;
  return total > expenseAmount;
}
