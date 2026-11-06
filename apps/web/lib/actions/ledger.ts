"use server";

import { quickAddSchema, uuidv7 } from "@cashow/domain";
import {
  addGoalReservation,
  archiveGoal,
  confirmRecurringDraft,
  createAccount,
  createAiProviderConfig,
  createBudget,
  createCategory,
  createGoal,
  createPlan,
  createPlanItem,
  createRecurring,
  createRule,
  createSnapshot,
  createTransaction,
  createTransfer,
  deleteAiProviderConfig,
  deleteBudget,
  deletePlanItem,
  deleteRecurring,
  deleteRule,
  getAiProviderConfig,
  getAiTokenUsageStats,
  listAccounts,
  listCategories,
  markNotificationRead,
  removeGoalReservation,
  restoreTransaction,
  runDueRecurring,
  runRules,
  savePushSubscription,
  seedStandardCategories,
  setAccountArchived,
  setCategoryArchived,
  setDefaultAiProviderConfig,
  setPlanArchived,
  skipRecurringDraft,
  snoozeNotification,
  softDeleteAttachment,
  softDeleteSnapshot,
  softDeleteTransaction,
  unlockCheckpoint,
  updateAccount,
  updateAiProviderConfig,
  updateBudget,
  updateCategory,
  updateGoal,
  updatePlan,
  updatePlanItem,
  updateProfile,
  updateRecurring,
  updateRule,
  updateSnapshot,
  updateTransaction,
  uploadAttachment,
  verifyCheckpoint,
  writeAudit,
} from "@cashow/services";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildLanguageModel } from "@/lib/ai-model";
import { checkPassword, hashPassword } from "@/lib/auth/session";
import { nowLocalInput } from "@/lib/format";
import { requireLedgerSession } from "@/lib/ledger";
import { attachmentStorage } from "@/lib/storage";
/**
 * Server actions are the only mutation boundary the UI has. Every one resolves
 * the session, calls the shared use case, revalidates the affected paths, and
 * returns an Indonesian message instead of throwing for expected failures.
 */
import type { ActionState } from "./state";
import { initialActionState } from "./state";

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
  // Budget spend, rule matches and inbox items are all derived from
  // transactions, so recording one invalidates these pages too.
  revalidatePath("/app/budgets");
  revalidatePath("/app/rules");
  revalidatePath("/app/inbox");
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

  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadAttachment(session.ctx, attachmentStorage, {
      transactionId: result.value.id,
      kind: text(formData, "attachmentKind") || "PROOF",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });
  }

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
    clientRequestId: parsed.data.clientRequestId ?? uuidv7(),
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

