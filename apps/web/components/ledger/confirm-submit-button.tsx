"use client";

import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmSubmitButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  children: React.ReactNode;
  /** Confirmation prompt or message */
  message: string;
  /** Optional custom title for the alert dialog. If omitted, derived from message question. */
  dialogTitle?: string;
  /** Optional custom description for the alert dialog. If omitted, derived from message detail. */
  dialogDescription?: string;
  /** Action confirmation button label. Defaults to contextual verb (Hapus, Tutup, Pulihkan, Lanjutkan). */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Batal". */
  cancelLabel?: string;
  /** Action confirmation button variant. Defaults to destructive, or default if trigger variant is default. */
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
}

/**
 * Accessible replacement for native browser window.confirm().
 * Renders a modern shadcn AlertDialog and submits the enclosing <form>
 * upon user confirmation.
 */
export function ConfirmSubmitButton({
  children,
  message,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  cancelLabel = "Batal",
  confirmVariant,
  variant = "destructive",
  size = "sm",
  className,
  disabled = false,
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Derive sensible title and description if not explicitly provided
  let resolvedTitle = dialogTitle;
  let resolvedDescription = dialogDescription;

  if (!resolvedTitle) {
    if (message.includes("?")) {
      const parts = message.split("?");
      resolvedTitle = `${parts[0]?.trim()}?`;
      if (!resolvedDescription) {
        resolvedDescription = parts.slice(1).join("?").trim();
      }
    } else {
      resolvedTitle = "Konfirmasi Tindakan";
    }
  }

  if (!resolvedDescription) {
    resolvedDescription = message.includes("?")
      ? "Apakah Anda yakin ingin melanjutkan tindakan ini?"
      : message;
  }

  // Derive contextual action verb if not explicitly set
  let resolvedConfirmLabel = confirmLabel;
  if (!resolvedConfirmLabel) {
    const textToScan = `${resolvedTitle} ${message}`.toLowerCase();
    if (textToScan.includes("hapus")) {
      resolvedConfirmLabel = "Hapus";
    } else if (textToScan.includes("pulihkan")) {
      resolvedConfirmLabel = "Pulihkan";
    } else if (textToScan.includes("tutup")) {
      resolvedConfirmLabel = "Tutup";
    } else if (textToScan.includes("lepas")) {
      resolvedConfirmLabel = "Lepaskan";
    } else {
      resolvedConfirmLabel = "Lanjutkan";
    }
  }

  const resolvedConfirmVariant =
    confirmVariant ?? (variant === "default" ? "default" : "destructive");

  const handleConfirm = () => {
    const form = triggerRef.current?.form ?? triggerRef.current?.closest("form");
    if (form) {
      setPending(true);
      setOpen(false);
      form.requestSubmit();
    } else {
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            ref={triggerRef}
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={disabled || pending}
            {...props}
          />
        }
      >
        {children}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          <AlertDialogDescription>{resolvedDescription}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={resolvedConfirmVariant}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Memproses…" : resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
