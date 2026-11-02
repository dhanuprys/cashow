"use client";

import { Eye, EyeOff, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIVACY_STORAGE_KEY = "cashow-hide-balances";

export function PrivacySettingsCard() {
  const [hideBalances, setHideBalances] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
    setHideBalances(stored === "true");
    setMounted(true);

    const onPrivacyChange = () => {
      const current = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
      setHideBalances(current === "true");
    };

    window.addEventListener("cashow-privacy-change", onPrivacyChange);
    window.addEventListener("storage", onPrivacyChange);
    return () => {
      window.removeEventListener("cashow-privacy-change", onPrivacyChange);
      window.removeEventListener("storage", onPrivacyChange);
    };
  }, []);

  function togglePrivacy() {
    const nextState = !hideBalances;
    setHideBalances(nextState);
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, String(nextState));
    window.dispatchEvent(new Event("cashow-privacy-change"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {hideBalances ? (
              <EyeOff className="size-4.5" aria-hidden="true" />
            ) : (
              <Eye className="size-4.5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Samarkan Angka Saldo (Mode Privasi)
              </p>
              {mounted && hideBalances && (
                <Badge variant="default" className="text-[10px] font-medium">
                  Aktif
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sembunyikan nominal saldo akun pada ringkasan dasbor agar tidak terbaca oleh orang
              lain saat Anda membuka aplikasi di tempat umum.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={hideBalances}
          onClick={togglePrivacy}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring self-start sm:self-center",
            hideBalances ? "bg-primary" : "bg-muted",
          )}
        >
          <span className="sr-only">Aktifkan samarkan saldo</span>
          <span
            className={cn(
              "pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
              hideBalances ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {/* Live Preview Box */}
      <div className="rounded-xl border border-border/60 bg-card p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="size-3.5 text-primary" aria-hidden="true" />
          <span>Pratinjau tampilan saldo:</span>
        </div>
        <span className="font-mono font-semibold text-foreground">
          {hideBalances ? "Rp ••••••••" : "Rp 24.500.000"}
        </span>
      </div>
    </div>
  );
}