export async function seedCategoriesAction(): Promise<void> {
  const session = await requireLedgerSession();
  const result = await seedStandardCategories(session.ctx);
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
    avatar: text(formData, "avatar") || null,
    bio: text(formData, "bio") || null,
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

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const currentPassword = text(formData, "currentPassword");
  const newPassword = text(formData, "newPassword");
  const confirmPassword = text(formData, "confirmPassword");
  const usernameInput = text(formData, "username").trim();

  const user = await session.db.orm.public.User.where({ id: session.user.id })
    .select("id", "username", "email", "password")
    .first();

  if (user === null) {
    return failure("Pengguna tidak ditemukan.");
  }

  const hasExistingPassword = user.password !== null && user.password !== "";

  if (hasExistingPassword) {
    if (!currentPassword) {
      return failure("Kata sandi saat ini wajib diisi.");
    }
    const isValid = await checkPassword(currentPassword, user.password);
    if (!isValid) {
      return failure("Kata sandi saat ini tidak sesuai.");
    }
  }

  if (newPassword.length < 6) {
    return failure("Kata sandi baru minimal 6 karakter.");
  }

  if (newPassword.length > 128) {
    return failure("Kata sandi baru maksimal 128 karakter.");
  }

  if (newPassword !== confirmPassword) {
    return failure("Konfirmasi kata sandi baru tidak cocok.");
  }

  if (hasExistingPassword && currentPassword === newPassword) {
    return failure("Kata sandi baru tidak boleh sama dengan kata sandi saat ini.");
  }

  let usernameToSet: string | undefined;
  if (!user.username && usernameInput) {
    if (usernameInput.length < 3 || usernameInput.length > 64) {
      return failure("Username minimal 3 dan maksimal 64 karakter.");
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(usernameInput)) {
      return failure(
        "Username hanya boleh berisi huruf, angka, underscore, titik, atau tanda minus.",
      );
    }
    const taken = await session.db.orm.public.User.where({ username: usernameInput }).first();
    if (taken !== null && taken.id !== session.user.id) {
      return failure("Username ini sudah digunakan akun lain.");
    }
    usernameToSet = usernameInput;
  } else if (!user.username && !user.email) {
    if (!usernameInput) {
      return failure("Masukkan username agar Anda dapat masuk menggunakan kata sandi.");
    }
    if (usernameInput.length < 3 || usernameInput.length > 64) {
      return failure("Username minimal 3 dan maksimal 64 karakter.");
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(usernameInput)) {
      return failure(
        "Username hanya boleh berisi huruf, angka, underscore, titik, atau tanda minus.",
      );
    }
    const taken = await session.db.orm.public.User.where({ username: usernameInput }).first();
    if (taken !== null && taken.id !== session.user.id) {
      return failure("Username ini sudah digunakan akun lain.");
    }
    usernameToSet = usernameInput;
  }

  const hashedPassword = await hashPassword(newPassword);

  await session.db.transaction(async (tx) => {
    const updatePayload: { password: string; updatedAt: string; username?: string } = {
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    };
    if (usernameToSet !== undefined) {
      updatePayload.username = usernameToSet;
    }

    await tx.orm.public.User.where({ id: session.user.id }).update(updatePayload);

    await writeAudit(tx, {
      userId: session.user.id,
      entityType: "User",
      entityId: session.user.id,
      action: "UPDATE",
      before: { hasPassword: hasExistingPassword },
      after: { hasPassword: true, usernameSet: usernameToSet !== undefined },
    });
  });

  revalidatePath("/app/settings");
  return {
    status: "success",
    message: hasExistingPassword
      ? "Kata sandi berhasil diperbarui."
      : "Kata sandi berhasil dibuat.",
  };
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

export async function updateSnapshotAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();

  const result = await updateSnapshot(session.ctx, {
    snapshotId: text(formData, "snapshotId"),
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
  const period = text(formData, "period") || "MONTHLY";
  const startDate = text(formData, "startDate");
  const endDate = text(formData, "endDate");

  const result = await createBudget(session.ctx, {
    name: text(formData, "name"),
    categoryId: text(formData, "categoryId"),
    amount: text(formData, "amount"),
    period,
    startDate: startDate || null,
    endDate: endDate || null,
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

  const period = text(formData, "period");
  const startDate = text(formData, "startDate");
  const endDate = text(formData, "endDate");

  const result = await updateBudget(session.ctx, id, {
    name: text(formData, "name"),
    categoryId: text(formData, "categoryId"),
    amount: text(formData, "amount"),
    period: period || undefined,
    startDate: startDate !== "" ? startDate : null,
    endDate: endDate !== "" ? endDate : null,
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

  const result = await updateRecurring(session.ctx, id, {
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
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/recurring");
  return { status: "success" };
}

export async function toggleRecurringActiveAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "recurringId");
  if (id === "") return;

  const activeRaw = text(formData, "active");
  const result = await updateRecurring(session.ctx, id, {
    active: activeRaw === "" ? undefined : activeRaw === "true",
  });
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/recurring");
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

export async function confirmRecurringDraftAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "draftId");
  if (id === "") return;

  const result = await confirmRecurringDraft(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/recurring");
  revalidatePath("/app/transactions");
}

export async function skipRecurringDraftAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "draftId");
  if (id === "") return;

  const result = await skipRecurringDraft(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/recurring");
}

export async function createRuleFormAction(formData: FormData): Promise<void> {
  await createRuleAction(initialActionState, formData);
}

export async function createRuleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  let trigger: unknown = {};
  let condition: unknown = {};
  try {
    trigger = JSON.parse(text(formData, "trigger") || "{}");
    condition = JSON.parse(text(formData, "condition") || "{}");
  } catch {
    return failure("JSON tidak valid.");
  }
  const severity = text(formData, "severity") || "INFO";
  const cooldownMinutes = Number(text(formData, "cooldownMinutes")) || 0;
  const edgeTriggered = formData.get("edgeTriggered") !== "false";

  const result = await createRule(session.ctx, {
    name: text(formData, "name"),
    description: text(formData, "description"),
    trigger,
    condition,
    actions: [],
    settings: {
      severity: severity === "ALERT" || severity === "WARNING" ? severity : "INFO",
      cooldownMinutes,
      edgeTriggered,
    },
    active: true,
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/rules");
  return { status: "success" };
}

export async function updateRuleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "ruleId");
  if (id === "") return failure("Aturan tidak ditemukan.");

  // If toggling active status only
  const activeRaw = text(formData, "active");
  const name = text(formData, "name");

  if (!name && activeRaw !== "") {
    const result = await updateRule(session.ctx, id, {
      active: activeRaw === "true",
    });
    if (!result.ok) throw result.error;
    revalidateLedger();
    revalidatePath("/app/rules");
    return { status: "success" };
  }

  // Full rule update
  let trigger: unknown;
  let condition: unknown;
  try {
    const triggerText = text(formData, "trigger");
    const conditionText = text(formData, "condition");
    if (triggerText) trigger = JSON.parse(triggerText);
    if (conditionText) condition = JSON.parse(conditionText);
  } catch {
    return failure("JSON tidak valid.");
  }

  const severity = text(formData, "severity") || "INFO";
  const cooldownMinutes = Number(text(formData, "cooldownMinutes")) || 0;
  const edgeTriggered = formData.get("edgeTriggered") !== "false";

  const result = await updateRule(session.ctx, id, {
    name: name || undefined,
    description: text(formData, "description"),
    trigger,
    condition,
    settings: {
      severity: severity === "ALERT" || severity === "WARNING" ? severity : "INFO",
      cooldownMinutes,
      edgeTriggered,
    },
    active: activeRaw === "" ? undefined : activeRaw === "true",
  });
  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/rules");
  return { status: "success" };
}

export async function toggleRuleActiveAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "ruleId");
  if (id === "") return;

  const activeRaw = text(formData, "active");
  const result = await updateRule(session.ctx, id, {
    active: activeRaw === "" ? undefined : activeRaw === "true",
  });
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/rules");
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "ruleId");
  if (id === "") return;
  const result = await deleteRule(session.ctx, id);
  if (!result.ok) throw result.error;
  revalidateLedger();
  revalidatePath("/app/rules");
}

export async function importCsvAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const csv = text(formData, "csv");
  if (csv.trim() === "") return failure("CSV wajib diisi.");

  const accounts = await listAccounts(session.ctx);
  const account = accounts.ok ? accounts.value.find((a) => a.archivedAt === null) : null;
  if (account === undefined || account === null) return failure("Tidak ada akun aktif.");

  const categories = await listCategories(session.ctx);
  const expenseCategory = categories.ok
    ? categories.value.find((c) => c.kind === "EXPENSE" && c.archivedAt === null)
    : null;
  const incomeCategory = categories.ok
    ? categories.value.find((c) => c.kind === "INCOME" && c.archivedAt === null)
    : null;

  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .slice(1);

  let created = 0;
  const problems: string[] = [];

  for (const row of rows) {
    if (row.line.trim() === "") continue;

    const parts = row.line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) {
      problems.push(`Baris ${row.number}: butuh minimal 3 kolom (tanggal, jumlah, jenis).`);
      continue;
    }

    const [date, amount, typeRaw] = parts;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      problems.push(`Baris ${row.number}: tanggal "${date ?? ""}" bukan format YYYY-MM-DD.`);
      continue;
    }

    const type = typeRaw?.toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE";
    const category = type === "INCOME" ? incomeCategory : expenseCategory;
    const note = parts.length >= 4 ? parts.slice(3).join(", ").trim() : null;

    // Duplicate detection: check if same transaction already exists on that date
    const parsedAmount = BigInt(amount || "0");
    const duplicate = await session.ctx.db.orm.public.Transaction.where({
      userId: session.ctx.userId,
      accountId: account.id,
      type,
      amount: parsedAmount,
      occurredOn: date,
    }).first();

    if (duplicate !== null) {
      problems.push(
        `Baris ${row.number}: dilewati (duplikat transaksi ${date} senilai ${amount}).`,
      );
      continue;
    }

    const result = await createTransaction(session.ctx, {
      type,
      amount,
      accountId: account.id,
      categoryId: category?.id ?? null,
      note: note === "" ? null : note,
      occurredAtLocal: `${date}T12:00`,
      source: "STATEMENT_IMPORT",
      allocations: [],
      clientRequestId: null,
    });

    if (result.ok) {
      created += 1;
    } else {
      problems.push(`Baris ${row.number}: ${result.error.message}`);
    }
  }

  revalidateLedger();
  revalidatePath("/app/transactions");

  if (created === 0) {
    return failure(
      problems.length === 0
        ? "Tidak ada baris data setelah header."
        : `Tidak ada transaksi yang diimpor. ${problems[0]}`,
    );
  }

  const skipped = problems.length === 0 ? "" : ` ${problems.length} baris dilewati: ${problems[0]}`;
  return { status: "success", message: `${created} transaksi diimpor.${skipped}` };
}

