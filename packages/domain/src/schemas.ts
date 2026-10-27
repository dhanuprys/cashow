import { z } from "zod";
import { parseMoney } from "./money";

/**
 * Shared input schemas (plan §6: "Zod, one set of schemas").
 *
 * Forms, server actions, AI tools and imports all validate through these, so
 * the shape of a create/update is defined exactly once. Money arrives as text
 * (`35rb`, `1,5jt`, `Rp 35.000`) and leaves as a positive `bigint`.
 */

const idText = z.string().trim().min(1).max(64);

/** Trimmed, empty-to-null text with a length cap. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === "" ? null : value));

/**
 * Patch variant: an omitted field stays `undefined` (unchanged), while an
 * explicit empty string or null clears it. Create schemas normalize omitted
 * fields to null; update schemas must not clear a field the caller omitted.
 */
const nullablePatchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullable()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === null || value === "" ? null : value,
    );

/** Money that must be greater than zero (transaction amounts, allocations). */
export const positiveMoneyText = z
  .string()
  .trim()
  .min(1, "Jumlah wajib diisi.")
  .transform((value, ctx) => {
    const amount = parseMoney(value);
    if (amount === null) {
      ctx.addIssue({
        code: "custom",
        message: "Jumlah tidak dikenali. Contoh: 35rb, 1,5jt, Rp 35.000.",
      });
      return z.NEVER;
    }
    if (amount <= 0n) {
      ctx.addIssue({ code: "custom", message: "Jumlah harus lebih dari nol." });
      return z.NEVER;
    }
    return amount;
  });

/** Money that may be zero or negative (opening balances). */
export const signedMoneyText = z
  .string()
  .trim()
  .default("0")
  .transform((value, ctx) => {
    const amount = parseMoney(value);
    if (amount === null) {
      ctx.addIssue({
        code: "custom",
        message: "Jumlah tidak dikenali. Contoh: 0, -250rb, 1,5jt.",
      });
      return z.NEVER;
    }
    return amount;
  });

export const accountTypeSchema = z.enum(["BANK", "EWALLET", "CASH", "INVESTMENT"], {
  message: "Jenis akun tidak dikenal.",
});
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"], {
  message: "Jenis kategori tidak dikenal.",
});
export const cashflowTypeSchema = z.enum(["INCOME", "EXPENSE"], {
  message: "Jenis transaksi harus pemasukan atau pengeluaran.",
});
export const attachmentKindSchema = z.enum(["PROOF", "INVOICE", "CONTRACT", "RECEIPT"], {
  message: "Jenis lampiran tidak dikenal.",
});

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Nama akun wajib diisi.").max(80, "Maksimal 80 karakter."),
  type: accountTypeSchema,
  openingBalance: signedMoneyText,
  currency: z
    .string()
    .trim()
    .default("IDR")
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, "Kode mata uang harus tiga huruf, misalnya IDR.")),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(80, "Maksimal 80 karakter."),
  kind: categoryKindSchema,
  parentId: nullableText(64),
  icon: nullableText(32),
  color: nullableText(32),
});

/**
 * A category's kind is immutable: history and transactions rely on it. The
 * parent may change, but the service refuses a cycle.
 */
export const categoryUpdateSchema = categoryInputSchema
  .omit({ kind: true })
  .partial()
  .extend({
    name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(80, "Maksimal 80 karakter."),
  });

export const allocationInputSchema = z.object({
  incomeId: idText,
  amount: positiveMoneyText,
});

export const localDateTimeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/,
    "Tanggal dan waktu tidak valid (contoh: 2026-10-27T09:30).",
  );

/** A calendar date (`YYYY-MM-DD`); empty means "no date". */
export const localDateSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => (value === undefined || value === null || value === "" ? null : value))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid (contoh: 2026-10-31).")
      .nullable(),
  );

