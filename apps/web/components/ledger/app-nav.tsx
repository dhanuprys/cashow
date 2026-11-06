"use client";

import {
  ArrowLeftRight,
  Bell,
  Bot,
  CalendarClock,
  ChevronDown,
  Gauge,
  Layers,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Settings,
  Tags,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Navigation items organized by category */
const navigation = {
  primary: [
    { href: "/app", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight, exact: false },
    { href: "/app/plans", label: "Rencana", icon: Layers, exact: false },
    { href: "/app/accounts", label: "Akun", icon: Wallet, exact: false },
    { href: "/app/budgets", label: "Anggaran", icon: PiggyBank, exact: false },
  ],
  secondary: [
    { href: "/app/goals", label: "Target", icon: Target, exact: false },
    { href: "/app/inbox", label: "Kotak Masuk", icon: Bell, exact: false },
    { href: "/app/recurring", label: "Berulang", icon: CalendarClock, exact: false },
    { href: "/app/rules", label: "Aturan", icon: Gauge, exact: false },
    { href: "/app/import", label: "Impor", icon: Upload, exact: false },
    { href: "/app/chat", label: "AI Chat", icon: Bot, exact: false },
    { href: "/app/categories", label: "Kategori", icon: Tags, exact: false },
    { href: "/app/settings", label: "Pengaturan", icon: Settings, exact: false },
  ],
} as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact === true) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  className,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <SheetClose
      nativeButton={false}
      render={
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            active
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        />
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </SheetClose>
  );
}

/** Desktop: streamlined single nav row with dropdown. Mobile: bottom bar + sheet drawer. */
export function AppNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // The bottom bar shows the first four primary items; everything else —
  // the fifth primary item and all secondary pages — lives in the sheet, so
  // the "Lainnya" trigger must light up for any of them.
  const overflowItems = [...navigation.primary.slice(4), ...navigation.secondary];
  const hasOverflowActive = overflowItems.some((item) => isActive(pathname, item.href, item.exact));

  return (
    <>
      {/* Tablet/Desktop: Unified single nav bar */}
      <nav
        className="hidden items-center justify-between gap-1 md:flex"
        aria-label="Navigasi aplikasi"
      >
        <div className="flex items-center gap-1">
          {navigation.primary.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return <NavLink key={item.href} {...item} active={active} />;
          })}
        </div>

        {/* Secondary items accessible via dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors outline-none",
              hasOverflowActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-label="Menu lainnya"
          >
            <span>Lainnya</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Fitur Tambahan</DropdownMenuLabel>
              {navigation.secondary.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    nativeButton={false}
                    render={
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm",
                          active && "bg-muted font-medium text-foreground",
                        )}
                      />
                    }
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Mobile (<md): bottom bar with 4 primary + menu trigger */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigasi utama"
      >
        <ul className="grid grid-cols-5">
          {navigation.primary.slice(0, 4).map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors active:bg-muted/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon
                    className={cn("size-5", active ? "stroke-[2.4]" : "stroke-[1.8]")}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger
                aria-label="Buka menu lainnya"
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors active:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
                  hasOverflowActive ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <Menu className="size-5 stroke-[1.8]" aria-hidden="true" />
                <span>Lainnya</span>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[80dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
              >
                <SheetHeader className="pb-3">
                  <SheetTitle>Navigasi</SheetTitle>
                </SheetHeader>
                <div className="flex min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-4">
                  {/* Show remaining primary item (5th: Anggaran) */}
                  {navigation.primary.slice(4).map((item) => {
                    const active = isActive(pathname, item.href, item.exact);
                    return <MobileNavLink key={item.href} {...item} active={active} />;
                  })}
                  <hr className="my-2 h-px border-0 bg-border" />
                  {navigation.secondary.map((item) => {
                    const active = isActive(pathname, item.href, item.exact);
                    return <MobileNavLink key={item.href} {...item} active={active} />;
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </>
  );
}