/** Trigger families a full manual sweep evaluates, including scheduled rules. */
const MANUAL_TRIGGER_FAMILIES = [
  "transaction",
  "snapshot",
  "planItem",
  "schedule",
  "metricThreshold",
  "backup",
] as const;

export async function runRulesAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const requested = text(formData, "triggerType");
  const families: readonly string[] =
    requested === "" || requested === "manual" ? MANUAL_TRIGGER_FAMILIES : [requested];
  const result = await runRules(session.ctx, [...families]);
  if (!result.ok) throw result.error;
  revalidateLedger();
  revalidatePath("/app/rules");
  revalidatePath("/app/inbox");
}

export async function subscribePushAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await savePushSubscription(session.ctx, {
    endpoint: text(formData, "endpoint"),
    p256dh: text(formData, "p256dh"),
    auth: text(formData, "auth"),
    label: text(formData, "label"),
  });
  if (!result.ok) return failure(result.error.message);

  revalidatePath("/app/inbox");
  return { status: "success" };
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "notificationId");
  if (id === "") return;
  await markNotificationRead(session.ctx, id);
  revalidatePath("/app/inbox");
}

export async function snoozeNotificationAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "notificationId");
  const minutes = Number(text(formData, "minutes") || "60");
  if (id === "") return;
  const result = await snoozeNotification(session.ctx, id, Number.isFinite(minutes) ? minutes : 60);
  if (!result.ok) throw result.error;
  revalidatePath("/app/inbox");
}

