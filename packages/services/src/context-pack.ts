import { listAccounts } from "./accounts";
import { getBudgetStatus } from "./budgets";
import { nowOf, type UseCaseContext, userTimezone } from "./context";
import { listPlans } from "./plans";
import { listRecurring } from "./recurring";
import { getSummary } from "./summary";

export async function buildContextPack(ctx: UseCaseContext): Promise<string> {
  const timezone = await userTimezone(ctx.db, ctx.userId);
  const now = nowOf(ctx);
  const accountsResult = await listAccounts(ctx);
  const accounts = accountsResult.ok ? accountsResult.value : [];
  const summaryResult = await getSummary(ctx, { period: "month" });
  const summary = summaryResult.ok ? summaryResult.value : { income: 0n, expense: 0n, net: 0n };
  const budgetsResult = await getBudgetStatus(ctx);
  const budgets = budgetsResult.ok ? budgetsResult.value : [];
  const recurringResult = await listRecurring(ctx);
  const recurring = recurringResult.ok ? recurringResult.value : [];
  const plansResult = await listPlans(ctx, { includeArchived: false });
  const plans = plansResult.ok ? plansResult.value : [];

  const lines: string[] = [];
  lines.push(`Waktu sekarang: ${now.toISOString()} (${timezone})`);
  lines.push("");
  lines.push("Saldo akun (perkiraan):");
  for (const account of accounts.filter((a) => a.archivedAt === null)) {
    lines.push(`- ${account.name}: ${account.balance}`);
  }
  lines.push("");
  lines.push(
    `Bulan ini: pemasukan ${summary.income}, pengeluaran ${summary.expense}, net ${summary.net}.`,
  );
  lines.push("");
  if (budgets.length > 0) {
    lines.push("Anggaran:");
    for (const budget of budgets) {
      lines.push(`- ${budget.budget.name}: terpakai ${budget.spent} dari ${budget.budget.amount}.`);
    }
    lines.push("");
  }
  if (recurring.length > 0) {
    lines.push(`Template berulang aktif: ${recurring.filter((r) => r.active).length}.`);
    lines.push("");
  }
  if (plans.length > 0) {
    lines.push("Rencana pembayaran:");
    for (const plan of plans) {
      lines.push(
        `- ${plan.name}: ${plan.receivedTotal}/${plan.expectedTotal} (sisa ${plan.outstanding}).`,
      );
    }
  }
  return lines.join("\n");
}
