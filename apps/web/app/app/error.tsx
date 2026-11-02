"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Server actions surface `LedgerError`s as thrown errors; without this file
 * Next renders an unstyled production page with no way back into the app.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the stack in the browser console for bug reports; the UI stays calm.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Terjadi kesalahan
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Halaman ini gagal dimuat
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Data kamu tidak hilang — cukup coba lagi. Kalau masalahnya berulang, kembali ke ringkasan
        lalu buka halaman ini sekali lagi.
      </p>
      {error.digest === undefined ? null : (
        <p className="font-mono text-xs text-muted-foreground">Kode: {error.digest}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Coba lagi
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/app" />}>
          Ke ringkasan
        </Button>
      </div>
    </div>
  );
}
