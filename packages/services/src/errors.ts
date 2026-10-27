/**
 * Expected failures are values, not exceptions (plan §6: "no framework code"
 * in services). Use cases throw `LedgerError` inside a transaction so the
 * transaction rolls back, then map it to a `Result` at the boundary.
 */

export type LedgerErrorCode = "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "INTERNAL";

const STATUS: Record<LedgerErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FORBIDDEN: 403,
  INTERNAL: 500,
};

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  readonly status: number;

  constructor(code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function isLedgerError(error: unknown): error is LedgerError {
  return error instanceof LedgerError;
}

/** Best-effort PostgreSQL SQLSTATE from a wrapped driver/runtime error. */
function pgCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string" && candidate.code.startsWith("23")) {
    return candidate.code;
  }
  if (typeof candidate.cause === "object" && candidate.cause !== null) {
    const cause = candidate.cause as { code?: unknown };
    if (typeof cause.code === "string" && cause.code.startsWith("23")) return cause.code;
  }
  if (typeof candidate.cause === "object" && candidate.cause !== null) {
    const nested = candidate.cause as { cause?: unknown };
    if (typeof nested.cause === "object" && nested.cause !== null) {
      const inner = nested.cause as { code?: unknown };
      if (typeof inner.code === "string" && inner.code.startsWith("23")) return inner.code;
    }
  }
  return undefined;
}

function messageOf(error: unknown): string {
  if (isLedgerError(error)) return error.message;
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message !== "") return cause.message;
    return error.message;
  }
  return String(error);
}

/**
 * Translate a constraint violation into a sentence the UI can show. The raw
 * SQL trigger messages are intentionally specific (`allocation sum …`), so a
 * match here keeps the friendly path without leaking SQL details.
 */
export function toLedgerError(
  error: unknown,
  fallback = "Terjadi kesalahan. Coba lagi.",
): LedgerError {
  if (isLedgerError(error)) return error;

  const code = pgCode(error);
  const message = messageOf(error);

  if (code === "23514") {
    if (message.includes("locked by a checkpoint")) {
      return new LedgerError(
        "CONFLICT",
        "Periode ini terkunci oleh checkpoint. Buka kunci checkpoint dulu untuk mengubahnya.",
      );
    }
    if (message.includes("zero-gap snapshot")) {
      return new LedgerError(
        "CONFLICT",
        "Checkpoint hanya bisa dibuat untuk snapshot tanpa selisih.",
      );
    }
    if (message.includes("checkpoint")) {
      return new LedgerError("CONFLICT", "Checkpoint tidak memenuhi aturan rekonsiliasi.");
    }
    if (message.includes("transfer fee")) {
      return new LedgerError("VALIDATION", "Biaya transfer harus memakai akun asal transfer.");
    }
    if (message.includes("archived plan")) {
      return new LedgerError("CONFLICT", "Rencana sudah diarsipkan.");
    }
    if (message.includes("plan item")) {
      return new LedgerError("VALIDATION", "Tahap pembayaran tidak sesuai.");
    }
    if (message.includes("allocation sum") || message.includes("exceeds transaction")) {
      return new LedgerError("CONFLICT", "Alokasi melebihi jumlah yang tersedia.");
    }
    if (message.includes("soft-deleted")) {
      return new LedgerError("CONFLICT", "Transaksi yang dihapus tidak bisa dialokasikan.");
    }
    if (message.includes("crosses users") || message.includes("another user")) {
      return new LedgerError("FORBIDDEN", "Data milik pengguna lain tidak bisa diubah.");
    }
    if (message.includes("category kind")) {
      return new LedgerError("VALIDATION", "Kategori tidak sesuai dengan jenis transaksi.");
    }
    if (message.includes("is a ")) {
      return new LedgerError("VALIDATION", "Alokasi harus menghubungkan pengeluaran ke pemasukan.");
    }
    return new LedgerError("VALIDATION", "Nilai tidak memenuhi aturan pencatatan.");
  }

  if (code === "23505") {
    return new LedgerError("CONFLICT", "Data yang sama sudah ada.");
  }

  if (code === "23503") {
    return new LedgerError("VALIDATION", "Data yang dirujuk tidak ditemukan.");
  }

  return new LedgerError("INTERNAL", fallback);
}

export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === "23505";
}
