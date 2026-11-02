"use client";

import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A date input that uses the OS date wheel on phones (via a native
 * `<input type="date">`) and a calendar popover on desktop, while keeping a
 * single hidden field that carries the `YYYY-MM-DD` value for form submission.
 *
 * Native date inputs are the better mobile UX; the calendar is the better
 * desktop browsing experience, so we show the right one per breakpoint.
 */
export function DatePicker({
  name,
  defaultValue,
  ariaLabel,
  className,
  id,
}: {
  name: string;
  defaultValue?: string;
  ariaLabel: string;
  className?: string;
  id?: string;
}) {
  const [date, setDate] = useState<Date | undefined>(() => {
    if (defaultValue === undefined || defaultValue === "") return undefined;
    const parsed = parseISO(defaultValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  });

  const valueStr = date === undefined ? "" : format(date, "yyyy-MM-dd");

  return (
    <div className={cn("w-full", className)}>
      <input type="hidden" name={name} value={valueStr} />
      <Input
        type="date"
        id={id}
        value={valueStr}
        onChange={(event) => {
          const next = event.target.value;
          setDate(next === "" ? undefined : parseISO(next));
        }}
        aria-label={ariaLabel}
        className="md:hidden"
      />
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-normal"
              />
            }
          >
            <CalendarDays data-icon="inline-start" />
            {date === undefined
              ? "Pilih tanggal"
              : format(date, "d MMMM yyyy", { locale: idLocale })}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(next) => setDate(next)}
              locale={idLocale}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
