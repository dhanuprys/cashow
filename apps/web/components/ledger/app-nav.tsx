"use client";

import { ArrowLeftRight, Layers, LayoutDashboard, Settings, Tags, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/app/plans", label: "Rencana", icon: Layers },
  { href: "/app/accounts", label: "Akun", icon: Wallet },
  { href: "/app/categories", label: "Kategori", icon: Tags },
  { href: "/app/settings", label: "Pengaturan", icon: Settings },
] as const;

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
          {items.map((item) => {
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
        </ul>
      </nav>
    </>
  );
}
