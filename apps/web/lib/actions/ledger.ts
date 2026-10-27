"use server";

import { quickAddSchema } from "@cashow/domain";
import {
  createAccount,
  createBudget,
  createCategory,
  createPlan,
  createPlanItem,
  createRecurring,
  createSnapshot,
  createTransaction,
  createTransfer,
  deleteBudget,
  deletePlanItem,
  deleteRecurring,
  listAccounts,
  restoreTransaction,
  runDueRecurring,
  setAccountArchived,
  setCategoryArchived,
  setPlanArchived,
  softDeleteAttachment,
  softDeleteSnapshot,
  softDeleteTransaction,
  unlockCheckpoint,
  updateAccount,
  updateBudget,
  updateCategory,
  updatePlan,
  updatePlanItem,
  updateProfile,
  updateRecurring,
  updateTransaction,
  verifyCheckpoint,
} from "@cashow/services";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nowLocalInput } from "@/lib/format";
import { requireLedgerSession } from "@/lib/ledger";
import { attachmentStorage } from "@/lib/storage";

/**
 * Server actions are the only mutation boundary the UI has. Every one resolves
 * the session, calls the shared use case, revalidates the affected paths, and
 * returns an Indonesian message instead of throwing for expected failures.
 */
import type { ActionState } from "./state";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function numberField(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function allocationsField(formData: FormData): { incomeId: string; amount: string }[] {
  const raw = text(formData, "allocations");
  if (raw.trim() === "") return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Format alokasi tidak valid.");
  return parsed.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Format alokasi tidak valid.");
    }
    const candidate = entry as { incomeId?: unknown; amount?: unknown };
    return {
      incomeId: typeof candidate.incomeId === "string" ? candidate.incomeId : "",
      amount: typeof candidate.amount === "string" ? candidate.amount : "",
    };
  });
}

function failure(message: string): ActionState {
  return { status: "error", message };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message !== "") return error.message;
  return "Terjadi kesalahan. Coba lagi.";
}

function revalidateLedger(): void {
  revalidatePath("/app");
  revalidatePath("/app/transactions");
  revalidatePath("/app/accounts");
  revalidatePath("/app/categories");
  revalidatePath("/app/plans");
}

export async function createTransactionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();

  let allocations: { incomeId: string; amount: string }[];
  try {
    allocations = allocationsField(formData);
  } catch (error) {
    return failure(errorMessage(error));
  }

  const result = await createTransaction(session.ctx, {
    type: text(formData, "type"),
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId"),
    categoryId: text(formData, "categoryId"),
    planItemId: text(formData, "planItemId"),
    merchant: text(formData, "merchant"),
    counterparty: text(formData, "counterparty"),
    note: text(formData, "note"),
    occurredAtLocal: text(formData, "occurredAtLocal"),
    clientRequestId: text(formData, "clientRequestId") || null,
    source: "MANUAL",
    allocations,
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  redirect(`/app/transactions/${result.value.id}`);
}

export async function updateTransactionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "transactionId");
  if (id === "") return failure("Transaksi tidak ditemukan.");

  let allocations: { incomeId: string; amount: string }[] | undefined;
  try {
    allocations = formData.has("allocations") ? allocationsField(formData) : undefined;
  } catch (error) {
    return failure(errorMessage(error));
  }

  const result = await updateTransaction(session.ctx, id, {
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId"),
    categoryId: text(formData, "categoryId"),
    planItemId: text(formData, "planItemId"),
    merchant: text(formData, "merchant"),
    counterparty: text(formData, "counterparty"),
    note: text(formData, "note"),
    occurredAtLocal: text(formData, "occurredAtLocal"),
    allocations,
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath(`/app/transactions/${id}`);
  redirect(`/app/transactions/${id}`);
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "transactionId");
  if (id === "") return;

  const result = await softDeleteTransaction(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath(`/app/transactions/${id}`);
  redirect("/app/transactions");
}

export async function restoreTransactionAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "transactionId");
  if (id === "") return;

  const result = await restoreTransaction(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath(`/app/transactions/${id}`);
  redirect(`/app/transactions/${id}`);
}

