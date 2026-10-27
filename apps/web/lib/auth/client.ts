/** Small JSON POST helper shared by the passkey forms. */
export async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "Terjadi kesalahan.";
    throw new Error(message);
  }

  return data as T;
}

/** Turn WebAuthn/browser failures into something a person can act on. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Terjadi kesalahan yang tidak dikenali.";

  switch (error.name) {
    case "NotAllowedError":
      return "Permintaan dibatalkan atau waktu habis. Coba lagi.";
    case "InvalidStateError":
      return "Passkey ini sudah terdaftar di perangkat ini.";
    case "SecurityError":
      return "Passkey memerlukan HTTPS dan domain yang sama. Periksa WEB_ORIGIN.";
    case "NotSupportedError":
      return "Perangkat atau browser ini belum mendukung passkey.";
    default:
      return error.message === "" ? "Terjadi kesalahan." : error.message;
  }
}