/** Money that may be zero but never negative (transfer fees). */
export const nonNegativeMoneyText = z
  .string()
  .trim()
  .default("0")
  .transform((value, ctx) => {
    const amount = parseMoney(value);
    if (amount === null) {
      ctx.addIssue({
        code: "custom",
        message: "Jumlah tidak dikenali. Contoh: 5rb, 1,5jt, atau kosongkan.",
      });
      return z.NEVER;
    }
    if (amount < 0n) {
      ctx.addIssue({ code: "custom", message: "Jumlah tidak boleh negatif." });
      return z.NEVER;
    }
    return amount;
  });

/** Where a quick-added row came from; manual forms use MANUAL. */
export const sourceSchema = z.enum([
  "MANUAL",
  "QUICK_ADD",
  "AI_DRAFT",
  "TELEGRAM",
  "STATEMENT_IMPORT",
  "RECURRING",
  "SHARE_TARGET",
]);

export const transactionCreateSchema = z.object({
  type: cashflowTypeSchema,
  amount: positiveMoneyText,
  accountId: idText,
  categoryId: nullableText(64),
  /** Chained income: which payment-plan item this payment settles. */
  planItemId: nullableText(64),
  merchant: nullableText(120),
  counterparty: nullableText(120),
  note: nullableText(1000),
  occurredAtLocal: localDateTimeSchema,
  clientRequestId: nullableText(100),
  source: sourceSchema.default("MANUAL"),
  allocations: z.array(allocationInputSchema).max(50, "Maksimal 50 alokasi.").default([]),
});

/**
 * Edit keeps the type immutable (changing an income into an expense would
 * orphan allocations). Every other field is optional; omitted means unchanged,
 * except `allocations`, where an explicit array replaces the set.
 */
export const transactionUpdateSchema = z.object({
  amount: positiveMoneyText.optional(),
  accountId: idText.optional(),
  categoryId: nullablePatchText(64),
  planItemId: nullablePatchText(64),
  merchant: nullablePatchText(120),
  counterparty: nullablePatchText(120),
  note: nullablePatchText(1000),
  occurredAtLocal: localDateTimeSchema.optional(),
  allocations: z.array(allocationInputSchema).max(50, "Maksimal 50 alokasi.").optional(),
});

export const quickAddSchema = z.object({
  type: cashflowTypeSchema,
  amount: positiveMoneyText,
  accountId: idText.optional(),
  categoryId: nullableText(64),
  note: nullableText(200),
  occurredAtLocal: localDateTimeSchema.optional(),
  clientRequestId: nullableText(100),
});

export const attachmentMetaSchema = z.object({
  kind: attachmentKindSchema.default("PROOF"),
  fileName: z
    .string()
    .trim()
    .min(1, "Nama berkas wajib ada.")
    .max(200, "Nama berkas terlalu panjang."),
  mimeType: z.string().trim().min(1).max(120),
});

// ---------------------------------------------------------------------------
// Payment plans (chained project income)
// ---------------------------------------------------------------------------

const planName = z
  .string()
  .trim()
  .min(1, "Nama rencana wajib diisi.")
  .max(120, "Maksimal 120 karakter.");
const planLabel = z.string().trim().min(1, "Label wajib diisi.").max(120, "Maksimal 120 karakter.");

export const planItemInputSchema = z.object({
  label: planLabel,
  expectedAmount: positiveMoneyText,
  dueOn: localDateSchema,
  note: nullableText(1000),
});

export const planCreateSchema = z.object({
  name: planName,
  description: nullableText(1000),
  items: z.array(planItemInputSchema).max(50, "Maksimal 50 tahap.").default([]),
});

export const planUpdateSchema = z.object({
  name: planName,
  description: nullableText(1000),
});

export const planItemUpdateSchema = z.object({
  label: planLabel,
  expectedAmount: positiveMoneyText,
  dueOn: localDateSchema,
  note: nullableText(1000),
});

// ---------------------------------------------------------------------------
// Balance snapshots and reconciliation
// ---------------------------------------------------------------------------

