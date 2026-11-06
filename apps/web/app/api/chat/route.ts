import { PROVIDER_MODELS } from "@cashow/domain";
import {
  type AiProviderDetail,
  createChatThread,
  createTransaction,
  createTransfer,
  getAiProviderConfig,
  getBudgetStatus,
  getDefaultAiProviderConfig,
  getSafeToSpend,
  getSummary,
  listAccounts,
  listAiProviderConfigs,
  listCategories,
  listPlans,
  listRecurring,
  listRecurringDrafts,
  listTransactions,
  nowOf,
  recordAiUsageLog,
  type SummaryPeriod,
  saveChatMessage,
  updateChatThread,
  userTimezone,
} from "@cashow/services";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isToolUIPart,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  validateUIMessages,
} from "ai";
import { z } from "zod";
import { buildLanguageModel } from "@/lib/ai-model";
import { buildChatSystemPrompt } from "@/lib/ai-system-prompt";
import { normalizeLocalDateTime, resolveByName } from "@/lib/ai-tools";
import { findLedgerSession } from "@/lib/ledger";

export const maxDuration = 60;

/** Bound the history so a long session cannot blow past provider context limits. */
const MAX_HISTORY_MESSAGES = 40;
/** Bound the payload sent per request; the textarea caps single messages lower. */
const MAX_TOTAL_TEXT_CHARS = 60_000;
/** Tool payloads only matter for the recent tail; older turns keep their text. */
const KEEP_TOOL_OUTPUT_MESSAGES = 8;
/** Tool responses are aggregates, not dumps: cap the rows the model reads. */
const MAX_ACCOUNT_ROWS = 20;
const MAX_BUDGET_ROWS = 15;

function totalTextChars(messages: unknown[]): number {
  let total = 0;
  for (const message of messages) {
    if (typeof message !== "object" || message === null) continue;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part !== "object" || part === null) continue;
      const { type, text, output } = part as {
        type?: unknown;
        text?: unknown;
        output?: unknown;
      };
      if (type === "text" && typeof text === "string") {
        total += text.length;
      } else if (output !== undefined) {
        // Tool payloads ride along in history too; counting them keeps the
        // context guard honest instead of measuring only the chat bubbles.
        total += safeJsonLength(output);
      }
    }
  }
  return total;
}

function safeJsonLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Keep tool payloads small: the model needs a hint, not the full essay. */
function clip(value: string | null | undefined, maxLength = 80): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") return null;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength).trim()}…`;
}

/** Tool-part states that are safe to replay to the provider. */
const REPLAYABLE_TOOL_STATES = new Set([
  "output-available",
  "output-error",
  "approval-responded",
  "output-denied",
]);

