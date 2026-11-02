import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A link styled as a button, without pretending to be a native `<button>`. */
export function LinkButton({
  href,
  children,
  variant,
  size,
  className,
  prefetch,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
} & VariantProps<typeof buttonVariants> &
  Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
