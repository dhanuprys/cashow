import {
  ArrowLeftRight,
  ChevronDown,
  Layers,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/app", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/app/plans", label: "Rencana", icon: Layers },
  { href: "/app/accounts", label: "Akun", icon: Wallet },
  { href: "/app/budgets", label: "Anggaran", icon: PiggyBank },
] as const;

/**
 * Server-rendered static shell fallback for AppNav.
 *
 * Keeps both desktop and mobile navigation visible in the prerendered
 * static App Shell before client hydration, eliminating layout shifts.
 */
export function AppNavFallback() {
  return (
    <>
      {/* Desktop static nav shell */}
      <nav
        className="hidden items-center justify-between gap-1 md:flex"
        aria-label="Navigasi aplikasi"
      >
        <div className="flex items-center gap-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground"
          aria-hidden="true"
        >
          <span>Lainnya</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </div>
      </nav>

      {/* Mobile static nav shell (<md) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigasi utama"
      >
        <ul className="grid grid-cols-5">
          {primaryNav.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] text-muted-foreground transition-colors",
                  )}
                >
                  <Icon className="size-5 stroke-[1.8]" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <div
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] text-muted-foreground"
              aria-hidden="true"
            >
              <Menu className="size-5 stroke-[1.8]" />
              <span className="truncate">Lainnya</span>
            </div>
          </li>
        </ul>
      </nav>
    </>
  );
}
