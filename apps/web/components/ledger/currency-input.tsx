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

    return (
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
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
