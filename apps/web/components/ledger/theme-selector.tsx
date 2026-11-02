"use client";

import { Check, Info, Monitor, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Theme, useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export type { Theme };

interface ThemeOption {
  value: Theme;
  title: string;
  description: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: "light",
    title: "Terang",
    description: "Tampilan bersih dan kontras tinggi, ideal untuk penggunaan di siang hari.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Gelap",
    description: "Mengurangi ketegangan mata saat minim cahaya dan lebih hemat daya OLED.",
    icon: Moon,
  },
  {
    value: "system",
    title: "Ikuti Sistem",
    description: "Berganti otomatis mengikuti setelan tema sistem operasi perangkat Anda.",
    icon: Monitor,
  },
];

export function ThemeSelector() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <div className="space-y-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="sr-only">Pilih tema antarmuka</legend>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = mounted && theme === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                "group relative flex cursor-pointer flex-col text-left rounded-2xl border p-4 transition-all focus-within:ring-2 focus-within:ring-ring",
                isSelected
                  ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/40 dark:bg-primary/[0.06]"
                  : "border-border bg-card/60 hover:border-foreground/20 hover:bg-muted/30",
              )}
            >
              <input
                type="radio"
                name="theme-choice"
                value={option.value}
                checked={isSelected}
                onChange={() => setTheme(option.value)}
                className="sr-only"
              />

              {/* Header inside card */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>
                {isSelected ? (
                  <Badge variant="default" className="gap-1 text-[11px] font-medium">
                    <Check className="size-3" aria-hidden="true" />
                    Aktif
                  </Badge>
                ) : (
                  <span className="size-3 rounded-full border border-muted-foreground/30 group-hover:border-foreground/50" />
                )}
              </div>

              {/* Title & Description */}
              <div className="mt-3.5 space-y-1">
                <p className="font-semibold text-sm tracking-tight text-foreground">
                  {option.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Preview Illustration Mockup */}
              <div className="mt-4 pt-3 border-t border-border/60">
                <ThemePreview value={option.value} />
              </div>
            </label>
          );
        })}
      </fieldset>

      <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
        <Info className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          Pengaturan tema tersinkronisasi secara langsung ke seluruh antarmuka dan tersimpan secara
          lokal di peramban perangkat ini.
        </p>
      </div>
    </div>
  );
}

function ThemePreview({ value }: { value: Theme }) {
  if (value === "light") {
    return (
      <div className="h-16 w-full rounded-lg border border-zinc-200 bg-white p-2 shadow-2xs overflow-hidden flex gap-1.5">
        <div className="w-4 shrink-0 rounded bg-zinc-100 flex flex-col gap-1 p-1">
          <div className="h-1 w-full rounded bg-zinc-300" />
          <div className="h-1 w-2/3 rounded bg-zinc-200" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 justify-between">
          <div className="h-2 w-1/2 rounded bg-zinc-800" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-6 rounded bg-zinc-100 border border-zinc-200 p-1 flex items-end">
              <div className="h-3 w-full rounded-xs bg-emerald-500" />
            </div>
            <div className="h-6 rounded bg-zinc-100 border border-zinc-200 p-1 flex items-end">
              <div className="h-4 w-full rounded-xs bg-blue-500" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (value === "dark") {
    return (
      <div className="h-16 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-2xs overflow-hidden flex gap-1.5">
        <div className="w-4 shrink-0 rounded bg-zinc-900 flex flex-col gap-1 p-1 border border-zinc-800/80">
          <div className="h-1 w-full rounded bg-zinc-700" />
          <div className="h-1 w-2/3 rounded bg-zinc-800" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 justify-between">
          <div className="h-2 w-1/2 rounded bg-zinc-200" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-6 rounded bg-zinc-900 border border-zinc-800 p-1 flex items-end">
              <div className="h-3 w-full rounded-xs bg-emerald-400" />
            </div>
            <div className="h-6 rounded bg-zinc-900 border border-zinc-800 p-1 flex items-end">
              <div className="h-4 w-full rounded-xs bg-blue-400" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // System Preview: Half light, half dark
  return (
    <div className="relative h-16 w-full rounded-lg border border-border overflow-hidden flex shadow-2xs">
      <div className="w-1/2 h-full bg-white p-2 border-r border-zinc-200 flex flex-col justify-between">
        <div className="h-2 w-2/3 rounded bg-zinc-800" />
        <div className="h-5 rounded bg-zinc-100 border border-zinc-200 p-1 flex items-end">
          <div className="h-2.5 w-full rounded-xs bg-emerald-500" />
        </div>
      </div>
      <div className="w-1/2 h-full bg-zinc-950 p-2 flex flex-col justify-between">
        <div className="h-2 w-2/3 rounded bg-zinc-200" />
        <div className="h-5 rounded bg-zinc-900 border border-zinc-800 p-1 flex items-end">
          <div className="h-2.5 w-full rounded-xs bg-blue-400" />
        </div>
      </div>
    </div>
  );
}
