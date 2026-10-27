import { type Money, subMoneyNonNegative } from "./money.js";

/** A calendar date in the user's timezone, stored as `YYYY-MM-DD`. */
export type LocalDate = string;

/**
 * The two clocks of the ledger: `occurredAt` is the editable, report-driving
 * instant; `occurredOn` is the stored calendar date in the user's timezone at
 * write time. This helper derives the latter from the former so day/week/month
 * grouping uses a stable, indexed date column.
 */
export function toLocalDate(occurredAt: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(occurredAt);
  const get = (type: string): string => {
    const part = parts.find((p) => p.type === type);
    return part?.value ?? "";
  };
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (year === "" || month === "" || day === "") {
    throw new Error(`Could not resolve local date for timezone "${timeZone}"`);
  }
  return `${year}-${month}-${day}`;
}

/** Start of the day containing `date` in `timeZone`, as a UTC instant. */
export function startOfDay(date: Date, timeZone: string): Date {
  return zonedToUtc(`${toLocalDate(date, timeZone)}T00:00:00`, timeZone);
}

/** End of the day containing `date` in `timeZone`, exclusive, as a UTC instant. */
export function endOfDayExclusive(date: Date, timeZone: string): Date {
  return zonedToUtc(`${toLocalDate(date, timeZone)}T23:59:59.999`, timeZone);
}

/**
 * Convert a wall-clock string in a given timezone (`YYYY-MM-DDTHH:mm:ss`) to a
 * UTC instant. Uses the Intl API so it has no dependency on ICU data for the
 * zone beyond what the runtime provides.
 */
export function zonedToUtc(wallClock: string, timeZone: string): Date {
  const match = wallClock.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
  );
  if (match === null) throw new Error(`Invalid wall-clock string: ${wallClock}`);
  const [, y, mo, d, h, mi, s = "00", ms = "000"] = match as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const asUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    Number(ms),
  );
  const naive = new Date(asUtc);

  // Find the offset of the timezone at that naive instant, then correct.
  const offsetAt = (instant: Date): number => {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(instant);
    const read = (type: string): number => {
      const part = parts.find((p) => p.type === type);
      return part === undefined ? 0 : Number(part.value);
    };
    const asUtcMillis = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") === 24 ? 0 : read("hour"),
      read("minute"),
      read("second"),
    );
    return asUtcMillis - instant.getTime();
  };

  const offset = offsetAt(naive);
  return new Date(naive.getTime() - offset);
}

/** The "age" of a timestamp in whole days (floor), e.g. for stale-balance rules. */
export function ageInDays(from: Date, now: Date = new Date()): number {
  const diff = now.getTime() - from.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000);
}

/** Difference in whole calendar days between two local dates. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const aMillis = Date.parse(`${a}T00:00:00Z`);
  const bMillis = Date.parse(`${b}T00:00:00Z`);
  return Math.round((bMillis - aMillis) / 86_400_000);
}

/** Money left on an income after allocations (the "free" amount). */
export function freeAmount(incomeAmount: Money, allocatedSum: Money): Money {
  return subMoneyNonNegative(incomeAmount, allocatedSum);
}
