import { getToolName, isToolUIPart, type UIMessage } from "ai";

export interface SourceLink {
  key: string;
  label: string;
  href: string;
}

export interface FollowUpSuggestion {
  key: string;
  label: string;
  prompt: string;
}

/**
 * Mapping from tool names to the ledger route where the user can verify or view
 * the raw underlying records.
 */
const TOOL_SOURCES: Record<string, { label: string; href: string }> = {
  getAccountBalances: { label: "Rekening", href: "/app/accounts" },
  getSpendingSummary: { label: "Arus Kas", href: "/app" },
  getBudgetStatus: { label: "Anggaran", href: "/app/budgets" },
  getSafeToSpend: { label: "Buku Kas", href: "/app" },
  searchTransactions: { label: "Daftar Transaksi", href: "/app/transactions" },
  getRecentTransactions: { label: "Daftar Transaksi", href: "/app/transactions" },
  getPlans: { label: "Rencana Pembayaran", href: "/app/plans" },
  getRecurringTemplates: { label: "Transaksi Berulang", href: "/app/recurring" },
  getPendingRecurringDrafts: { label: "Transaksi Berulang", href: "/app/recurring" },
  listCategories: { label: "Kategori", href: "/app/categories" },
  createTransaction: { label: "Buku Kas", href: "/app/transactions" },
  createBatchTransactions: { label: "Buku Kas", href: "/app/transactions" },
  createTransfer: { label: "Daftar Rekening", href: "/app/accounts" },
};

/**
 * Extract distinct source links from all tools invoked in an assistant message.
 */
export function getMessageSourceLinks(message: UIMessage): SourceLink[] {
  if (message.role !== "assistant") return [];

  const seen = new Set<string>();
  const sources: SourceLink[] = [];

  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;
    const name = getToolName(part);
    const target = TOOL_SOURCES[name];
    if (!target) continue;

    if (!seen.has(target.href)) {
      seen.add(target.href);
      sources.push({
        key: `${name}-${target.href}`,
        label: target.label,
        href: target.href,
      });
    }
  }

  return sources;
}

/**
 * Contextual follow-up suggestions derived purely from the latest tools called
 * and the user's intent. Zero extra LLM roundtrips.
 */
export function getFollowUpSuggestions(messages: UIMessage[]): FollowUpSuggestion[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return [];

  const toolNames = new Set(lastAssistant.parts.filter(isToolUIPart).map((p) => getToolName(p)));

  const suggestions: FollowUpSuggestion[] = [];

  if (toolNames.has("createTransaction") || toolNames.has("createBatchTransactions")) {
    suggestions.push(
      {
        key: "post-tx-balance",
        label: "Cek saldo terbaru",
        prompt: "Berapa total saldo saya setelah transaksi ini?",
      },
      {
        key: "post-tx-budget",
        label: "Cek sisa anggaran",
        prompt: "Bagaimana status sisa anggaran saya bulan ini?",
      },
    );
    return suggestions;
  }

  if (toolNames.has("createTransfer")) {
    suggestions.push(
      {
        key: "post-tf-balance",
        label: "Cek saldo rekening",
        prompt: "Berapa saldo akun asal dan tujuan saat ini?",
      },
      {
        key: "post-tf-safe",
        label: "Batas belanja harian",
        prompt: "Berapa batas aman belanja harian (Safe-to-Spend) hari ini?",
      },
    );
    return suggestions;
  }

  if (toolNames.has("getSpendingSummary")) {
    suggestions.push(
      {
        key: "summary-safe",
        label: "Batas aman belanja",
        prompt: "Berapa batas uang bebas yang aman saya belanjakan per hari?",
      },
      {
        key: "summary-biggest",
        label: "Transaksi terbesar",
        prompt: "Tampilkan transaksi pengeluaran terbesar saya bulan ini.",
      },
    );
    return suggestions;
  }

  if (toolNames.has("getBudgetStatus")) {
    suggestions.push(
      {
        key: "budget-safe",
        label: "Batas aman hari ini",
        prompt: "Berapa batas aman belanja harian (Safe-to-Spend) saya?",
      },
      {
        key: "budget-history",
        label: "Evaluasi pengeluaran",
        prompt: "Kategori mana yang paling boros atau mendekati limit?",
      },
    );
    return suggestions;
  }

  if (toolNames.has("getAccountBalances")) {
    suggestions.push(
      {
        key: "balance-safe",
        label: "Batas aman belanja",
        prompt: "Berapa batas aman uang bebas (Safe-to-Spend) yang bisa saya gunakan hari ini?",
      },
      {
        key: "balance-spending",
        label: "Ringkasan bulan ini",
        prompt: "Bagaimana ringkasan pemasukan dan pengeluaran saya bulan ini?",
      },
    );
    return suggestions;
  }

  if (toolNames.has("getSafeToSpend")) {
    suggestions.push(
      {
        key: "safe-budgets",
        label: "Cek status anggaran",
        prompt: "Bagaimana rincian anggaran per kategori bulan ini?",
      },
      {
        key: "safe-recent",
        label: "Mutasi terbaru",
        prompt: "Tampilkan 5 transaksi pengeluaran terakhir saya.",
      },
    );
    return suggestions;
  }

  if (toolNames.has("getPendingRecurringDrafts") || toolNames.has("getRecurringTemplates")) {
    suggestions.push({
      key: "recurring-balances",
      label: "Cukupkah saldo rekening?",
      prompt: "Berapa saldo di rekening pembayaran saya saat ini?",
    });
    return suggestions;
  }

  return suggestions;
}
