import { cn } from "@/lib/utils";

const ROW_IDS = ["row-1", "row-2", "row-3", "row-4", "row-5", "row-6"] as const;

/**
 * Content-only loading placeholder for pages where the static header
 * has already been committed to the static App Shell.
 */
export function ContentSkeleton({
  rows = 3,
  className,
  twoColumn = true,
}: {
  rows?: number;
  className?: string;
  twoColumn?: boolean;
}) {
  return (
    <div className={cn("w-full space-y-4", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>
      <div
        className={cn(
          "grid gap-4",
          twoColumn ? "sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1",
        )}
      >
        <div className="space-y-4">
          {ROW_IDS.slice(0, rows).map((id) => (
            <div key={id} className="rounded-2xl border border-border bg-card p-5">
              <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
              <div className="mt-3 h-3 w-2/3 animate-pulse rounded-md bg-muted" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
        {twoColumn ? (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
            <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Full page loading placeholder including header for full-page fallbacks.
 */
export function PageSkeleton({
  rows = 3,
  className,
  twoColumn = true,
}: {
  rows?: number;
  className?: string;
  twoColumn?: boolean;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl space-y-6", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat halaman…</span>
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-muted" />
      </div>

      <ContentSkeleton rows={rows} twoColumn={twoColumn} />
    </div>
  );
}