export async function quickAddAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();

  const parsed = quickAddSchema.safeParse({
    type: text(formData, "type"),
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId") || undefined,
    categoryId: text(formData, "categoryId"),
    note: text(formData, "note"),
    occurredAtLocal: text(formData, "occurredAtLocal") || undefined,
    clientRequestId: text(formData, "clientRequestId") || null,
  });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  }

  const accounts = await listAccounts(session.ctx);
  if (!accounts.ok) return failure(accounts.error.message);
  const accountId =
    parsed.data.accountId ?? accounts.value.find((account) => account.archivedAt === null)?.id;
  if (accountId === undefined) {
    return failure("Buat akun dulu sebelum mencatat transaksi.");
  }

  const occurredAtLocal =
    parsed.data.occurredAtLocal ?? nowLocalInput(new Date(), session.user.timezone);

  const result = await createTransaction(session.ctx, {
    type: parsed.data.type,
    // Pass the raw text: `positiveMoneyText` parses it exactly once inside
    // `createTransaction`. `parsed.data.amount` is already a `bigint`.
    amount: text(formData, "amount"),
    accountId,
    categoryId: text(formData, "categoryId"),
    note: text(formData, "note"),
    occurredAtLocal,
    clientRequestId: parsed.data.clientRequestId ?? crypto.randomUUID(),
    source: "QUICK_ADD",
    allocations: [],
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function createAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createAccount(session.ctx, {
    name: text(formData, "name"),
    type: text(formData, "type"),
    openingBalance: text(formData, "openingBalance"),
    currency: text(formData, "currency") || "IDR",
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function updateAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "accountId");
  if (id === "") return failure("Akun tidak ditemukan.");

  const result = await updateAccount(session.ctx, id, {
    name: text(formData, "name"),
    type: text(formData, "type"),
    openingBalance: text(formData, "openingBalance"),
    currency: text(formData, "currency") || "IDR",
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function archiveAccountAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "accountId");
  const archived = text(formData, "archived") === "true";
  if (id === "") return;

  const result = await setAccountArchived(session.ctx, id, archived);
  if (!result.ok) throw result.error;
  revalidateLedger();
}

export async function createCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createCategory(session.ctx, {
    name: text(formData, "name"),
    kind: text(formData, "kind"),
    parentId: text(formData, "parentId"),
    icon: text(formData, "icon"),
    color: text(formData, "color"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function updateCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "categoryId");
  if (id === "") return failure("Kategori tidak ditemukan.");

  const result = await updateCategory(session.ctx, id, {
    name: text(formData, "name"),
    parentId: text(formData, "parentId"),
    icon: text(formData, "icon"),
    color: text(formData, "color"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function archiveCategoryAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "categoryId");
  const archived = text(formData, "archived") === "true";
  if (id === "") return;

  const result = await setCategoryArchived(session.ctx, id, archived);
  if (!result.ok) throw result.error;
  revalidateLedger();
}

export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "attachmentId");
  const transactionId = text(formData, "transactionId");
  if (id === "") return;

  const result = await softDeleteAttachment(session.ctx, attachmentStorage, id);
  if (!result.ok) throw result.error;

  revalidatePath("/app/transactions");
  if (transactionId !== "") revalidatePath(`/app/transactions/${transactionId}`);
}

export async function updateSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await updateProfile(session.ctx, {
    name: text(formData, "name"),
    timezone: text(formData, "timezone") || undefined,
    weekStartsOn: numberField(formData, "weekStartsOn"),
    budgetMonthStartDay: numberField(formData, "budgetMonthStartDay"),
    currency: text(formData, "currency") || undefined,
  });
  if (!result.ok) return failure(result.error.message);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Payment plans
// ---------------------------------------------------------------------------

export async function createPlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createPlan(session.ctx, {
    name: text(formData, "name"),
    description: text(formData, "description"),
    items: [],
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  redirect(`/app/plans/${result.value.id}`);
}

export async function updatePlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "planId");
  if (id === "") return failure("Rencana tidak ditemukan.");

  const result = await updatePlan(session.ctx, id, {
    name: text(formData, "name"),
    description: text(formData, "description"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath(`/app/plans/${id}`);
  return { status: "success" };
}

export async function archivePlanAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "planId");
  if (id === "") return;

  const result = await setPlanArchived(session.ctx, id, text(formData, "archived") === "true");
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath(`/app/plans/${id}`);
}

export async function createPlanItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const planId = text(formData, "planId");
  if (planId === "") return failure("Rencana tidak ditemukan.");

  const result = await createPlanItem(session.ctx, planId, {
    label: text(formData, "label"),
    expectedAmount: text(formData, "expectedAmount"),
    dueOn: text(formData, "dueOn"),
    note: text(formData, "note"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath(`/app/plans/${planId}`);
  return { status: "success" };
}

export async function updatePlanItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const itemId = text(formData, "itemId");
  const planId = text(formData, "planId");
  if (itemId === "" || planId === "") return failure("Tahap pembayaran tidak ditemukan.");

  const result = await updatePlanItem(session.ctx, itemId, {
    label: text(formData, "label"),
    expectedAmount: text(formData, "expectedAmount"),
    dueOn: text(formData, "dueOn"),
    note: text(formData, "note"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath(`/app/plans/${planId}`);
  return { status: "success" };
}

export async function deletePlanItemAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const itemId = text(formData, "itemId");
  const planId = text(formData, "planId");
  if (itemId === "") return;

  const result = await deletePlanItem(session.ctx, itemId);
  if (!result.ok) throw result.error;

  revalidateLedger();
  if (planId !== "") revalidatePath(`/app/plans/${planId}`);
}

// ---------------------------------------------------------------------------
// Snapshots and checkpoints
// ---------------------------------------------------------------------------

export async function createSnapshotAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const accountId = text(formData, "accountId");

  const result = await createSnapshot(session.ctx, {
    accountId,
    amount: text(formData, "amount"),
    recordedAtLocal: text(formData, "recordedAtLocal"),
    note: text(formData, "note"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function deleteSnapshotAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const snapshotId = text(formData, "snapshotId");
  if (snapshotId === "") return;

  const result = await softDeleteSnapshot(session.ctx, snapshotId);
  if (!result.ok) throw result.error;

  revalidateLedger();
}

export async function verifyCheckpointAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const snapshotId = text(formData, "snapshotId");
  if (snapshotId === "") return failure("Snapshot tidak ditemukan.");

  const result = await verifyCheckpoint(session.ctx, snapshotId);
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

export async function unlockCheckpointAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const checkpointId = text(formData, "checkpointId");
  if (checkpointId === "") return failure("Checkpoint tidak ditemukan.");

  const result = await unlockCheckpoint(session.ctx, checkpointId, {
    reason: text(formData, "reason"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export async function createTransferAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();

  const result = await createTransfer(session.ctx, {
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId"),
    destinationAccountId: text(formData, "destinationAccountId"),
    feeAmount: text(formData, "feeAmount") || "0",
    feeCategoryId: text(formData, "feeCategoryId"),
    note: text(formData, "note"),
    occurredAtLocal: text(formData, "occurredAtLocal"),
    clientRequestId: text(formData, "clientRequestId") || null,
    source: "MANUAL",
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  redirect(`/app/transactions/${result.value.id}`);
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export async function createBudgetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createBudget(session.ctx, {
    name: text(formData, "name"),
    categoryId: text(formData, "categoryId"),
    amount: text(formData, "amount"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/budgets");
  return { status: "success" };
}

export async function updateBudgetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "budgetId");
  if (id === "") return failure("Anggaran tidak ditemukan.");

  const result = await updateBudget(session.ctx, id, {
    name: text(formData, "name"),
    categoryId: text(formData, "categoryId"),
    amount: text(formData, "amount"),
    active:
      formData.get("active") === "true"
        ? true
        : formData.get("active") === "false"
          ? false
          : undefined,
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/budgets");
  return { status: "success" };
}

export async function deleteBudgetAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "budgetId");
  if (id === "") return;

  const result = await deleteBudget(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/budgets");
}

// ---------------------------------------------------------------------------
// Recurring templates
// ---------------------------------------------------------------------------

export async function createRecurringAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createRecurring(session.ctx, {
    type: text(formData, "type"),
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId"),
    destinationAccountId: text(formData, "destinationAccountId"),
    categoryId: text(formData, "categoryId"),
    merchant: text(formData, "merchant"),
    counterparty: text(formData, "counterparty"),
    note: text(formData, "note"),
    frequency: text(formData, "frequency"),
    dayOfMonth: text(formData, "dayOfMonth"),
    dayOfWeek: text(formData, "dayOfWeek"),
    startDate: text(formData, "startDate"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/recurring");
  return { status: "success" };
}

export async function updateRecurringAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "recurringId");
  if (id === "") return failure("Template tidak ditemukan.");

  const _result = await updateRecurring(session.ctx, id, {
    amount: text(formData, "amount"),
    accountId: text(formData, "accountId"),
    destinationAccountId: text(formData, "destinationAccountId"),
    categoryId: text(formData, "categoryId"),
    merchant: text(formData, "merchant"),
    counterparty: text(formData, "counterparty"),
    note: text(formData, "note"),
    frequency: (text(formData, "frequency") || undefined) as
      | "DAILY"
      | "WEEKLY"
      | "MONTHLY"
      | "YEARLY"
      | undefined,
    dayOfMonth: text(formData, "dayOfMonth"),
    dayOfWeek: text(formData, "dayOfWeek"),
    active:
      formData.get("active") === "true"
        ? true
        : formData.get("active") === "false"
          ? false
          : undefined,
  });
  return { status: "success" };
}

export async function deleteRecurringAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "recurringId");
  if (id === "") return;

  const result = await deleteRecurring(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/recurring");
}

export async function runRecurringAction(_formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const result = await runDueRecurring(session.ctx);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/recurring");
  revalidatePath("/app/transactions");
}
