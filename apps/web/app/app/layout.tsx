import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNav } from "@/components/ledger/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          {/* Top row: logo + logout */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/app" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                C
              </span>
              <span className="font-heading text-base font-semibold tracking-tight">Cashow</span>
            </Link>
            <LogoutButton />
          </div>
          {/* Navigation row */}
          <div className="px-4 pb-3 sm:px-6">
            <Suspense fallback={<div aria-hidden="true" className="h-10" />}>
              <AppNav />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:pb-6">
        {children}
      </main>
    </div>
  );
}
