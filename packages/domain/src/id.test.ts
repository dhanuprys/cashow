import { describe, expect, test } from "bun:test";
import { uuidv7 } from "./id";

describe("uuidv7", () => {
  test("is a version 7, RFC 4122 variant UUID", () => {
    const id = uuidv7(Date.UTC(2026, 9, 27, 1, 2, 3, 456));

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("orders by timestamp", () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_001_000);

    expect(earlier < later).toBe(true);
  });

  test("is unique across calls in the same millisecond", () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(1_000);
  });
});
