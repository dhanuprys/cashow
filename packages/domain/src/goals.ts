import type { LocalDate } from "./date";

export interface GoalPacing {
  /** Whole months from `today`'s month to the target's month; at least 1. */
  monthsRemaining: number | null;
  /** Suggested monthly set-aside to reach the target on time. */
  monthlyPacing: bigint | null;
}

/**
 * Pacing for a savings goal deadline.
 *
 * Months are counted by calendar month, and the current month always counts as
 * one remaining month (setting money aside now still helps this month). The
 * suggestion rounds **up** so the allocation actually reaches the target; a
 * floor division leaves a shortfall at the end. A past deadline collapses to a
 * single month, which tells the user "the whole remainder is due now".
 */
export function goalPacing(
  remainingAmount: bigint,
  targetDate: LocalDate | null,
  today: LocalDate,
): GoalPacing {
  if (targetDate === null) return { monthsRemaining: null, monthlyPacing: null };

  const targetParts = targetDate.split("-").map(Number);
  const todayParts = today.split("-").map(Number);
  const targetYear = targetParts[0] ?? 0;
  const targetMonth = targetParts[1] ?? 1;
  const todayYear = todayParts[0] ?? 0;
  const todayMonth = todayParts[1] ?? 1;

  const monthsRemaining = Math.max((targetYear - todayYear) * 12 + (targetMonth - todayMonth), 1);
  const divisor = BigInt(monthsRemaining);
  const monthlyPacing = remainingAmount > 0n ? (remainingAmount + divisor - 1n) / divisor : 0n;

  return { monthsRemaining, monthlyPacing };
}
