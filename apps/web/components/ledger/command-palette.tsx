"use client";

import {
  ArrowLeftRight,
  Bell,
  Bot,
  CalendarClock,
  Gauge,
  Layers,
  LayoutDashboard,
  PiggyBank,
  Search,
  Settings,
  Tags,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const navigation = [
  { href: "/app", label: "Ringkasan", icon: LayoutDashboard, group: "Utama" },
  { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight, group: "Utama" },
  { href: "/app/plans", label: "Rencana", icon: Layers, group: "Utama" },
  { href: "/app/accounts", label: "Akun", icon: Wallet, group: "Utama" },
  { href: "/app/budgets", label: "Anggaran", icon: PiggyBank, group: "Utama" },
  { href: "/app/inbox", label: "Kotak Masuk", icon: Bell, group: "Lainnya" },
  { href: "/app/recurring", label: "Berulang", icon: CalendarClock, group: "Lainnya" },
  { href: "/app/import", label: "Impor", icon: Upload, group: "Lainnya" },
  { href: "/app/rules", label: "Aturan", icon: Gauge, group: "Lainnya" },
  { href: "/app/chat", label: "Chat", icon: Bot, group: "Lainnya" },
  { href: "/app/categories", label: "Kategori", icon: Tags, group: "Lainnya" },
  { href: "/app/settings", label: "Pengaturan", icon: Settings, group: "Lainnya" },
] as const;

/** Cmd+K / Ctrl+K command palette for quick navigation. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  const grouped = navigation.reduce<Record<string, (typeof navigation)[number][]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:flex"
        aria-label="Buka palet perintah"
      >
        <Search className="size-4" aria-hidden="true" />
        <span>Cari halaman…</span>
        <kbd className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cari halaman atau aksi…" />
        <CommandList>
          <CommandEmpty>Tidak ditemukan.</CommandEmpty>
          {Object.entries(grouped).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => onSelect(item.href)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
