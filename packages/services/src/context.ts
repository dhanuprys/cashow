import type * as CashowDb from "@cashow/db";

/**
 * The database client and the active transaction share the same query
 * surface. Services take a context instead of importing `@cashow/db` at module
 * scope, so a build (or a unit test) never needs `DATABASE_URL` to load them.
 */
export type Database = (typeof CashowDb)["db"];
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryClient = Database | DbTransaction;

/**
 * Reads the backup artefacts' status files (`last-run.json`, `last-drill.json`)
 * without the service layer touching `node:fs` — the same port pattern as
 * `AttachmentStorage`. Returns the parsed `at` stamp (`YYYYMMDDTHHMMSSZ`) or
 * `null` when the file is missing, unreadable or malformed.
 */
export interface BackupStatusReader {
  lastRunAt(): Promise<string | null>;
  lastDrillAt(): Promise<string | null>;
}

export interface UseCaseContext {
  db: Database;
  /** Every query is scoped to this owner; the schema is multi-user ready. */
  userId: string;
  /** Injectable clock for tests; defaults to the wall clock. */
  now?: Date;
  /** Optional backup freshness source; absent means "never ran". */
  backups?: BackupStatusReader;
}

export function nowOf(ctx: UseCaseContext): Date {
  return ctx.now ?? new Date();
}

/** The owner's preferences that every derived date and period depends on. */
export interface UserSettings {
  timezone: string;
  budgetMonthStartDay: number;
  weekStartsOn: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  timezone: "Asia/Jakarta",
  budgetMonthStartDay: 1,
  weekStartsOn: 1,
};

/**
 * Cached per request on the context object itself.
 *
 * A single dashboard render asks for the timezone (summary), the budget start
 * day (summary + budget status + safe-to-spend) and the week start (summary).
 * Reading them separately meant seven round trips to the same `User` row; the
 * context is created once per request and shared by every service call, so
 * memoising here collapses them into one.
 */
const SETTINGS_KEY = Symbol("cashow.userSettings");

type SettingsCarrier = UseCaseContext & { [SETTINGS_KEY]?: Promise<UserSettings> };

/** The owner's timezone, budget month start day and week start, read once. */
export function userSettings(ctx: UseCaseContext): Promise<UserSettings> {
  const carrier = ctx as SettingsCarrier;
  const cached = carrier[SETTINGS_KEY];
  if (cached !== undefined) return cached;

  const pending = ctx.db.orm.public.User.where({ id: ctx.userId })
    .select("timezone", "budgetMonthStartDay", "weekStartsOn")
    .first()
    .then((user) => ({
      timezone: user?.timezone ?? DEFAULT_SETTINGS.timezone,
      budgetMonthStartDay: user?.budgetMonthStartDay ?? DEFAULT_SETTINGS.budgetMonthStartDay,
      weekStartsOn: user?.weekStartsOn ?? DEFAULT_SETTINGS.weekStartsOn,
    }))
    .catch(() => DEFAULT_SETTINGS);

  Object.defineProperty(carrier, SETTINGS_KEY, {
    value: pending,
    enumerable: false,
    configurable: true,
  });
  return pending;
}

/** The owner's timezone; every stored local date derives from it. */
export async function userTimezone(client: QueryClient, userId: string): Promise<string> {
  const user = await client.orm.public.User.where({ id: userId }).select("timezone").first();
  return user?.timezone ?? DEFAULT_SETTINGS.timezone;
}
