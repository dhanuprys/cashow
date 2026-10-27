"use client";

import {
  ArrowLeftRight,
  Bell,
  Bot,
  CalendarClock,
  Gauge,
  Layers,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  Settings,
  Tags,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/app/plans", label: "Rencana", icon: Layers },
  { href: "/app/accounts", label: "Akun", icon: Wallet },
  { href: "/app/budgets", label: "Anggaran", icon: PiggyBank },
  { href: "/app/import", label: "Impor", icon: Upload },
  { href: "/app/recurring", label: "Berulang", icon: CalendarClock },
  { href: "/app/inbox", label: "Kotak masuk", icon: Bell },
  { href: "/app/rules", label: "Aturan", icon: Gauge },
  { href: "/app/chat", label: "Chat", icon: Bot },
  { href: "/app/categories", label: "Kategori", icon: Tags },
  { href: "/app/settings", label: "Pengaturan", icon: Settings },
] as const;

const primary = items.slice(0, 5);
const secondary = items.slice(5);

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact === true) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop tabs in the header; mobile gets a fixed bottom bar. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-1 sm:flex" aria-label="Navigasi utama">
        {items.map((item) => {
          const active = isActive(pathname, item.href, "exact" in item && item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Navigasi utama"
      >
        <ul className="grid grid-cols-6">
          {primary.map((item) => {
            const active = isActive(pathname, item.href, "exact" in item && item.exact);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active ? "stroke-[2.4]" : "stroke-[1.8]")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="relative">
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="size-5 stroke-[1.8]" />
                Lainnya
              </summary>
              <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-border bg-background p-1 shadow-lg">
                {secondary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </li>
        </ul>
      </nav>
    </>
  );
}