// ---------------------------------------------------------------------------
// AI Provider configurations
// ---------------------------------------------------------------------------

/**
 * Creates a new provider configuration, or updates an existing one when the
 * form carries an `id`. One action keeps the create/edit dialog honest: both
 * paths revalidate the same routes and return the same `ActionState` shape.
 */
export async function saveAiProviderConfigAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "id");
  const provider = text(formData, "provider");
  const name = text(formData, "name");
  const apiKey = text(formData, "apiKey");
  const copyApiKeyFromId = text(formData, "copyApiKeyFromId") || null;
  const baseUrl = text(formData, "baseUrl") || null;
  const model = text(formData, "model");
  const customModelsRaw = text(formData, "customModels");
  const isDefault = formData.get("isDefault") === "true";

  const customModels = customModelsRaw
    ? customModelsRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const result =
    id === ""
      ? await createAiProviderConfig(session.ctx, {
          provider,
          name,
          apiKey,
          copyApiKeyFromId,
          baseUrl,
          model,
          customModels,
          isDefault,
        })
      : await updateAiProviderConfig(session.ctx, id, {
          provider: provider === "" ? undefined : provider,
          name,
          baseUrl,
          model,
          customModels,
          isDefault,
          // An empty field means "keep the stored key", never "erase it".
          ...(apiKey === "" ? {} : { apiKey }),
        });

  if (!result.ok) return failure(result.error.message);

  revalidatePath("/app/settings");
  revalidatePath("/app/chat");
  return {
    status: "success",
    message:
      id === ""
        ? "Konfigurasi model AI berhasil ditambahkan."
        : "Konfigurasi model AI berhasil diperbarui.",
  };
}

/**
 * Sends one tiny prompt through a stored configuration so the user can prove
 * the key, model id and base URL work before relying on them in a chat.
 */
