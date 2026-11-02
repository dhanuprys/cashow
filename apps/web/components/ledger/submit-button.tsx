"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** A submit button that disables itself while its server action is running. */
export function SubmitButton({
  children,
  pendingLabel = "Menyimpan…",
  className,
  variant,
  size,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Additional reason to keep the button disabled, e.g. an empty form. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className={className}
      variant={variant}
      size={size}
      disabled={pending || disabled}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
