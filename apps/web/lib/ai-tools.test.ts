import { describe, expect, it } from "bun:test";
import { normalizeLocalDateTime, resolveByName } from "./ai-tools";

const accounts = [
  { id: "acc-bca", name: "BCA" },
  { id: "acc-bca-savings", name: "BCA Tabungan" },
  { id: "acc-cash", name: "Dompet Tunai" },
];

describe("resolveByName", () => {
  it("prefers an exact name over a longer containing name", () => {
    const result = resolveByName(accounts, "bca", "akun");
    expect(result).toEqual({ ok: true, value: { id: "acc-bca", name: "BCA" } });
  });

  it("normalizes case and whitespace", () => {
    const result = resolveByName(accounts, "  dompet   tunai ", "akun");
    expect(result.ok).toBe(true);
  });

  it("accepts a unique partial match", () => {
    const result = resolveByName(accounts, "tabungan", "akun");
    expect(result).toEqual({
      ok: true,
      value: { id: "acc-bca-savings", name: "BCA Tabungan" },
    });
  });

  it("refuses to guess when a partial match is ambiguous", () => {
    const result = resolveByName(accounts, "bca", "akun");
    // Exact match exists, so this is safe — but two names contain "bca".
    expect(result.ok).toBe(true);

    const ambiguous = resolveByName(
      [
        { id: "1", name: "Bank BCA" },
        { id: "2", name: "BCA Syariah" },
      ],
      "bca",
      "akun",
    );
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) expect(ambiguous.error).toContain("ambigu");
  });

  it("refuses duplicate exact names", () => {
    const result = resolveByName(
      [
        { id: "1", name: "Tunai" },
        { id: "2", name: "Tunai" },
      ],
      "tunai",
      "akun",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2 akun");
  });

  it("lists the available options when nothing matches", () => {
    const result = resolveByName(accounts, "mandiri", "akun");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("tidak ditemukan");
      expect(result.error).toContain("BCA");
    }
  });
});

describe("normalizeLocalDateTime", () => {
  const now = new Date("2026-11-02T03:15:00.000Z");

  it("defaults to now in the user's timezone", () => {
    expect(normalizeLocalDateTime(undefined, "Asia/Jakarta", now)).toBe("2026-11-02T10:15");
  });

  it("keeps the current local time for a date-only value", () => {
    expect(normalizeLocalDateTime("2026-10-30", "Asia/Jakarta", now)).toBe("2026-10-30T10:15");
  });

  it("passes a full local datetime through", () => {
    expect(normalizeLocalDateTime("2026-10-30T08:05", "Asia/Jakarta", now)).toBe(
      "2026-10-30T08:05",
    );
  });
});
