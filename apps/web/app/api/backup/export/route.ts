import {
  getProfile,
  listAccounts,
  listBudgets,
  listCategories,
  listPlans,
  listRecurring,
  listRules,
  listTransactions,
} from "@cashow/services";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInts);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInts(val);
    }
    return result;
  }
  return value;
}

export async function GET(_request: NextRequest) {
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [
    profileResult,
    accountsResult,
    categoriesResult,
    budgetsResult,
    plansResult,
    recurringResult,
    rulesResult,
    txResult,
  ] = await Promise.all([
    getProfile(ctx),
    listAccounts(ctx),
    listCategories(ctx),
    listBudgets(ctx),
    listPlans(ctx, { includeArchived: true }),
    listRecurring(ctx),
    listRules(ctx),
    listTransactions(ctx, { limit: 5000, includeDeleted: true }),
  ]);

  const profile = unwrap(profileResult);
  const accounts = unwrap(accountsResult);
  const categories = unwrap(categoriesResult);
  const budgets = unwrap(budgetsResult);
  const plans = unwrap(plansResult);
  const recurring = unwrap(recurringResult);
  const rules = unwrap(rulesResult);

  // Fetch all transactions in 5,000-sized batches
  const firstTxBatch = unwrap(txResult);
  const transactions = [...firstTxBatch.items];
  const total = firstTxBatch.total;

  if (total > transactions.length) {
    const pages = Math.ceil(total / 5000);
    for (let p = 1; p < pages; p++) {
      const batch = await listTransactions(ctx, {
        limit: 5000,
        offset: p * 5000,
        includeDeleted: true,
      });
      transactions.push(...unwrap(batch).items);
    }
  }

  const backupData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: profile.name,
      currency: profile.currency,
      timezone: profile.timezone,
      weekStartsOn: profile.weekStartsOn,
      budgetMonthStartDay: profile.budgetMonthStartDay,
    },
    accounts,
    categories,
    budgets,
    plans,
    recurring,
    rules,
    transactions,
  };

  const jsonString = JSON.stringify(serializeBigInts(backupData), null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `cashow-backup-${dateStr}.json`;

  return new Response(jsonString, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
