import { toLocalDateTimeInput } from "@cashow/domain";

/**
 * Helpers shared by the chat write tools.
 *
 * The model speaks names ("BCA", "Makan"), services need IDs, and a wrong
 * guess writes money to the wrong place. These stay pure so the ambiguity
 * rules can be unit-tested without a database.
 */

export interface NamedOption {
  id: string;
  name: string;
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ResolveResult<T extends NamedOption> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Resolve a spoken name to exactly one option. Exact matches win; a unique
 * partial match is accepted; anything ambiguous returns a question instead of
 * a guess.
 */
export function resolveByName<T extends NamedOption>(
  options: T[],
  rawName: string,
  label: string,
): ResolveResult<T> {
  const wanted = normalizeName(rawName);
  if (wanted === "") return { ok: false, error: `Nama ${label} wajib diisi.` };

  const exact = options.filter((option) => normalizeName(option.name) === wanted);
  if (exact.length === 1) return { ok: true, value: exact[0] as T };
  if (exact.length > 1) {
    return {
      ok: false,
      error: `Ada ${exact.length} ${label} bernama "${rawName}". Sebutkan pembedanya.`,
    };
  }

  const partial = options.filter((option) => normalizeName(option.name).includes(wanted));
  if (partial.length === 1) return { ok: true, value: partial[0] as T };
  if (partial.length > 1) {
    return {
      ok: false,
      error: `Nama ${label} "${rawName}" ambigu: ${partial
        .slice(0, 6)
        .map((option) => option.name)
        .join(", ")}.`,
    };
  }

  return {
    ok: false,
    error: `${label} "${rawName}" tidak ditemukan. Pilihan: ${options
      .slice(0, 8)
      .map((option) => option.name)
      .join(", ")}.`,
  };
}

/** Accept a date-only input by borrowing the current local time of day. */
export function normalizeLocalDateTime(
  raw: string | null | undefined,
  timezone: string,
  now: Date,
): string {
  const value = raw?.trim();
  if (!value) return toLocalDateTimeInput(now, timezone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${toLocalDateTimeInput(now, timezone).slice(11)}`;
  }
  return value;
}
