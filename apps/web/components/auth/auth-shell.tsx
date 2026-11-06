import Image from "next/image";
import Link from "next/link";
import type React from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footerLink,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerLink?: {
    href: string;
    label: string;
    actionText: string;
  };
}) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-20 selection:bg-primary/20 selection:text-foreground">
      {/* Subtle radial backdrop glow */}
      <div
        className="pointer-events-none absolute -top-16 inset-x-0 -z-10 flex justify-center overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-72 w-96 rounded-full bg-primary/10 blur-[90px] dark:bg-primary/15" />
      </div>

      <section className="w-full max-w-md">
        {/* Top brand identity link */}
        <div className="flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Kembali ke halaman utama Cashow"
          >
            <Image
              src="/logo.png"
              alt="Logo Cashow"
              width={28}
              height={28}
              className="size-7 shrink-0"
              priority
            />
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              Cashow
            </span>
          </Link>
        </div>

        {/* Page header */}
        <div className="mt-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {subtitle}
          </p>
        </div>

        {/* Main form surface */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          {children}
        </div>

        {/* Optional footer transition link */}
        {footerLink && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            {footerLink.label}{" "}
            <Link
              href={footerLink.href}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {footerLink.actionText}
            </Link>
          </p>
        )}

        {/* Trust signal microcopy */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Kedaulatan data finansial seutuhnya di tanganmu. Bebas pelacak komersial.
        </p>
      </section>
    </main>
  );
}
