import { formatMoney } from "@cashow/domain";

export const RULE_METRICS: Record<
  string,
  { label: string; unit: "money" | "count" | "hours"; description: string }
> = {
  expenseToday: {
    label: "Pengeluaran Hari Ini",
    unit: "money",
    description: "Total akumulasi pengeluaran pada tanggal hari ini",
  },
  expenseMonth: {
    label: "Pengeluaran Bulan Ini",
    unit: "money",
    description: "Total akumulasi pengeluaran di bulan berjalan",
  },
  incomeMonth: {
    label: "Pemasukan Bulan Ini",
    unit: "money",
    description: "Total akumulasi pemasukan di bulan berjalan",
  },
  totalBalance: {
    label: "Total Saldo Semua Akun",
    unit: "money",
    description: "Jumlah saldo saat ini di seluruh dompet dan rekening aktif",
  },
  overduePlanCount: {
    label: "Tahap Rencana Terlambat",
    unit: "count",
    description: "Jumlah tagihan atau pemasukan rencana yang melewati jatuh tempo",
  },
  backupAgeHours: {
    label: "Usia Backup Database (Jam)",
    unit: "hours",
    description: "Jumlah jam sejak backup database terakhir kali dibuat",
  },
  drillAgeHours: {
    label: "Usia Simulasi Drill Pulih (Jam)",
    unit: "hours",
    description: "Jumlah jam sejak verifikasi restore drill terakhir",
  },
};

export const RULE_SEVERITY: Record<string, { label: string; color: string; description: string }> =
  {
    INFO: {
      label: "Info",
      color: "bg-blue-500/10 text-blue-600 border-blue-200",
      description: "Notifikasi standar untuk informasi berkala",
    },
    WARNING: {
      label: "Peringatan",
      color: "bg-amber-500/10 text-amber-600 border-amber-200",
      description: "Peringatan penting yang memerlukan perhatian",
    },
    ALERT: {
      label: "Bahaya",
      color: "bg-red-500/10 text-red-600 border-red-200",
      description: "Peringatan kritis seperti saldo minim atau overbudget",
    },
  };

export const RULE_OPS: Record<string, { label: string; symbol: string }> = {
  gt: { label: "Lebih dari", symbol: ">" },
  gte: { label: "Lebih dari atau sama dengan", symbol: "≥" },
  lt: { label: "Kurang dari", symbol: "<" },
  lte: { label: "Kurang dari atau sama dengan", symbol: "≤" },
  eq: { label: "Sama dengan", symbol: "=" },
  ne: { label: "Tidak sama dengan", symbol: "≠" },
};

export const RULE_TRIGGERS: Record<string, { label: string; description: string }> = {
  transaction: {
    label: "Setiap transaksi dicatat",
    description: "Diperiksa otomatis saat ada pengeluaran, pemasukan, atau transfer baru",
  },
  schedule: {
    label: "Pemeriksaan berkala (Jadwal)",
    description: "Diperiksa secara rutin setiap tick background worker",
  },
};

/**
 * Turns condition JSON into human-readable Indonesian text.
 */
export function describeRuleCondition(condition: unknown): string {
  if (!condition || typeof condition !== "object") return "Kondisi tidak diketahui";

  const cond = condition as Record<string, unknown>;

  if ("all" in cond && Array.isArray(cond.all)) {
    return cond.all.map(describeRuleCondition).join(" DAN ");
  }

  if ("any" in cond && Array.isArray(cond.any)) {
    return cond.any.map(describeRuleCondition).join(" ATAU ");
  }

  if ("not" in cond) {
    return `BUKAN (${describeRuleCondition(cond.not)})`;
  }

  if (typeof cond.metric === "string" && typeof cond.op === "string") {
    const metricInfo = RULE_METRICS[cond.metric];
    const metricLabel = metricInfo?.label ?? cond.metric;
    const opInfo = RULE_OPS[cond.op];
    const opSymbol = opInfo?.symbol ?? cond.op;

    let valueText = "";
    if (typeof cond.value === "number" || typeof cond.value === "bigint") {
      if (metricInfo?.unit === "money") {
        valueText = formatMoney(BigInt(cond.value));
      } else if (metricInfo?.unit === "hours") {
        valueText = `${cond.value} jam`;
      } else {
        valueText = String(cond.value);
      }
    } else if (typeof cond.value === "object" && cond.value !== null) {
      const valObj = cond.value as Record<string, unknown>;
      if ("percentOf" in valObj) {
        const percent = valObj.percent ?? 100;
        const target = RULE_METRICS[String(valObj.percentOf)]?.label ?? valObj.percentOf;
        valueText = `${percent}% dari ${target}`;
      } else if ("metric" in valObj) {
        valueText = RULE_METRICS[String(valObj.metric)]?.label ?? String(valObj.metric);
      } else {
        valueText = JSON.stringify(cond.value);
      }
    } else {
      valueText = String(cond.value ?? "");
    }

    return `${metricLabel} ${opSymbol} ${valueText}`;
  }

  return JSON.stringify(condition);
}

export function describeRuleTrigger(trigger: unknown): string {
  if (!trigger || typeof trigger !== "object") return "Pemicu kustom";
  const t = trigger as { type?: string };
  if (t.type && RULE_TRIGGERS[t.type]) {
    return RULE_TRIGGERS[t.type].label;
  }
  return t.type ?? "Pemicu umum";
}
