/**
 * Financial Mood derivation logic: pure domain rules.
 *
 * Rules:
 * - "THRIVING":
 *     Cashflow positive (net >= 0) and budget usage <= 75% (or no budget exceeded).
 *     Glow: Emerald / Teal. Badge: "Arus Kas Sehat".
 * - "BALANCED":
 *     Cashflow slightly tight, budget usage between 75% and 100%, or breakeven.
 *     Glow: Amber / Orange. Badge: "Terkendali".
 * - "ATTENTION":
 *     Net cashflow negative or any active budget exceeded (> 100%).
 *     Glow: Rose / Ruby. Badge: "Perlu Evaluasi".
 */

export type FinancialMoodStatus = "THRIVING" | "BALANCED" | "ATTENTION";

export interface FinancialMoodInput {
  income: bigint;
  expense: bigint;
  budgetUsedPercent?: number | null;
}

export interface FinancialMood {
  status: FinancialMoodStatus;
  label: string;
  description: string;
  ringClass: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  accentColor: string;
}

export function deriveFinancialMood(input: FinancialMoodInput): FinancialMood {
  const { income, expense, budgetUsedPercent } = input;
  const net = income - expense;

  // Case 1: Over-budget or heavy deficit
  const isBudgetExceeded =
    budgetUsedPercent !== undefined && budgetUsedPercent !== null && budgetUsedPercent > 100;
  const isHeavyDeficit = income > 0n && expense > (income * 110n) / 100n; // more than 110% of income

  if (isBudgetExceeded || isHeavyDeficit) {
    return {
      status: "ATTENTION",
      label: "Perlu Evaluasi",
      description: "Pengeluaran melebihi batas anggaran atau arus kas defisit bulan ini.",
      ringClass: "ring-2 ring-rose-500/70 shadow-[0_0_12px_rgba(244,63,94,0.35)]",
      badgeVariant: "destructive",
      accentColor: "#F43F5E",
    };
  }

  // Case 2: Approaching budget limit or near zero net
  const isBudgetApproaching =
    budgetUsedPercent !== undefined && budgetUsedPercent !== null && budgetUsedPercent >= 75;
  const isTightCashflow = net < 0n || (income > 0n && expense >= (income * 85n) / 100n);

  if (isBudgetApproaching || isTightCashflow) {
    return {
      status: "BALANCED",
      label: "Terkendali",
      description: "Anggaran berjalan aman, mendekati batas akhir siklus.",
      ringClass: "ring-2 ring-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.35)]",
      badgeVariant: "outline",
      accentColor: "#F59E0B",
    };
  }

  // Case 3: Thriving
  return {
    status: "THRIVING",
    label: "Arus Kas Sehat",
    description: "Pemasukan mencukupi dan pengeluaran terkendali dengan sangat baik.",
    ringClass: "ring-2 ring-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    badgeVariant: "secondary",
    accentColor: "#10B981",
  };
}
