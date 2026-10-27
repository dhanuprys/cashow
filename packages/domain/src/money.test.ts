import { describe, expect, test } from "bun:test";
import {
  allocatedSum,
  formatMoney,
  formatMoneyCompact,
  isAllocationValid,
  parseMoney,
  toLocalDate,
  wouldExceedExpense,
  wouldExceedIncome,
  ZERO,
} from "./index.js";

describe("parseMoney", () => {
  test("parses plain integers", () => {
    expect(parseMoney("35000")).toBe(35000n);
    expect(parseMoney("0")).toBe(0n);
    expect(parseMoney("1")).toBe(1n);
  });

  test("parses Indonesian shorthand", () => {
    expect(parseMoney("35k")).toBe(35000n);
    expect(parseMoney("35rb")).toBe(35000n);
    expect(parseMoney("35ribu")).toBe(35000n);
    expect(parseMoney("1,5jt")).toBe(1500000n);
    expect(parseMoney("1.5jt")).toBe(1500000n);
    expect(parseMoney("2juta")).toBe(2000000n);
    expect(parseMoney("2m")).toBe(2000000n);
  });

  test("parses a currency prefix", () => {
    expect(parseMoney("Rp 35.000")).toBe(35000n);
    expect(parseMoney("rp35.000")).toBe(35000n);
    expect(parseMoney("Rp 1,5 jt")).toBe(1500000n);
  });

  test("handles thousands separators", () => {
    expect(parseMoney("1.500")).toBe(1500n);
    expect(parseMoney("1,500")).toBe(1500n);
    expect(parseMoney("1.500.000")).toBe(1500000n);
    expect(parseMoney("1,500,000")).toBe(1500000n);
  });

  test("rounds fractions half up", () => {
    expect(parseMoney("1,5")).toBe(2n);
    expect(parseMoney("1,4")).toBe(1n);
  });

  test("parses negative amounts", () => {
    expect(parseMoney("-1jt")).toBe(-1000000n);
  });

  test("rejects invalid input", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.2.3.4.5")).toBeNull();
    expect(parseMoney("35xyz")).toBeNull();
  });
});

describe("formatMoney", () => {
  test("formats as Indonesian currency", () => {
    expect(formatMoney(1500000n)).toBe("Rp1.500.000");
    expect(formatMoney(0n)).toBe("Rp0");
  });

  test("formats compact shorthand", () => {
    expect(formatMoneyCompact(1500000n)).toBe("1,5 jt");
    expect(formatMoneyCompact(2000000n)).toBe("2 jt");
    expect(formatMoneyCompact(35000n)).toBe("35 rb");
    expect(formatMoneyCompact(500n)).toBe("500");
    expect(formatMoneyCompact(-1500000n)).toBe("-1,5 jt");
  });
});

describe("toLocalDate", () => {
  test("derives the stored local date from an instant", () => {
    // 2026-01-01 00:30 UTC == 2026-01-01 07:30 in Asia/Jakarta (WIB, UTC+7)
    const instant = new Date("2026-01-01T00:30:00Z");
    expect(toLocalDate(instant, "Asia/Jakarta")).toBe("2026-01-01");
  });

  test("respects the timezone boundary at midnight", () => {
    // 2026-01-01 17:30 UTC == 2026-01-02 00:30 in Asia/Jakarta
    const instant = new Date("2026-01-01T17:30:00Z");
    expect(toLocalDate(instant, "Asia/Jakarta")).toBe("2026-01-02");
    // but still the 1st in UTC
    expect(toLocalDate(instant, "UTC")).toBe("2026-01-01");
  });
});

describe("allocation invariants", () => {
  test("valid allocation is positive and within both sides", () => {
    expect(
      isAllocationValid({ amount: 250000n, incomeFree: 500000n, expenseRemaining: 250000n }),
    ).toBe(true);
  });

  test("rejects allocations beyond the income free amount", () => {
    expect(
      isAllocationValid({ amount: 600000n, incomeFree: 500000n, expenseRemaining: 600000n }),
    ).toBe(false);
  });

  test("rejects allocations beyond the expense remaining", () => {
    expect(
      isAllocationValid({ amount: 300000n, incomeFree: 500000n, expenseRemaining: 250000n }),
    ).toBe(false);
  });

  test("rejects non-positive allocations", () => {
    expect(
      isAllocationValid({ amount: ZERO, incomeFree: 500000n, expenseRemaining: 250000n }),
    ).toBe(false);
    expect(isAllocationValid({ amount: -1n, incomeFree: 500000n, expenseRemaining: 250000n })).toBe(
      false,
    );
  });

  test("detects allocations exceeding an income", () => {
    const allocations = [
      { expenseId: "e1", incomeId: "a", amount: 250000n },
      { expenseId: "e2", incomeId: "a", amount: 300000n },
    ];
    const free = new Map([["a", 500000n]]);
    expect(wouldExceedIncome(allocations, free)).toBe(true);
  });

  test("detects allocations exceeding an expense", () => {
    const allocations = [{ expenseId: "e1", incomeId: "a", amount: 300000n }];
    expect(wouldExceedExpense(allocations, 250000n)).toBe(true);
  });

  test("sums allocations", () => {
    expect(allocatedSum([250000n, 250000n])).toBe(500000n);
  });
});