export const snapshotCreateSchema = z.object({
  accountId: idText,
  /** The bank's stated balance; may be negative for a debt account. */
  amount: signedMoneyText,
  recordedAtLocal: localDateTimeSchema,
  note: nullableText(500),
});

export const checkpointUnlockSchema = z.object({
  reason: nullableText(500),
});

// ---------------------------------------------------------------------------
// Transfers between the owner's own accounts (a fee is its own expense)
// ---------------------------------------------------------------------------

export const transferCreateSchema = z.object({
  amount: positiveMoneyText,
  accountId: idText,
  destinationAccountId: idText,
  feeAmount: nonNegativeMoneyText,
  feeCategoryId: nullableText(64),
  note: nullableText(1000),
  occurredAtLocal: localDateTimeSchema,
  clientRequestId: nullableText(100),
  source: sourceSchema.default("MANUAL"),
});

const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Zona waktu wajib diisi.")
  .max(60)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Zona waktu tidak dikenal. Contoh: Asia/Jakarta.");

/**
 * Owner preferences used by every report: the timezone that derives
 * `occurredOn`, the week start, and the budget month start day (payday).
 */
export const profileUpdateSchema = z.object({
  name: nullableText(80),
  timezone: timeZoneSchema.optional(),
  weekStartsOn: z.coerce
    .number()
    .int("Hari mulai minggu harus 0–6.")
    .min(0, "Hari mulai minggu harus 0–6.")
    .max(6, "Hari mulai minggu harus 0–6.")
    .optional(),
  budgetMonthStartDay: z.coerce
    .number()
    .int("Tanggal mulai bulan anggaran harus 1–28.")
    .min(1, "Tanggal mulai bulan anggaran harus 1–28.")
    .max(28, "Tanggal mulai bulan anggaran harus 1–28.")
    .optional(),
  currency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, "Kode mata uang harus tiga huruf, misalnya IDR."))
    .optional(),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type AllocationInput = z.infer<typeof allocationInputSchema>;
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type QuickAddInput = z.infer<typeof quickAddSchema>;
export type AttachmentMetaInput = z.infer<typeof attachmentMetaSchema>;
export type PlanItemInput = z.infer<typeof planItemInputSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type PlanItemUpdateInput = z.infer<typeof planItemUpdateSchema>;
export type SnapshotCreateInput = z.infer<typeof snapshotCreateSchema>;
export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type CheckpointUnlockInput = z.infer<typeof checkpointUnlockSchema>;

/** Render the first issue of a failed parse as an Indonesian sentence. */
export const budgetInputSchema = z.object({
  name: z.string().trim().min(1, "Nama anggaran wajib diisi.").max(80, "Maksimal 80 karakter."),
  categoryId: nullableText(64),
  amount: positiveMoneyText,
});

export const budgetUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama anggaran wajib diisi.")
    .max(80, "Maksimal 80 karakter.")
    .optional(),
  categoryId: nullablePatchText(64),
  amount: positiveMoneyText.optional(),
  active: z.boolean().optional(),
});

export const recurringFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"], {
  message: "Frekuensi tidak dikenal.",
});

export const recurringInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"], { message: "Jenis transaksi tidak dikenal." }),
  amount: positiveMoneyText,
  accountId: idText,
  destinationAccountId: nullableText(64),
  categoryId: nullableText(64),
  merchant: nullableText(120),
  counterparty: nullableText(120),
  note: nullableText(1000),
  frequency: recurringFrequencySchema,
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  startDate: localDateSchema.optional(),
});

export const recurringUpdateSchema = z.object({
  amount: positiveMoneyText.optional(),
  accountId: idText.optional(),
  destinationAccountId: nullablePatchText(64),
  categoryId: nullablePatchText(64),
  merchant: nullablePatchText(120),
  counterparty: nullablePatchText(120),
  note: nullablePatchText(1000),
  frequency: recurringFrequencySchema.optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  active: z.boolean().optional(),
});

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "Data tidak valid.";
  return issue.message;
}
