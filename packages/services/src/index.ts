/**
 * One use-case layer (section 6).
 *
 * Server actions, route handlers, the Telegram bot and AI tools all call these
 * services, so validation and invariants live exactly once. Use cases go here;
 * no framework code.
 */

/** A scoped context for every use case: all queries are per-user. */
export interface UseCaseContext {
  userId: string;
}

/** Discriminated result so use cases never throw for expected failures. */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
