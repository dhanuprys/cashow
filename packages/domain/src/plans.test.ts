import { describe, expect, test } from "bun:test";
import { derivePlanStatus, planItemOutstanding, planItemProgress, planItemStatus } from "./plans";

describe("planItemStatus", () => {
  const today = "2026-10-27";

  test("distinguishes pending, partial and received before the due date", () => {
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 0n,
        dueOn: "2026-11-01",
        today,
      }),
    ).toBe("PENDING");
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 2_500_000n,
        dueOn: "2026-11-01",
        today,
      }),
    ).toBe("PARTIAL");
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 5_000_000n,
        dueOn: "2026-11-01",
        today,
      }),
    ).toBe("RECEIVED");
  });

  test("marks an unpaid or partly paid past-due item overdue", () => {
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 0n,
        dueOn: "2026-10-26",
        today,
      }),
    ).toBe("OVERDUE");
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 4_999_999n,
        dueOn: "2026-10-26",
        today,
      }),
    ).toBe("OVERDUE");
  });

  test("a payment on the due date is not late, and extra money over-receives", () => {
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 1_000_000n,
        dueOn: "2026-10-27",
        today,
      }),
    ).toBe("PARTIAL");
    expect(
      planItemStatus({
        expectedAmount: 5_000_000n,
        receivedAmount: 5_500_000n,
        dueOn: "2026-01-01",
        today,
      }),
    ).toBe("OVER_RECEIVED");
  });
});

test("outstanding never goes negative and progress caps at 100", () => {
  expect(planItemOutstanding(5_000_000n, 2_500_000n)).toBe(2_500_000n);
  expect(planItemOutstanding(5_000_000n, 6_000_000n)).toBe(0n);
  expect(planItemProgress(5_000_000n, 2_500_000n)).toBe(50);
  expect(planItemProgress(5_000_000n, 6_000_000n)).toBe(100);
  expect(planItemProgress(5_000_000n, 0n)).toBe(0);
});

describe("derivePlanStatus", () => {
  test("rolls item statuses up to the plan", () => {
    expect(derivePlanStatus([])).toBe("ACTIVE");
    expect(derivePlanStatus([{ status: "PENDING" }, { status: "PARTIAL" }])).toBe("ACTIVE");
    expect(derivePlanStatus([{ status: "RECEIVED" }, { status: "OVER_RECEIVED" }])).toBe(
      "COMPLETED",
    );
    expect(derivePlanStatus([{ status: "RECEIVED" }, { status: "OVERDUE" }])).toBe("OVERDUE");
  });
});
