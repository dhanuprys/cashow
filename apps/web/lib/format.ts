import { parseDbTimestamp, toLocalDate, toLocalDateTimeInput } from "@cashow/domain";

const dateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone, dateStyle: "medium" });

const dateTimeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone, dateStyle: "medium", timeStyle: "short" });

/** Local date (`27 Okt 2026`) for a database timestamp or ISO instant. */
export function displayDate(instant: string | Date, timeZone: string): string {
  const date = instant instanceof Date ? instant : parseDbTimestamp(instant);
  return dateFormatter(timeZone).format(date);
}

/**
 * A stored calendar date (`occurredOn`, `YYYY-MM-DD`) rendered as a label.
 * Formatted in UTC so the date itself never shifts with the reader's zone.
 */
export function displayLocalDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

/** Local date and time (`27 Okt 2026, 08.30`) in the owner's timezone. */
export function displayDateTime(instant: string | Date, timeZone: string): string {
  const date = instant instanceof Date ? instant : parseDbTimestamp(instant);
  return dateTimeFormatter(timeZone).format(date);
}

/** The `YYYY-MM` key for the month containing `now` in the owner's timezone. */
export function currentMonthKey(now: Date, timeZone: string): string {
  return toLocalDate(now, timeZone).slice(0, 7);
}

/** The `YYYY-MM` key for the month before `month`. */
export function previousMonthKey(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const index = Number(monthText);
  return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, "0")}`;
}

/** `Oktober 2026` for a `YYYY-MM` key. */
export function monthLabel(month: string): string {
  const [yearText, monthText] = month.split("-");
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1)),
  );
}

/** `1,2 MB` / `480 KB` for an attachment size. */
export function formatBytes(bytes: number | bigint): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 104857.6) / 10} MB`;
}

/** A default `datetime-local` value for a new transaction. */
export function nowLocalInput(now: Date, timeZone: string): string {
  return toLocalDateTimeInput(now, timeZone);
}

/** `YYYY-MM-DD` for the first and last day of a month key. */
export function monthRange(month: string): { from: string; to: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const index = Number(monthText);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BANK: "Bank",
  EWALLET: "E-wallet",
  CASH: "Tunai",
  INVESTMENT: "Investasi",
};

export const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Penyesuaian",
};

export const ATTACHMENT_KIND_LABEL: Record<string, string> = {
  PROOF: "Bukti",
  INVOICE: "Faktur",
  CONTRACT: "Kontrak",
  RECEIPT: "Struk",
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Berjalan",
  COMPLETED: "Lunas",
  OVERDUE: "Terlambat",
};

export const PLAN_ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Belum dibayar",
  PARTIAL: "Sebagian",
  RECEIVED: "Diterima",
  OVER_RECEIVED: "Lebih bayar",
  OVERDUE: "Terlambat",
};

export const GAP_KIND_LABEL: Record<string, string> = {
  BALANCED: "Seimbang",
  UNLOGGED_SPENDING: "Pengeluaran belum tercatat",
  UNLOGGED_INCOME: "Pemasukan belum tercatat",
};
