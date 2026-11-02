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

export const snapshotUpdateSchema = z.object({
  snapshotId: idText,
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
  avatar: nullableText(64),
  bio: nullableText(250),
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
export type SnapshotUpdateInput = z.infer<typeof snapshotUpdateSchema>;
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

/** Input for username/password registration and login. */
export const passwordInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(64, "Maksimal 64 karakter."),
  password: z
    .string()
    .trim()
    .min(6, "Kata sandi minimal 6 karakter.")
    .max(128, "Maksimal 128 karakter."),
});

export type PasswordInput = z.infer<typeof passwordInputSchema>;

// ---------------------------------------------------------------------------
// Rules & Alerts
// ---------------------------------------------------------------------------

export const ruleOpSchema = z.enum(["eq", "ne", "gt", "gte", "lt", "lte"], {
  message: "Operator aturan tidak valid.",
});

export const ruleConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      all: z.array(ruleConditionSchema).min(1, "Minimal satu kondisi."),
    }),
    z.object({
      any: z.array(ruleConditionSchema).min(1, "Minimal satu kondisi."),
    }),
    z.object({
      not: ruleConditionSchema,
    }),
    z.object({
      metric: z.string().trim().min(1, "Metrik wajib diisi."),
      op: ruleOpSchema,
      value: z.union([
        z.number(),
        z.object({ metric: z.string() }),
        z.object({ percentOf: z.string(), percent: z.number().optional() }),
        z.object({ multipleOf: z.string(), times: z.number().optional() }),
      ]),
    }),
  ]),
);

export const ruleTriggerSchema = z.object({
  type: z.string().trim().min(1, "Tipe trigger wajib diisi."),
  filters: z.record(z.string(), z.unknown()).optional(),
  cron: z.string().optional(),
});

export const ruleSettingsSchema = z.object({
  severity: z.enum(["INFO", "WARNING", "ALERT"]).default("INFO"),
  cooldownMinutes: z.number().int().min(0).default(0),
  edgeTriggered: z.boolean().default(true),
});

export const ruleInputSchema = z.object({
  name: z.string().trim().min(1, "Nama aturan wajib diisi.").max(120, "Maksimal 120 karakter."),
  description: nullableText(500),
  trigger: ruleTriggerSchema,
  condition: ruleConditionSchema,
  actions: z.array(z.unknown()).default([]),
  settings: ruleSettingsSchema.default({
    severity: "INFO",
    cooldownMinutes: 0,
    edgeTriggered: true,
  }),
  active: z.boolean().default(true),
});

export const ruleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: nullablePatchText(500),
  trigger: ruleTriggerSchema.optional(),
  condition: ruleConditionSchema.optional(),
  actions: z.array(z.unknown()).optional(),
  settings: ruleSettingsSchema.partial().optional(),
  active: z.boolean().optional(),
});

export type RuleInput = z.infer<typeof ruleInputSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;

export const aiProviderTypeSchema = z.enum(["GOOGLE", "DEEPSEEK", "OPENAI", "OPENAI_COMPATIBLE"], {
  message: "Penyedia AI tidak valid.",
});

export type AiProviderType = z.infer<typeof aiProviderTypeSchema>;

export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "deepseek-chat", label: "DeepSeek Chat (Alias)" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner (Alias)" },
] as const;

export const GOOGLE_MODELS = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (Stabil & Cepat)" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-flash-latest", label: "Gemini Flash Latest" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

export const OPENAI_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "o3-mini", label: "o3-mini" },
] as const;

export const OPENAI_COMPATIBLE_MODELS = [] as const;

export const PROVIDER_MODELS = {
  DEEPSEEK: DEEPSEEK_MODELS,
  GOOGLE: GOOGLE_MODELS,
  OPENAI: OPENAI_MODELS,
  OPENAI_COMPATIBLE: OPENAI_COMPATIBLE_MODELS,
} as const;

/**
 * Validates that the requested model is supported or valid for the selected AI provider.
 * Enforces:
 * - Common: non-empty, max 80 chars, valid identifier characters.
 * - GOOGLE: Presets (gemini-3.8-flash, gemini-3.5-flash) or custom models (e.g. gemini-3.8-pro).
 *           If the model name contains a Gemini version, minimum version must be 3.5.
 * - DEEPSEEK: Presets (deepseek-v4-pro, deepseek-v4-flash) or custom models (e.g. deepseek-reasoner).
 *             Rejects deprecated legacy models (deepseek-chat, deepseek-v3, deepseek-v2).
 * - OPENAI: Presets (gpt-4o-mini, gpt-4o, o3-mini) or custom models (fine-tuned, proxy, o1, etc.).
 */
