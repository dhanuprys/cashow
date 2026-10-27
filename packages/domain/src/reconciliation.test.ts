import { describe, expect, test } from "bun:test";
import {
  estimatedLiveBalance,
  expectedBalance,
  gapKind,
  movementDelta,
  reconciliationGap,
} from "./reconciliation";

describe("movementDelta", () => {
  test("a transfer never counts as spending overall", () => {
    expect(movementDelta({ kind: "INCOME", amount: 5_000_000n })).toBe(5_000_000n);
    expect(movementDelta({ kind: "EXPENSE", amount: 1_000_000n })).toBe(-1_000_000n);
    expect(movementDelta({ kind: "TRANSFER_OUT", amount: 2_000_000n })).toBe(-2_000_000n);
    expect(movementDelta({ kind: "TRANSFER_IN", amount: 2_000_000n })).toBe(2_000_000n);
    expect(
      movementDelta({ kind: "TRANSFER_OUT", amount: 2_000_000n }) +
        movementDelta({ kind: "TRANSFER_IN", amount: 2_000_000n }),
    ).toBe(0n);
  });
});

describe("reconciliation", () => {
  test("expected balance applies income, expense, transfer and its fee", () => {
    const previous = 1_000_000n;
    const movements = [
      { kind: "INCOME" as const, amount: 5_000_000n },
      { kind: "EXPENSE" as const, amount: 1_000_000n },
      { kind: "TRANSFER_OUT" as const, amount: 2_000_000n },
      { kind: "EXPENSE" as const, amount: 5_000n },
    ];
    expect(expectedBalance(previous, movements)).toBe(2_995_000n);
  });

  test("gap sign says whether money is missing or unlogged", () => {
    expect(reconciliationGap(2_995_000n, 2_995_000n)).toBe(0n);
    expect(gapKind(0n)).toBe("BALANCED");
    expect(reconciliationGap(2_815_000n, 2_995_000n)).toBe(-180_000n);
    expect(gapKind(-180_000n)).toBe("UNLOGGED_SPENDING");
    expect(gapKind(180_000n)).toBe("UNLOGGED_INCOME");
  });

  test("estimated live balance starts from the latest stated snapshot", () => {
    expect(
      estimatedLiveBalance(1_995_000n, [
        { kind: "INCOME", amount: 1_000_000n },
        { kind: "EXPENSE", amount: 500_000n },
      ]),
    ).toBe(2_495_000n);
  });
});
