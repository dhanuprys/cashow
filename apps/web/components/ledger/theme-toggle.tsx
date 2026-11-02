"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti sistem", icon: Monitor },
];

/**
 * Three-way theme switch (light / dark / system).
 *
 * Synchronized in real time with the settings page and other tabs via `useTheme`.
 */
export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <fieldset className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
      <legend className="sr-only">Tema tampilan</legend>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "grid size-7 place-items-center rounded-full text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              selected && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </fieldset>
  );
}
