"use client";

import {
  ArrowLeftRight,
  Bell,
  Bot,
  CalendarClock,
  Gauge,
  Layers,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Settings,
  Tags,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
    { href: "/app/inbox", label: "Kotak Masuk", icon: Bell, exact: false },
    { href: "/app/recurring", label: "Berulang", icon: CalendarClock, exact: false },
    { href: "/app/import", label: "Impor", icon: Upload, exact: false },
    { href: "/app/rules", label: "Aturan", icon: Gauge, exact: false },
    { href: "/app/chat", label: "Chat", icon: Bot, exact: false },
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
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
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
      render={
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
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

/** Desktop: horizontal tabs with grouping. Mobile: bottom bar + sheet drawer. */
export function AppNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Count active secondary items for badge (e.g., unread notifications)
  const hasSecondaryActive = navigation.secondary.some((item) =>
    isActive(pathname, item.href, item.exact),
  );

  return (
    <>
      {/* Desktop: visible horizontal nav */}
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
        {navigation.primary.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return <NavLink key={item.href} {...item} active={active} />;
        })}
      </nav>

      {/* Desktop: secondary nav in a separate row for wider screens */}
      <nav
        className="hidden items-center gap-1 border-t border-border pt-2 lg:flex"
        aria-label="Navigasi sekunder"
      >
        {navigation.secondary.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return <NavLink key={item.href} {...item} active={active} />;
        })}
      </nav>

      {/* Mobile: bottom bar with 4 primary + menu trigger */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
                    "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                    active ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active ? "stroke-[2.4]" : "stroke-[1.8]")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger
                className={cn(
                  "flex w-full flex-col items-center gap-1 py-2.5 text-[10px]",
                  hasSecondaryActive ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                <Menu className="size-5 stroke-[1.8]" />
                <span>Lainnya</span>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
                <SheetHeader className="pb-4">
                  <SheetTitle>Navigasi</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 overflow-y-auto px-2">
                  {/* Show remaining primary item (5th) */}
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
