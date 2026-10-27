import { describe, expect, test } from "bun:test";
import {
  accountInputSchema,
  categoryInputSchema,
  formatDateTime,
  localDateTimeToUtc,
  parseDbTimestamp,
  parseMoney,
  positiveMoneyText,
  toLocalDate,
  toLocalDateTimeInput,
  transactionCreateSchema,
} from "./index";

describe("positiveMoneyText", () => {
  test("accepts Indonesian shorthand and returns bigint", () => {
    expect(positiveMoneyText.parse("35rb")).toBe(35_000n);
    expect(positiveMoneyText.parse("1,5jt")).toBe(1_500_000n);
    expect(positiveMoneyText.parse("Rp 250.000")).toBe(250_000n);
  });

  test("rejects zero, negative and unreadable amounts", () => {
    expect(positiveMoneyText.safeParse("0").success).toBe(false);
    expect(positiveMoneyText.safeParse("-5rb").success).toBe(false);
    expect(positiveMoneyText.safeParse("banyak").success).toBe(false);
    expect(positiveMoneyText.safeParse("").success).toBe(false);
  });
});

describe("accountInputSchema", () => {
  test("defaults currency and parses a negative opening balance", () => {
    const parsed = accountInputSchema.parse({
      name: "Kartu Kredit",
      type: "BANK",
      openingBalance: "-250rb",
    });
    expect(parsed.openingBalance).toBe(-250_000n);
    expect(parsed.currency).toBe("IDR");
  });
});

describe("categoryInputSchema", () => {
  test("normalizes empty optional fields to null", () => {
    const parsed = categoryInputSchema.parse({
      name: "Makan",
      kind: "EXPENSE",
      parentId: "",
      icon: undefined,
    });
    expect(parsed.parentId).toBeNull();
    expect(parsed.icon).toBeNull();
  });
});

describe("transactionCreateSchema", () => {
  test("parses an expense with allocations", () => {
    const parsed = transactionCreateSchema.parse({
      type: "EXPENSE",
      amount: "250000",
      accountId: "acc-1",
      categoryId: "cat-1",
      occurredAtLocal: "2026-10-27T09:30",
      allocations: [{ incomeId: "inc-1", amount: "250rb" }],
    });

    expect(parsed.amount).toBe(250_000n);
    expect(parsed.allocations[0]?.amount).toBe(250_000n);
    expect(parsed.source).toBe("MANUAL");
  });

  test("rejects an unknown type and a malformed local date", () => {
    expect(
      transactionCreateSchema.safeParse({
        type: "TRANSFER",
        amount: "1",
        accountId: "a",
        occurredAtLocal: "2026-10-27T09:30",
      }).success,
    ).toBe(false);

    expect(
      transactionCreateSchema.safeParse({
        type: "INCOME",
        amount: "1",
        accountId: "a",
        occurredAtLocal: "2026-10-27 09:30",
      }).success,
    ).toBe(false);
  });
});

describe("timestamps", () => {
  test("parses PostgreSQL text timestamps", () => {
    const fromPg = parseDbTimestamp("2026-10-27 01:45:51.602+00");
    expect(fromPg.toISOString()).toBe("2026-10-27T01:45:51.602Z");

    const withOffset = parseDbTimestamp("2026-10-27 08:45:51.602+07");
    expect(withOffset.toISOString()).toBe("2026-10-27T01:45:51.602Z");
  });

  test("round-trips a local datetime input in WIB", () => {
    const instant = localDateTimeToUtc("2026-10-27T09:30", "Asia/Jakarta");
    expect(instant.toISOString()).toBe("2026-10-27T02:30:00.000Z");
    expect(toLocalDateTimeInput(instant, "Asia/Jakarta")).toBe("2026-10-27T09:30");
    expect(toLocalDate(instant, "Asia/Jakarta")).toBe("2026-10-27");
  });

  test("formats an instant in Indonesian", () => {
    expect(formatDateTime(new Date("2026-10-27T02:30:00Z"), "Asia/Jakarta")).toMatch(
      /27 Okt 2026.*09\.30/,
    );
  });

  test("does not depend on the host timezone", () => {
    const amount = parseMoney("1.500.000");
    expect(amount).toBe(1_500_000n);
  });
});
