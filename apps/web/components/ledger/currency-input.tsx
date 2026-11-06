"use client";

import { formatAmount, parseMoney } from "@cashow/domain";
import { type ChangeEvent, type FocusEvent, forwardRef, useEffect, useId, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (plainAmount: string) => void;
  currencyPrefix?: string;
  allowShorthand?: boolean;
  /**
   * If true, displays quick preset chips (e.g. +10rb, +50rb, +100rb, +500rb)
   * or a custom array of presets like ["10000", "50000", "100000"].
   */
  presets?: boolean | string[];
  /**
   * If true, tapping a preset adds to the current amount instead of replacing it.
   * Defaults to false (replaces value).
   */
  additivePresets?: boolean;
}

const DEFAULT_PRESETS = ["10000", "20000", "50000", "100000", "500000"];

function formatPresetLabel(amountStr: string): string {
  try {
    const val = BigInt(amountStr);
    if (val >= 1_000_000n && val % 1_000_000n === 0n) {
      return `${val / 1_000_000n}jt`;
    }
    if (val >= 1_000n && val % 1_000n === 0n) {
      return `${val / 1_000n}rb`;
    }
    return formatAmount(val);
  } catch {
    return amountStr;
  }
}

/**
 * Currency input with Shadcn UI styling (InputGroup + Rp prefix) that automatically
 * formats numbers with thousand separators (e.g. 1.500.000) while preserving Indonesian
 * natural shorthand typing (e.g. 50k, 35rb, 1,5jt).
 *
 * It syncs a hidden input with the exact unformatted value for clean Server Action / FormData integration.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      id,
      name,
      value: controlledValue,
      defaultValue,
      onValueChange,
      currencyPrefix = "Rp",
      allowShorthand = true,
      presets,
      additivePresets = false,
      className,
      placeholder = "0",
      disabled,
      required,
      onBlur,
      onFocus,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    // Internal value holds the actual raw/unformatted amount string (e.g. "1500000" or "50k")
    const isControlled = controlledValue !== undefined;
    const initialRaw = (isControlled ? controlledValue : defaultValue) ?? "";

    const [rawValue, setRawValue] = useState<string>(initialRaw);
    const [displayValue, setDisplayValue] = useState<string>(() => {
      if (!initialRaw.trim()) return "";
      const parsed = parseMoney(initialRaw);
      return parsed !== null ? formatAmount(parsed) : initialRaw;
    });
    const [isFocused, setIsFocused] = useState(false);

    // Synchronize when controlledValue changes from parent
    useEffect(() => {
      if (controlledValue === undefined) return;
      setRawValue(controlledValue);
      if (!isFocused) {
        if (!controlledValue.trim()) {
          setDisplayValue("");
        } else {
          const parsed = parseMoney(controlledValue);
          setDisplayValue(parsed !== null ? formatAmount(parsed) : controlledValue);
        }
      }
    }, [controlledValue, isFocused]);

    function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
      const inputVal = event.target.value;

      if (!inputVal.trim()) {
        setDisplayValue("");
        setRawValue("");
        onValueChange?.("");
        return;
      }

      // If shorthand is enabled and user is typing characters like k, rb, jt
      const hasShorthand = /[a-z]/i.test(inputVal);
      if (allowShorthand && hasShorthand) {
        setDisplayValue(inputVal);
        const parsed = parseMoney(inputVal);
        const canonical = parsed !== null ? parsed.toString() : inputVal;
        setRawValue(canonical);
        onValueChange?.(canonical);
        return;
      }

      // If purely numeric with optional dots/commas:
      // Strip everything except digits and negative sign
      const cleanDigits = inputVal.replace(/[^\d-]/g, "");
      if (cleanDigits === "" || cleanDigits === "-") {
        setDisplayValue(cleanDigits);
        setRawValue(cleanDigits);
        onValueChange?.(cleanDigits);
        return;
      }

      try {
        const bigVal = BigInt(cleanDigits);
        const formatted = formatAmount(bigVal);
        setDisplayValue(formatted);
        const raw = bigVal.toString();
        setRawValue(raw);
        onValueChange?.(raw);
      } catch {
        setDisplayValue(inputVal);
        setRawValue(cleanDigits);
        onValueChange?.(cleanDigits);
      }
    }

    function handleInputBlur(event: FocusEvent<HTMLInputElement>) {
      setIsFocused(false);
      // On blur, format to canonical Indonesian currency format
      if (rawValue.trim() !== "") {
        const parsed = parseMoney(rawValue);
        if (parsed !== null) {
          setDisplayValue(formatAmount(parsed));
          setRawValue(parsed.toString());
          onValueChange?.(parsed.toString());
        }
      }
      onBlur?.(event);
    }

    function handleInputFocus(event: FocusEvent<HTMLInputElement>) {
      setIsFocused(true);
      onFocus?.(event);
    }

    const presetList = Array.isArray(presets) ? presets : presets === true ? DEFAULT_PRESETS : null;

    function applyPreset(presetAmount: string) {
      if (disabled) return;
      try {
        const presetVal = BigInt(presetAmount);
        let finalVal = presetVal;

        if (additivePresets) {
          const currentVal = rawValue ? BigInt(rawValue) : 0n;
          finalVal = currentVal + presetVal;
        }

        const raw = finalVal.toString();
        const formatted = formatAmount(finalVal);
        setRawValue(raw);
        setDisplayValue(formatted);
        onValueChange?.(raw);
      } catch {
        setRawValue(presetAmount);
        setDisplayValue(presetAmount);
        onValueChange?.(presetAmount);
      }
    }

    return (
      <div className="w-full space-y-1.5">
        <InputGroup
          className={cn(
            "w-full transition-shadow",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
        >
          {currencyPrefix ? (
            <InputGroupAddon
              align="inline-start"
              className="pr-1 font-semibold text-xs tracking-wider"
            >
              <InputGroupText>{currencyPrefix}</InputGroupText>
            </InputGroupAddon>
          ) : null}
          <InputGroupInput
            {...props}
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className="font-mono tabular-nums"
          />
          {/* Hidden input to ensure FormData / form submission receives the exact clean unformatted integer */}
          {name ? <input type="hidden" name={name} value={rawValue} disabled={disabled} /> : null}
        </InputGroup>

        {presetList && presetList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {presetList.map((preset) => {
              const label = formatPresetLabel(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "inline-flex items-center rounded-lg border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {additivePresets ? `+${label}` : label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
