"use client";

/**
 * Last-resort boundary: it replaces the root layout, so it cannot rely on
 * Tailwind or the theme tokens being loaded. Everything is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#ffffff",
          color: "#111111",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Cashow
        </p>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>Aplikasi gagal dimuat</h1>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, maxWidth: "36ch" }}>
          Ada gangguan saat memuat aplikasi. Coba muat ulang halaman ini.
        </p>
        {error.digest === undefined ? null : (
          <p style={{ margin: 0, fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
            Kode: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            alignSelf: "flex-start",
            padding: "10px 16px",
            borderRadius: "999px",
            border: "none",
            background: "#0f7a3d",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Muat ulang
        </button>
      </body>
    </html>
  );
}