export function validateProviderModel(provider: AiProviderType, model: string): string | null {
  const trimmed = model.trim();
  if (trimmed === "") {
    return "Nama model wajib diisi.";
  }

  if (trimmed.length > 80) {
    return "Nama model maksimal 80 karakter.";
  }

  if (!/^[a-zA-Z0-9_./:@#-]+$/.test(trimmed)) {
    return "Format nama model tidak valid. Gunakan huruf, angka, tanda hubung (-), titik (.), garis miring (/), titik dua (:), atau karakter (@/#).";
  }

  if (provider === "GOOGLE") {
    if (trimmed === "gemini-flash-latest" || trimmed === "gemini-flash-lite-latest") {
      return null;
    }
    const match = trimmed.match(/gemini-(\d+(?:\.\d+)?)/i);
    if (match?.[1]) {
      const version = Number.parseFloat(match[1]);
      if (!Number.isNaN(version) && version < 2.5) {
        return "Versi model Gemini minimal 2.5 (contoh: gemini-flash-latest, gemini-3.8-flash, gemini-2.5-flash). Versi di bawah 2.5 tidak lagi didukung.";
      }
    }
    return null;
  }

  if (provider === "DEEPSEEK") {
    const lower = trimmed.toLowerCase();
    if (lower === "deepseek-v3" || lower === "deepseek-v2") {
      return "Model DeepSeek versi lama ('deepseek-v3', 'deepseek-v2') tidak lagi didukung. Gunakan DeepSeek V4 (deepseek-v4-flash, deepseek-v4-pro) atau deepseek-chat/deepseek-reasoner.";
    }
    return null;
  }

  if (provider === "OPENAI" || provider === "OPENAI_COMPATIBLE") {
    // Allows presets as well as custom / fine-tuned / proxy models
    return null;
  }

  return null;
}

export const aiProviderConfigCreateSchema = z
  .object({
    provider: aiProviderTypeSchema,
    name: z.string().trim().min(1, "Nama label wajib diisi.").max(60, "Nama maksimal 60 karakter."),
    apiKey: z.string().trim().max(256, "API Key terlalu panjang.").optional().default(""),
    copyApiKeyFromId: z.string().trim().optional().nullable(),
    baseUrl: z
      .string()
      .trim()
      .url("Base URL harus berupa URL valid.")
      .optional()
      .nullable()
      .or(z.literal("")),
    model: z.string().trim().max(80, "Model maksimal 80 karakter.").optional().default(""),
    customModels: z
      .array(z.string().trim().min(1, "Nama model kustom tidak boleh kosong.").max(80))
      .or(
        z.string().transform((val) =>
          val
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        ),
      )
      .optional()
      .default([]),
    isDefault: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const hasKey = data.apiKey && data.apiKey.trim() !== "";
    const hasCopy = data.copyApiKeyFromId && data.copyApiKeyFromId.trim() !== "";
    if (!hasKey && !hasCopy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "API Key wajib diisi atau pilih gunakan kunci tersimpan.",
      });
    }

    if (data.provider === "OPENAI_COMPATIBLE") {
      if (!data.baseUrl || data.baseUrl.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "Base URL wajib diisi untuk penyedia OpenAI Compatible.",
        });
      }

      const hasModel =
        (data.model && data.model.trim() !== "") ||
        (Array.isArray(data.customModels) && data.customModels.length > 0);
      if (!hasModel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customModels"],
          message: "Masukkan minimal satu model untuk penyedia OpenAI Compatible.",
        });
      }
    }

    // Default the primary model if empty for preset providers
    if ((!data.model || data.model.trim() === "") && data.provider !== "OPENAI_COMPATIBLE") {
      const presets = PROVIDER_MODELS[data.provider];
      if (presets && presets.length > 0) {
        data.model = presets[0].id;
      }
    } else if (
      (!data.model || data.model.trim() === "") &&
      Array.isArray(data.customModels) &&
      data.customModels.length > 0 &&
      typeof data.customModels[0] === "string"
    ) {
      data.model = data.customModels[0];
    }

    if (data.model && data.model.trim() !== "") {
      const errorMsg = validateProviderModel(data.provider, data.model);
      if (errorMsg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["model"],
          message: errorMsg,
        });
      }
    }

    if (Array.isArray(data.customModels)) {
      for (let i = 0; i < data.customModels.length; i++) {
        const cm = data.customModels[i];
        if (typeof cm === "string") {
          const cmError = validateProviderModel(data.provider, cm);
          if (cmError) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["customModels", i],
              message: `Model kustom '${cm}': ${cmError}`,
            });
          }
        }
      }
    }
  });

export const aiProviderConfigUpdateSchema = z
  .object({
    provider: aiProviderTypeSchema.optional(),
    name: z.string().trim().min(1).max(60).optional(),
    apiKey: z.string().trim().min(1).max(256).optional(),
    baseUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
    model: z.string().trim().max(80).optional(),
    customModels: z
      .array(z.string().trim().min(1, "Nama model kustom tidak boleh kosong.").max(80))
      .or(
        z.string().transform((val) =>
          val
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        ),
      )
      .optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider && data.model && data.model.trim() !== "") {
      const errorMsg = validateProviderModel(data.provider, data.model);
      if (errorMsg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["model"],
          message: errorMsg,
        });
      }
    }

    if (data.provider && Array.isArray(data.customModels)) {
      for (let i = 0; i < data.customModels.length; i++) {
        const cm = data.customModels[i];
        if (typeof cm === "string") {
          const cmError = validateProviderModel(data.provider, cm);
          if (cmError) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["customModels", i],
              message: `Model kustom '${cm}': ${cmError}`,
            });
          }
        }
      }
    }
  });

export type AiProviderConfigInput = z.infer<typeof aiProviderConfigCreateSchema>;
export type AiProviderConfigUpdateInput = z.infer<typeof aiProviderConfigUpdateSchema>;

export const chatThreadCreateSchema = z.object({
  title: z.string().trim().max(100, "Judul percakapan maksimal 100 karakter.").optional(),
  modelId: z.string().trim().max(150).optional().nullable(),
  isFavorite: z.boolean().optional(),
});

export type ChatThreadCreateInput = z.input<typeof chatThreadCreateSchema>;

export const chatThreadUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul percakapan tidak boleh kosong.")
    .max(100, "Judul percakapan maksimal 100 karakter.")
    .optional(),
  isFavorite: z.boolean().optional(),
  modelId: z.string().trim().max(150).optional().nullable(),
});

export type ChatThreadUpdateInput = z.infer<typeof chatThreadUpdateSchema>;

export const chatMessageCreateSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  parts: z.unknown().optional(),
  toolCalls: z.unknown().optional(),
  toolResults: z.unknown().optional(),
});

export type ChatMessageCreateInput = z.infer<typeof chatMessageCreateSchema>;

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "Data tidak valid.";
  return issue.message;
}
