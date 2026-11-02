"use client";

import { List, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ledger/theme-toggle";

const NAV_LINKS = [
  { href: "#simulasi-3d", label: "Simulasi 3D" },
  { href: "#integritas", label: "Integritas" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#transparansi", label: "Transparansi" },
  { href: "#faq", label: "Tanya Jawab" },
];

interface LandingNavProps {
  cta: ReactNode;
}

export function LandingNav({ cta }: LandingNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <header className="fixed top-4 inset-x-0 z-50 mx-auto w-full max-w-5xl px-4">
        <nav
          aria-label="Navigasi Utama"
          className="flex items-center justify-between rounded-full border border-border bg-background/80 px-4 py-2 backdrop-blur-md transition-all duration-300"
        >
          {/* Logo and brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:block">{cta}</div>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            >
              {isOpen ? <X className="size-4.5" /> : <List className="size-4.5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Full screen mobile menu panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi ponsel"
          className="fixed inset-0 z-40 flex flex-col justify-between bg-background/95 px-6 pt-24 pb-8 backdrop-blur-xl md:hidden animate-in fade-in duration-300"
        >
          <div className="flex flex-col gap-6 pt-6">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Navigasi Halaman
            </p>
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map((link, idx) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  style={{
                    animationDelay: `${idx * 60}ms`,
                  }}
                  className="animate-in slide-in-from-bottom-3 fade-in duration-300 text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-1"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <div className="w-full">{cta}</div>
            <p className="text-xs text-muted-foreground text-center">
              Pencatat keuangan pribadi mandiri tanpa pelacak pihak ketiga.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
