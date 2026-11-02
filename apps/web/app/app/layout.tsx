import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNav } from "@/components/ledger/app-nav";
import { AppNavFallback } from "@/components/ledger/app-nav-fallback";
import { AppMain, AppShell } from "@/components/ledger/app-shell";
import { CommandPalette } from "@/components/ledger/command-palette";
import { MobileQuickAdd } from "@/components/ledger/mobile-quick-add";
import { UserHeaderAvatar } from "@/components/ledger/user-header-avatar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          {/* Top row: logo + command palette + user avatar + logout */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
            <Link href="/app" className="flex min-w-0 items-center gap-2">
              <Image
                src="/logo.png"
                alt="Cashow"
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-xl"
                priority
              />
              <span className="truncate font-heading text-base font-semibold tracking-tight">
                Cashow
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <CommandPalette />
              <Suspense fallback={<div className="size-8 rounded-xl bg-muted/60 animate-pulse" />}>
                <UserHeaderAvatar />
              </Suspense>
              <LogoutButton />
            </div>
          </div>
          {/* Navigation row: rendered inside the header on md/lg screens */}
          <div className="md:px-6 md:pb-2.5">
            <Suspense fallback={<AppNavFallback />}>
              <AppNav />
            </Suspense>
          </div>
        </div>
      </header>

      <AppMain>{children}</AppMain>

      <Suspense fallback={null}>
        <MobileQuickAdd />
      </Suspense>
    </AppShell>
  );
}
