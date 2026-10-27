"use client";

import { Button } from "@/components/ui/button";

/** Submit a destructive server action only after an explicit confirmation. */
export function ConfirmSubmitButton({
  children,
  message,
  variant = "destructive",
  size = "sm",
}: {
  children: React.ReactNode;
  message: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
