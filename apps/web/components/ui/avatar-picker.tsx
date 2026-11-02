"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { AVATAR_PRESETS, type AvatarPreset } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value?: string | null;
  onChange: (presetId: string) => void;
  className?: string;
}

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const [selected, setSelected] = useState<string>(value || "alex");

  const handleSelect = (preset: AvatarPreset) => {
    setSelected(preset.id);
    onChange(preset.id);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
        {AVATAR_PRESETS.map((preset) => {
          const isSelected = selected === preset.id;
          const SvgComp = preset.render;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset)}
              title={preset.name}
              aria-label={preset.name}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-center rounded-2xl p-1.5 transition-all",
                "hover:scale-105 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/10 shadow-sm"
                  : "bg-muted/40 hover:bg-muted/70",
              )}
            >
              <div className="size-full overflow-hidden rounded-xl">
                <SvgComp className="size-full" />
              </div>
              {isSelected && (
                <div className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                  <Check className="size-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Pilih ilustrasi avatar favorit untuk mewakili identitas buku kas Anda.
      </p>
    </div>
  );
}
