/**
 * JSON columns cannot hold `bigint` (amounts) or `Date` objects. Audit rows and
 * outbox payloads record the ledger as JSON-safe strings, so a replay or a
 * diff never loses precision to a float.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function jsonSafe(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) result[key] = jsonSafe(entry);
    }
    return result;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "symbol") return value.toString();
  return String(value);
}

/** A JSON-safe copy of a ledger row, ready for `AuditLog`/`OutboxEvent`. */
export function snapshot(value: object): Record<string, JsonValue> {
  return jsonSafe(value) as Record<string, JsonValue>;
}