export async function GET() {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = { db: session.db, userId: session.user.id };
  const configsResult = await listAiProviderConfigs(ctx);
  const configs = configsResult.ok ? configsResult.value : [];

  const userModels: Array<{
    id: string;
    connectionId: string;
    connectionName: string;
    provider: string;
    model: string;
    name: string;
    label: string;
    isDefault: boolean;
    isSystem: boolean;
  }> = [];

  for (const c of configs) {
    const presets = PROVIDER_MODELS[c.provider] ?? [];
    const seenModelIds = new Set<string>();
    const isModelInPresets = presets.some((p) => p.id === c.model);

    // 1. Built-in preset models for this provider
    for (const preset of presets) {
      seenModelIds.add(preset.id);
      const isConnectionDefaultModel = c.model ? preset.id === c.model : seenModelIds.size === 1;
      userModels.push({
        id: `${c.id}::${preset.id}`,
        connectionId: c.id,
        connectionName: c.name,
        provider: c.provider,
        model: preset.id,
        name: `${preset.label} (${c.name})`,
        label: preset.label,
        isDefault: c.isDefault && isConnectionDefaultModel,
        isSystem: false,
      });
    }

    // 2. Custom models configured for this connection
    if (Array.isArray(c.customModels)) {
      for (const customModel of c.customModels) {
        const trimmed = customModel.trim();
        if (trimmed && !seenModelIds.has(trimmed)) {
          seenModelIds.add(trimmed);
          const isConnectionDefaultModel = !isModelInPresets && c.model === trimmed;
          userModels.push({
            id: `${c.id}::${trimmed}`,
            connectionId: c.id,
            connectionName: c.name,
            provider: c.provider,
            model: trimmed,
            name: `${trimmed} (${c.name})`,
            label: trimmed,
            isDefault: c.isDefault && isConnectionDefaultModel,
            isSystem: false,
          });
        }
      }
    }

    // 3. Fallback: if c.model is specified and not yet in the list (e.g. legacy configs)
    if (c.model && c.model.trim() !== "" && !seenModelIds.has(c.model.trim())) {
      const trimmed = c.model.trim();
      seenModelIds.add(trimmed);
      userModels.push({
        id: `${c.id}::${trimmed}`,
        connectionId: c.id,
        connectionName: c.name,
        provider: c.provider,
        model: trimmed,
        name: `${trimmed} (${c.name})`,
        label: trimmed,
        isDefault: c.isDefault,
        isSystem: false,
      });
    }
  }

  const defaultModel = userModels.find((m) => m.isDefault) ?? userModels[0] ?? null;

  return Response.json(
    {
      models: userModels,
      defaultId: defaultModel?.id ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = { db: session.db, userId: session.user.id };

  const body = (await request.json().catch(() => ({}))) as {
    messages?: unknown;
    message?: string;
    configId?: string;
    threadId?: string;
  };

  // Resolve user-registered AI model provider
  let selectedConfig: AiProviderDetail | null = null;
  let targetModelId: string | null = null;

  if (body.configId && !body.configId.startsWith("system-")) {
    let connectionId = body.configId;
    if (body.configId.includes("::")) {
      const [cId, mId] = body.configId.split("::");
      connectionId = cId;
      targetModelId = mId;
    }

    const configRes = await getAiProviderConfig(ctx, connectionId);
    if (configRes.ok && configRes.value) {
      selectedConfig = configRes.value;
      if (targetModelId) {
        selectedConfig.model = targetModelId;
      }
    }
  }

  if (!selectedConfig) {
    const defaultRes = await getDefaultAiProviderConfig(ctx);
    if (defaultRes.ok && defaultRes.value) {
      selectedConfig = defaultRes.value;
      if (targetModelId) {
        selectedConfig.model = targetModelId;
      }
    }
  }

  if (selectedConfig === null) {
    return new Response(
      "Model AI belum didaftarkan. Silakan daftarkan API key di Pengaturan > Model AI.",
      { status: 503 },
    );
  }

  // Ensure config has a valid active model
  if (!selectedConfig.model || selectedConfig.model.trim() === "") {
    const presets = PROVIDER_MODELS[selectedConfig.provider];
    if (presets && presets.length > 0 && presets[0]) {
      selectedConfig.model = presets[0].id;
    } else if (
      selectedConfig.customModels &&
      selectedConfig.customModels.length > 0 &&
      selectedConfig.customModels[0]
    ) {
      selectedConfig.model = selectedConfig.customModels[0];
    }
  }

  const model = buildLanguageModel(selectedConfig);

  let rawMessages: unknown[] = [];
  if (Array.isArray(body.messages)) {
    rawMessages = body.messages;
  } else if (typeof body.message === "string" && body.message.trim() !== "") {
    rawMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: body.message.trim() }],
      },
    ];
  }

  if (rawMessages.length === 0) {
    return new Response("Messages are required.", { status: 400 });
  }

  if (rawMessages.length > MAX_HISTORY_MESSAGES) {
    rawMessages = rawMessages.slice(-MAX_HISTORY_MESSAGES);
  }

  let validatedMessages: Awaited<ReturnType<typeof validateUIMessages>>;
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    validatedMessages = await validateUIMessages({ messages: rawMessages });
    // A stopped stream can leave a tool call without a result in the history.
    // Providers reject that history ("Tool result is missing"), which would
    // wedge the conversation forever, so drop only the unfinished calls while
    // keeping any text the assistant already produced.
    validatedMessages = validatedMessages
      .map((message) => {
        if (message.role !== "assistant") return message;
        const parts = message.parts.filter(
          (part) => !isToolUIPart(part) || REPLAYABLE_TOOL_STATES.has(part.state),
        );
        return { ...message, parts };
      })
      .filter((message) => message.parts.length > 0);

    // Old tool payloads are the largest source of wasted tokens: the model
    // already summarised them in its answer, yet the raw JSON would be resent
    // on every step. Keep them only for the recent tail.
    const toolCutoff = validatedMessages.length - KEEP_TOOL_OUTPUT_MESSAGES;
    validatedMessages = validatedMessages
      .map((message, index) => {
        if (index >= toolCutoff || !message.parts.some(isToolUIPart)) return message;
        const parts = message.parts.filter((part) => !isToolUIPart(part));
        return { ...message, parts };
      })
      .filter((message) => message.parts.length > 0);

    if (totalTextChars(validatedMessages) > MAX_TOTAL_TEXT_CHARS) {
      return new Response(
        "Percakapan terlalu panjang. Mulai percakapan baru atau ringkas pesan Anda.",
        { status: 413 },
      );
    }

    modelMessages = await convertToModelMessages(validatedMessages);
  } catch {
    return new Response("Format pesan tidak valid.", { status: 400 });
  }

  // Resolve or create chat thread for persistence
  let threadId = body.threadId && body.threadId.trim() !== "" ? body.threadId.trim() : null;
  if (!threadId) {
    const threadRes = await createChatThread(ctx, {
      modelId: body.configId,
    });
    if (threadRes.ok) {
      threadId = threadRes.value.id;
    }
  } else if (body.configId) {
    // Update active model bound to this thread
    await updateChatThread(ctx, threadId, { modelId: body.configId });
  }

  // Persist the new user turn before streaming. An approval resume sends the
  // same history without a new user message, so only save when the last
  // message is actually from the user (otherwise it would duplicate the turn).
  const lastMessage = validatedMessages[validatedMessages.length - 1];
  if (threadId && lastMessage?.role === "user") {
    const userText = lastMessage.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("");
    await saveChatMessage(ctx, threadId, {
      role: "user",
      content: userText,
      parts: lastMessage.parts,
    });
  }

  const tools = {
    getAccountBalances: tool({
      description: "Saldo semua akun aktif (rupiah).",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await listAccounts(ctx);
        if (!result.ok) return { error: result.error.message };
        const active = result.value.filter((a) => a.archivedAt === null);
        return {
          total: active.length,
          accounts: active.slice(0, MAX_ACCOUNT_ROWS).map((a) => ({
            name: a.name,
            type: a.type,
            balance: a.balance.toString(),
          })),
        };
      },
    }),

    getSpendingSummary: tool({
      description:
        "Ringkasan pemasukan, pengeluaran, net, kategori pengeluaran teratas, merchant teratas, dan periode sebelumnya.",
      inputSchema: z.object({
        period: z
          .enum(["today", "week", "month", "budgetMonth", "last7", "last30", "custom"])
          .default("month"),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Wajib jika period=custom."),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Wajib jika period=custom."),
      }),
      execute: async ({
        period,
        from,
        to,
      }: {
        period: SummaryPeriod;
        from?: string;
        to?: string;
      }) => {
        if (period === "custom" && (!from || !to)) {
          return { error: "Period custom membutuhkan from dan to (YYYY-MM-DD)." };
        }
        const result = await getSummary(
          ctx,
          period === "custom" ? { period: "custom", from, to } : { period },
        );
        if (!result.ok) return { error: result.error.message };
        const value = result.value;
        return {
          period,
          range: `${value.range.from}..${value.range.to}`,
          income: value.income.toString(),
          expense: value.expense.toString(),
          net: value.net.toString(),
          count: value.transactionCount,
          topExpenseCategories: value.byCategory
            .slice(0, 6)
            .map((c) => ({ name: c.name, total: c.total.toString() })),
          topMerchants: value.topMerchants
            .slice(0, 5)
            .map((m) => ({ name: m.merchant, total: m.total.toString() })),
          previous: value.previous
            ? {
                income: value.previous.income.toString(),
                expense: value.previous.expense.toString(),
                net: value.previous.net.toString(),
              }
            : null,
        };
      },
    }),

    listCategories: tool({
      description:
        "Daftar kategori pengguna (nama, jenis, induk) untuk memilih atau mencocokkan kategori.",
      inputSchema: z.object({
        kind: z.enum(["INCOME", "EXPENSE"]).optional(),
      }),
      execute: async ({ kind }: { kind?: "INCOME" | "EXPENSE" }) => {
        const result = await listCategories(ctx);
        if (!result.ok) return { error: result.error.message };
        const nameById = new Map(result.value.map((c) => [c.id, c.name]));
        const live = result.value.filter(
          (c) => c.archivedAt === null && (kind === undefined || c.kind === kind),
        );
        return {
          total: live.length,
          categories: live.slice(0, 40).map((c) => ({
            name: c.name,
            kind: c.kind,
            parent: c.parentId === null ? null : (nameById.get(c.parentId) ?? "—"),
          })),
        };
      },
    }),

    getPendingRecurringDrafts: tool({
      description: "Tagihan/transaksi berulang yang menunggu konfirmasi pengguna.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await listRecurringDrafts(ctx);
        if (!result.ok) return { error: result.error.message };
        return {
          total: result.value.length,
          drafts: result.value.slice(0, 10).map((d) => ({
            type: d.templateType,
            runAt: d.runAt,
            amount: d.amount.toString(),
            account: d.accountName,
            category: d.categoryName,
            note: clip(d.note),
          })),
        };
      },
    }),

    getBudgetStatus: tool({
      description: "Setiap anggaran: nama, batas, terpakai, persentase, proyeksi akhir bulan.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await getBudgetStatus(ctx);
        if (!result.ok) return { error: result.error.message };
        return {
          total: result.value.length,
          budgets: result.value.slice(0, MAX_BUDGET_ROWS).map((b) => ({
            name: b.budget.name,
            category: b.budget.categoryName,
            limit: b.budget.amount.toString(),
            spent: b.spent.toString(),
            pct: Math.round(b.usedPercent),
            projected: b.projected.toString(),
          })),
        };
      },
    }),

    getSafeToSpend: tool({
      description: "Berapa rupiah aman dibelanjakan per hari sampai akhir bulan anggaran.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await getSafeToSpend(ctx);
        if (!result.ok) return { error: result.error.message };
        return {
          daily: result.value.daily.toString(),
          daysLeft: result.value.daysLeft,
          available: result.value.available.toString(),
          upcoming: result.value.upcoming.toString(),
        };
      },
    }),

    searchTransactions: tool({
      description: "Cari transaksi berdasarkan kata kunci (maks 10).",
      inputSchema: z.object({
        query: z.string().min(1).describe("Kata kunci pencarian."),
        limit: z.number().int().min(1).max(10).default(8),
      }),
      execute: async ({ query, limit }: { query: string; limit: number }) => {
        const result = await listTransactions(ctx, {
          search: query,
          limit,
          offset: 0,
          includeDeleted: false,
        });
        if (!result.ok) return { error: result.error.message };
        return result.value.items.map((t) => ({
          date: t.occurredOn,
          type: t.type,
          amount: t.amount.toString(),
          account: t.accountName,
          category: t.categoryName,
          note: clip(t.note ?? t.merchant ?? t.counterparty),
        }));
      },
    }),

    getRecentTransactions: tool({
      description: "Transaksi terbaru (maks 8), opsional filter jenis.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(8).default(6),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
      }),
      execute: async ({
        limit,
        type,
      }: {
        limit: number;
        type?: "INCOME" | "EXPENSE" | "TRANSFER";
      }) => {
        const result = await listTransactions(ctx, {
          type,
          limit,
          offset: 0,
          includeDeleted: false,
        });
        if (!result.ok) return { error: result.error.message };
        return result.value.items.map((t) => ({
          date: t.occurredOn,
          type: t.type,
          amount: t.amount.toString(),
          account: t.accountName,
          category: t.categoryName,
          note: clip(t.note ?? t.merchant ?? t.counterparty),
        }));
      },
    }),

    getPlans: tool({
      description: "Rencana pembayaran aktif: nama, diharapkan, diterima, sisa, progres.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await listPlans(ctx, { includeArchived: false });
        if (!result.ok) return { error: result.error.message };
        return result.value.slice(0, 10).map((p) => ({
          name: p.name,
          expected: p.expectedTotal.toString(),
          received: p.receivedTotal.toString(),
          outstanding: p.outstanding.toString(),
          progress: p.progress,
          status: p.status,
        }));
      },
    }),

    getRecurringTemplates: tool({
      description: "Template transaksi berulang aktif.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await listRecurring(ctx);
        if (!result.ok) return { error: result.error.message };
        return result.value
          .filter((r) => r.active)
          .slice(0, 10)
          .map((r) => ({
            type: r.type,
            amount: r.amount.toString(),
            frequency: r.frequency,
            account: r.accountName,
            category: r.categoryName,
            note: clip(r.note),
          }));
      },
    }),

    createTransaction: tool({
      description:
        "Catat pemasukan/pengeluaran. Butuh persetujuan pengguna. Panggil bila jenis, nominal, dan akun sudah jelas.",
      inputSchema: z.object({
        type: z.enum(["INCOME", "EXPENSE"]),
        amount: z.coerce.string().min(1).describe("Nominal rupiah, mis. 25000 atau 25rb."),
        accountName: z
          .string()
          .nullish()
          .describe("Nama akun persis dari tool saldo; boleh kosong bila hanya ada satu akun."),
        categoryName: z.string().nullish().describe("Nama kategori yang sesuai jenis transaksi."),
        occurredAtLocal: z
          .string()
          .nullish()
          .describe("YYYY-MM-DD atau YYYY-MM-DDTHH:mm; kosongkan untuk sekarang."),
        merchant: z.string().nullish(),
        note: z.string().nullish(),
      }),
      execute: async (input, { toolCallId }) => {
        const accounts = await listAccounts(ctx);
        if (!accounts.ok) return { error: accounts.error.message };
        const active = accounts.value.filter((a) => a.archivedAt === null);
        if (active.length === 0) return { error: "Belum ada akun aktif." };

        let account: { id: string; name: string };
        if (input.accountName && input.accountName.trim() !== "") {
          const resolved = resolveByName(active, input.accountName, "akun");
          if (!resolved.ok) return { error: resolved.error };
          account = resolved.value;
        } else if (active.length === 1 && active[0]) {
          account = active[0];
        } else {
          return {
            error: `Sebutkan nama akun: ${active
              .slice(0, 8)
              .map((a) => a.name)
              .join(", ")}.`,
          };
        }

        let categoryId: string | null = null;
        if (input.categoryName && input.categoryName.trim() !== "") {
          const categories = await listCategories(ctx);
          if (!categories.ok) return { error: categories.error.message };
          const matching = categories.value.filter(
            (c) => c.archivedAt === null && c.kind === input.type,
          );
          const resolved = resolveByName(matching, input.categoryName, "kategori");
          if (!resolved.ok) return { error: resolved.error };
          categoryId = resolved.value.id;
        }

        const timezone = await userTimezone(ctx.db, ctx.userId);
        const result = await createTransaction(ctx, {
          type: input.type,
          amount: input.amount,
          accountId: account.id,
          categoryId,
          occurredAtLocal: normalizeLocalDateTime(input.occurredAtLocal, timezone, nowOf(ctx)),
          merchant: input.merchant ?? null,
          note: input.note ?? null,
          clientRequestId: `chat-${toolCallId}`,
        });
        if (!result.ok) return { error: result.error.message };
        const created = result.value;
        return {
          status: "created",
          type: created.type,
          amount: created.amount.toString(),
          account: created.accountName,
          category: created.categoryName,
          date: created.occurredOn,
          note: clip(created.note ?? created.merchant),
        };
      },
    }),

    createBatchTransactions: tool({
      description:
        "Catat banyak transaksi sekaligus (batch). Gunakan ini saat pengguna memberikan daftar beberapa transaksi atau catatan harian. Butuh persetujuan pengguna.",
      inputSchema: z.object({
        accountName: z
          .string()
          .nullish()
          .describe(
            "Nama akun pembayaran default persis dari tool saldo; boleh kosong jika tiap item punya akun atau hanya ada 1 akun aktif.",
          ),
        transactions: z
          .array(
            z.object({
              type: z
                .enum(["INCOME", "EXPENSE"])
                .describe("Jenis: INCOME (pemasukan) atau EXPENSE (pengeluaran)."),
              amount: z.coerce
                .string()
                .min(1)
                .describe("Nominal rupiah bulat, mis. 53000, 123000."),
              accountName: z
                .string()
                .nullish()
                .describe("Nama akun spesifik jika berbeda dari akun default."),
              categoryName: z.string().nullish().describe("Nama kategori transaksi yang relevan."),
              occurredAtLocal: z
                .string()
                .describe("Tanggal transaksi YYYY-MM-DD atau YYYY-MM-DDTHH:mm."),
              merchant: z.string().nullish(),
              note: z
                .string()
                .nullish()
                .describe("Keterangan transaksi, mis. bensin, clandys, dll."),
            }),
          )
          .min(1)
          .max(50)
          .describe("Daftar transaksi yang akan dicatat."),
      }),
      execute: async (input, { toolCallId }) => {
        const accounts = await listAccounts(ctx);
        if (!accounts.ok) return { error: accounts.error.message };
        const active = accounts.value.filter((a) => a.archivedAt === null);
        if (active.length === 0) return { error: "Belum ada akun aktif." };

        let defaultAccount: { id: string; name: string } | null = null;
        if (input.accountName && input.accountName.trim() !== "") {
          const resolved = resolveByName(active, input.accountName, "akun");
          if (!resolved.ok) return { error: resolved.error };
          defaultAccount = resolved.value;
        } else if (active.length === 1 && active[0]) {
          defaultAccount = active[0];
        }

        const categories = await listCategories(ctx);
        const allCategories = categories.ok ? categories.value : [];
        const timezone = await userTimezone(ctx.db, ctx.userId);

        interface ResolvedItem {
          index: number;
          type: "INCOME" | "EXPENSE";
          amount: string;
          account: { id: string; name: string };
          categoryId: string | null;
          occurredAtLocal: string;
          merchant: string | null;
          note: string | null;
        }

        const resolvedItems: ResolvedItem[] = [];
        const issues: string[] = [];
        const warnings: string[] = [];

        // Resolve every account and category before writing anything: a partial
        // batch is worse than a question, and a missing account must not guess.
        for (let i = 0; i < input.transactions.length; i++) {
          const item = input.transactions[i];
          if (!item) continue;

          const label = `Item ${i + 1} (${item.note ?? item.merchant ?? item.amount})`;

          let itemAccount = defaultAccount;
          if (item.accountName && item.accountName.trim() !== "") {
            const resolved = resolveByName(active, item.accountName, "akun");
            if (!resolved.ok) {
              issues.push(`${label}: ${resolved.error}`);
              continue;
            }
            itemAccount = resolved.value;
          }

          if (!itemAccount) {
            issues.push(`${label}: akun belum jelas.`);
            continue;
          }

          let categoryId: string | null = null;
          if (item.categoryName && item.categoryName.trim() !== "") {
            const matching = allCategories.filter(
              (c) => c.archivedAt === null && c.kind === item.type,
            );
            const resolved = resolveByName(matching, item.categoryName, "kategori");
            if (resolved.ok) {
              categoryId = resolved.value.id;
            } else {
              warnings.push(`${label}: ${resolved.error} Transaksi tetap dicatat tanpa kategori.`);
            }
          }

          resolvedItems.push({
            index: i,
            type: item.type,
            amount: item.amount,
            account: itemAccount,
            categoryId,
            occurredAtLocal: item.occurredAtLocal,
            merchant: item.merchant ?? null,
            note: item.note ?? null,
          });
        }

        if (issues.length > 0) {
          const accountHint =
            active.length > 1
              ? ` Akun aktif: ${active
                  .slice(0, 8)
                  .map((a) => a.name)
                  .join(", ")}.`
              : "";
          return {
            error: `Data belum lengkap, belum ada transaksi yang dicatat. ${issues.join(
              " ",
            )}${accountHint} Tanyakan kekurangan ini ke pengguna, lalu panggil ulang tool.`,
          };
        }

        const createdItems: Array<{
          type: string;
          amount: string;
          account: string;
          category: string | null;
          date: string;
          note: string | null;
        }> = [];

        const errors: string[] = [];

        for (const item of resolvedItems) {
          const result = await createTransaction(ctx, {
            type: item.type,
            amount: item.amount,
            accountId: item.account.id,
            categoryId: item.categoryId,
            occurredAtLocal: normalizeLocalDateTime(item.occurredAtLocal, timezone, nowOf(ctx)),
            merchant: item.merchant,
            note: item.note,
            clientRequestId: `chat-${toolCallId}-${item.index}`,
          });

          if (!result.ok) {
            errors.push(
              `Item ${item.index + 1} (${item.note ?? item.amount}): ${result.error.message}`,
            );
          } else {
            createdItems.push({
              type: result.value.type,
              amount: result.value.amount.toString(),
              account: result.value.accountName,
              category: result.value.categoryName,
              date: result.value.occurredOn,
              note: clip(result.value.note ?? result.value.merchant),
            });
          }
        }

        if (createdItems.length === 0 && errors.length > 0) {
          return { error: `Gagal mencatat transaksi: ${errors.join("; ")}` };
        }

        const totalAmount = createdItems.reduce((sum, item) => sum + BigInt(item.amount), 0n);
        const allWarnings = [...warnings, ...errors];

        return {
          status: "created",
          totalCreated: createdItems.length,
          totalAmount: totalAmount.toString(),
          items: createdItems,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        };
      },
    }),

    createTransfer: tool({
      description: "Catat transfer antar akun milik pengguna. Butuh persetujuan pengguna.",
      inputSchema: z.object({
        amount: z.coerce.string().min(1).describe("Nominal rupiah, mis. 500000."),
        fromAccountName: z.string().describe("Nama akun asal persis dari tool saldo."),
        toAccountName: z.string().describe("Nama akun tujuan persis dari tool saldo."),
        feeAmount: z.coerce.string().nullish().describe("Biaya transfer; kosongkan bila nol."),
        occurredAtLocal: z
          .string()
          .nullish()
          .describe("YYYY-MM-DD atau YYYY-MM-DDTHH:mm; kosongkan untuk sekarang."),
        note: z.string().nullish(),
      }),
      execute: async (input, { toolCallId }) => {
        const accounts = await listAccounts(ctx);
        if (!accounts.ok) return { error: accounts.error.message };
        const active = accounts.value.filter((a) => a.archivedAt === null);

        const from = resolveByName(active, input.fromAccountName, "akun asal");
        if (!from.ok) return { error: from.error };
        const to = resolveByName(active, input.toAccountName, "akun tujuan");
        if (!to.ok) return { error: to.error };
        if (from.value.id === to.value.id) {
          return { error: "Akun asal dan tujuan harus berbeda." };
        }

        const timezone = await userTimezone(ctx.db, ctx.userId);
        const result = await createTransfer(ctx, {
          amount: input.amount,
          accountId: from.value.id,
          destinationAccountId: to.value.id,
          feeAmount: input.feeAmount ?? "0",
          feeCategoryId: null,
          note: input.note ?? null,
          occurredAtLocal: normalizeLocalDateTime(input.occurredAtLocal, timezone, nowOf(ctx)),
          clientRequestId: `chat-${toolCallId}`,
        });
        if (!result.ok) return { error: result.error.message };
        const created = result.value;
        return {
          status: "created",
          amount: created.amount.toString(),
          from: created.accountName,
          to: created.destinationAccountName,
          fee: input.feeAmount ?? "0",
          date: created.occurredOn,
          note: clip(created.note),
        };
      },
    }),
  };

  const result = streamText({
    model,
    system: buildChatSystemPrompt({
      userName: session.user.name,
      timezone: session.user.timezone,
      currency: session.user.currency,
    }),
    messages: modelMessages,
    tools,
    // Money-moving tools never execute straight from the model: the UI asks
    // the owner first, then replays the signed approval on the next step.
    toolApproval: {
      createTransaction: "user-approval",
      createBatchTransactions: "user-approval",
      createTransfer: "user-approval",
    },
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET ?? process.env.AUTH_SECRET,
    stopWhen: stepCountIs(4),
    maxOutputTokens: 1536,
    temperature: 0.2,
    maxRetries: 1,
    onFinish: async (event) => {
      if (selectedConfig && event.usage) {
        try {
          await recordAiUsageLog(ctx, {
            providerConfigId: selectedConfig.id,
            modelId: selectedConfig.model,
            threadId: capturedThreadId ?? null,
            inputTokens: event.usage.inputTokens ?? 0,
            outputTokens: event.usage.outputTokens ?? 0,
            totalTokens: event.usage.totalTokens ?? 0,
          });
        } catch (err) {
          console.error("[api/chat] Failed to record AI token usage:", err);
        }
      }
    },
  });

  const capturedThreadId = threadId;
  // A resumed approval continues the assistant turn over a new request; its
  // result replaces the stored "waiting for approval" row instead of adding a
  // second bubble on reload.
  const lastIncoming = validatedMessages[validatedMessages.length - 1];
  const isApprovalResume =
    lastIncoming?.role === "assistant" &&
    lastIncoming.parts.some((part) => isToolUIPart(part) && part.state === "approval-responded");

  // Intercept stream errors so they are emitted as UI error parts instead of
  // terminating the underlying HTTP stream abruptly (which leaves useChat hanging
  // in status="submitted"/"streaming").
  type StreamPart =
    Parameters<typeof toUIMessageStream<typeof tools>>[0]["stream"] extends ReadableStream<infer P>
      ? P
      : never;

  const safeStream = new ReadableStream<StreamPart>({
    async start(controller) {
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        controller.enqueue({ type: "error", error } as unknown as StreamPart);
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  const uiStream = toUIMessageStream({
    stream: safeStream,
    originalMessages: validatedMessages,
    onEnd: async ({ responseMessage }) => {
      if (!capturedThreadId || !responseMessage) return;
      const assistantText = responseMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text?: string }).text ?? "")
        .join("");
      try {
        await saveChatMessage(
          ctx,
          capturedThreadId,
          {
            role: "assistant",
            content: assistantText,
            parts: responseMessage.parts,
          },
          { replaceLastAssistant: isApprovalResume },
        );
      } catch (err) {
        console.error("[api/chat] Failed to persist assistant message:", err);
      }
    },
    onError: (error) => {
      // Keep provider details (keys, upstream URLs) out of the browser while
      // still leaving a trail for the operator and giving actionable diagnostics.
      console.error("[api/chat] stream error", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("429") ||
        msg.toLowerCase().includes("quota") ||
        msg.toLowerCase().includes("resource_exhausted")
      ) {
        return "Batas penggunaan / kuota model AI tercapai (429 Quota Exceeded). Coba beralih ke model Gemini 3.5 Flash / Gemini 3.5 Flash Lite atau tunggu beberapa saat.";
      }
      if (msg.includes("404") || msg.toLowerCase().includes("not_found")) {
        return "Model AI tidak ditemukan atau sudah tidak tersedia. Silakan pilih model lain di Pengaturan > Model AI.";
      }
      if (msg.toLowerCase().includes("key") || msg.includes("401") || msg.includes("403")) {
        return "Kunci API (API Key) tidak valid atau otorisasi ditolak. Periksa API key Anda di Pengaturan > Model AI.";
      }
      return "Terjadi kesalahan saat menghubungi model AI. Periksa API key atau kuota Anda di Pengaturan > Model AI.";
    },
  });

  return createUIMessageStreamResponse({
    stream: uiStream,
    headers: capturedThreadId
      ? {
          "X-Chat-Thread-Id": capturedThreadId,
        }
      : undefined,
  });
}
