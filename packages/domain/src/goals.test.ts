import { describe, expect, test } from "bun:test";
import {
  goalCreateSchema,
  goalPacing,
  goalReservationSchema,
  goalUpdateSchema,
} from "@cashow/domain";

describe("Savings Goals Domain Schemas", () => {
  test("validates valid goal creation", () => {
    const valid = {
      name: "Dana Darurat",
      description: "Cadangan 6 bulan biaya hidup",
      targetAmount: "30000000",
      targetDate: "2026-12-31",
    };
    const res = goalCreateSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Dana Darurat");
      expect(res.data.targetAmount).toBe(30000000n);
      expect(res.data.targetDate).toBe("2026-12-31");
    }
  });

  test("rejects empty name or zero target amount", () => {
    const invalid = {
      name: "",
      targetAmount: "0",
    };
    const res = goalCreateSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  test("validates goal reservation payload", () => {
    const res = goalReservationSchema.safeParse({
      goalId: "018d3c12-7000-7000-8000-000000000001",
      accountId: "018d3c12-7000-7000-8000-000000000002",
      amount: "2500000",
      note: "Sisihkan bonus proyek",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amount).toBe(2500000n);
      expect(res.data.note).toBe("Sisihkan bonus proyek");
    }
  });

  test("validates status updates", () => {
    const res = goalUpdateSchema.safeParse({
      status: "COMPLETED",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe("COMPLETED");
    }
  });
});

describe("goalPacing", () => {
  test("returns nulls when there is no deadline", () => {
    expect(goalPacing(9_000_000n, null, "2026-11-04")).toEqual({
      monthsRemaining: null,
      monthlyPacing: null,
    });
  });

  test("rounds the monthly set-aside up so the target is reached", () => {
    // 10.000.000 over 3 months must suggest 3.333.334, not 3.333.333.
    const pacing = goalPacing(10_000_000n, "2027-02-01", "2026-11-04");
    expect(pacing.monthsRemaining).toBe(3);
    expect(pacing.monthlyPacing).toBe(3_333_334n);
  });

  test("counts the current month as one remaining month", () => {
    const pacing = goalPacing(1_000_000n, "2026-11-30", "2026-11-04");
    expect(pacing.monthsRemaining).toBe(1);
    expect(pacing.monthlyPacing).toBe(1_000_000n);
  });

  test("collapses a past deadline into a single month", () => {
    const pacing = goalPacing(500_000n, "2026-09-01", "2026-11-04");
    expect(pacing.monthsRemaining).toBe(1);
    expect(pacing.monthlyPacing).toBe(500_000n);
  });

  test("suggests nothing once the target is met", () => {
    const pacing = goalPacing(0n, "2027-01-01", "2026-11-04");
    expect(pacing.monthlyPacing).toBe(0n);
  });
});
