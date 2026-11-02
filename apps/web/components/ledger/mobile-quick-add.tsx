"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Mobile-only shortcut for the most common action: recording a transaction.
 * It sits above the bottom navigation and hides itself on the pages where the
 * form is already open.
 */
export function MobileQuickAdd() {
  const pathname = usePathname();
  const alreadyOnForm =
    pathname === "/app/transactions/new" || pathname.endsWith("/edit") || pathname === "/app/chat";

  if (alreadyOnForm) return null;

  return (
    <Link
      href="/app/transactions/new"
      aria-label="Catat transaksi"
      className={cn(
        "fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden",
        "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      <Plus className="size-6" aria-hidden="true" />
    </Link>
  );
}
