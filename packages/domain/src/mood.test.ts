import { describe, expect, it } from "bun:test";
import { deriveFinancialMood } from "./mood";

describe("deriveFinancialMood", () => {
  it("derives THRIVING when cashflow is positive and budget is low", () => {
    const mood = deriveFinancialMood({
      income: 10_000_000n,
      expense: 3_000_000n,
      budgetUsedPercent: 30,
    });
    expect(mood.status).toBe("THRIVING");
    expect(mood.label).toBe("Arus Kas Sehat");
  });

  it("derives BALANCED when budget usage is between 75% and 100%", () => {
    const mood = deriveFinancialMood({
      income: 10_000_000n,
      expense: 8_000_000n,
      budgetUsedPercent: 85,
    });
    expect(mood.status).toBe("BALANCED");
    expect(mood.label).toBe("Terkendali");
  });

  it("derives ATTENTION when budget exceeds 100%", () => {
    const mood = deriveFinancialMood({
      income: 10_000_000n,
      expense: 11_000_000n,
      budgetUsedPercent: 115,
    });
    expect(mood.status).toBe("ATTENTION");
    expect(mood.label).toBe("Perlu Evaluasi");
  });

  it("derives ATTENTION when expenses heavily surpass income without budget set", () => {
    const mood = deriveFinancialMood({
      income: 5_000_000n,
      expense: 6_500_000n,
    });
    expect(mood.status).toBe("ATTENTION");
  });

  it("derives THRIVING when starting fresh with 0 income and 0 expense", () => {
    const mood = deriveFinancialMood({
      income: 0n,
      expense: 0n,
    });
    expect(mood.status).toBe("THRIVING");
  });
});