export async function testAiProviderConfigAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "id");
  if (id === "") return failure("Konfigurasi AI tidak ditemukan.");

  const configResult = await getAiProviderConfig(session.ctx, id);
  if (!configResult.ok) return failure(configResult.error.message);

  const config = configResult.value;
  if (config === null) return failure("Konfigurasi AI tidak ditemukan.");

  const specificModel = text(formData, "model");
  if (specificModel) {
    config.model = specificModel;
  } else if (!config.model || config.model.trim() === "") {
    if (config.customModels && config.customModels.length > 0) {
      config.model = config.customModels[0];
    }
  }

  const startedAt = Date.now();
  try {
    const result = await generateText({
      model: buildLanguageModel(config),
      prompt: "Balas dengan satu kata: OK",
      // Reasoning models spend part of the budget on hidden thinking tokens,
      // so leave enough room for an actual visible reply.
      maxOutputTokens: 256,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const elapsed = Date.now() - startedAt;
    const reply = result.text.trim().replace(/\s+/g, " ").slice(0, 60);
    return {
      status: "success",
      message: `Koneksi ke ${config.name} (${config.model}) berhasil (${elapsed} ms).${
        reply === "" ? "" : ` Balasan: ${reply}`
      }`,
    };
  } catch (error) {
    return failure(`Koneksi ke ${config.name} gagal: ${errorMessage(error).slice(0, 240)}`);
  }
}

export async function setDefaultAiProviderConfigAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "id");
  if (id === "") return;

  const result = await setDefaultAiProviderConfig(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidatePath("/app/settings");
  revalidatePath("/app/chat");
}

export async function deleteAiProviderConfigAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "id");
  if (id === "") return;

  const result = await deleteAiProviderConfig(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidatePath("/app/settings");
  revalidatePath("/app/chat");
}

export async function getAiTokenUsageStatsAction(options?: {
  providerConfigId?: string;
  limit?: number;
}) {
  const session = await requireLedgerSession();
  const res = await getAiTokenUsageStats(session.ctx, options);
  if (!res.ok) {
    throw new Error(res.error.message);
  }
  return res.value;
}

// ---------------------------------------------------------------------------
// Savings Goals & Reservations
// ---------------------------------------------------------------------------

export async function createGoalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await createGoal(session.ctx, {
    name: text(formData, "name"),
    description: text(formData, "description"),
    targetAmount: text(formData, "targetAmount"),
    targetDate: text(formData, "targetDate") || undefined,
    color: text(formData, "color") || undefined,
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/goals");
  return { status: "success", message: "Target tabungan berhasil dibuat." };
}

export async function updateGoalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const id = text(formData, "goalId");
  if (!id) return failure("Target tidak ditemukan.");

  const statusRaw = text(formData, "status");
  const result = await updateGoal(session.ctx, id, {
    name: text(formData, "name") || undefined,
    description: text(formData, "description") || null,
    targetAmount: text(formData, "targetAmount") || undefined,
    targetDate: text(formData, "targetDate") || null,
    status:
      statusRaw === "ACTIVE" || statusRaw === "PAUSED" || statusRaw === "COMPLETED"
        ? statusRaw
        : undefined,
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/goals");
  return { status: "success", message: "Target tabungan berhasil diperbarui." };
}

export async function archiveGoalAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "goalId");
  if (!id) return;

  const result = await archiveGoal(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/goals");
}

export async function addGoalReservationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireLedgerSession();
  const result = await addGoalReservation(session.ctx, {
    goalId: text(formData, "goalId"),
    accountId: text(formData, "accountId"),
    amount: text(formData, "amount"),
    note: text(formData, "note") || null,
  });

  if (!result.ok) return failure(result.error.message);

  revalidateLedger();
  revalidatePath("/app/goals");
  revalidatePath("/app/accounts");
  return { status: "success", message: "Dana berhasil dicadangkan untuk target." };
}

export async function removeGoalReservationAction(formData: FormData): Promise<void> {
  const session = await requireLedgerSession();
  const id = text(formData, "reservationId");
  if (!id) return;

  const result = await removeGoalReservation(session.ctx, id);
  if (!result.ok) throw result.error;

  revalidateLedger();
  revalidatePath("/app/goals");
  revalidatePath("/app/accounts");
}
