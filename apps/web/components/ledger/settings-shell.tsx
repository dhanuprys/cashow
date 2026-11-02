"use client";

import {
  Bell,
  Database,
  History,
  KeyRound,
  SlidersHorizontal,
  Sparkles,
  SunMoon,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SettingsTab =
  | "profile"
  | "ai"
  | "passkey"
  | "appearance"
  | "notifications"
  | "backup"
  | "audit";

interface SettingsSection {
  id: SettingsTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "profile",
    label: "Profil & Buku Kas",
    shortLabel: "Profil",
    icon: SlidersHorizontal,
  },
  {
    id: "ai",
    label: "Model AI",
    shortLabel: "Model AI",
    icon: Sparkles,
  },
  {
    id: "passkey",
    label: "Kunci Masuk & Keamanan",
    shortLabel: "Keamanan",
    icon: KeyRound,
  },
  {
    id: "appearance",
    label: "Tampilan & Privasi",
    shortLabel: "Tampilan",
    icon: SunMoon,
  },
  {
    id: "notifications",
    label: "Notifikasi",
    shortLabel: "Notifikasi",
    icon: Bell,
  },
  {
    id: "backup",
    label: "Pusat Data (Impor & Ekspor)",
    shortLabel: "Data",
    icon: Database,
  },
  {
    id: "audit",
    label: "Riwayat Aktivitas",
    shortLabel: "Aktivitas",
    icon: History,
  },
];

interface SettingsShellProps {
  profileSlot: React.ReactNode;
  aiSlot: React.ReactNode;
  passkeySlot: React.ReactNode;
  appearanceSlot: React.ReactNode;
  notificationsSlot: React.ReactNode;
  backupSlot: React.ReactNode;
  auditSlot: React.ReactNode;
  footerInfo: React.ReactNode;
  aiCount?: number;
}

export function SettingsShell({
  profileSlot,
  aiSlot,
  passkeySlot,
  appearanceSlot,
  notificationsSlot,
  backupSlot,
  auditSlot,
  footerInfo,
  aiCount,
}: SettingsShellProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const tabListRef = useRef<HTMLDivElement>(null);
  const mobileTabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#ai-models" || hash === "#ai") {
        setActiveTab("ai");
      } else if (hash === "#passkey" || hash === "#passkeys" || hash === "#security") {
        setActiveTab("passkey");
      } else if (hash === "#appearance" || hash === "#theme" || hash === "#privacy") {
        setActiveTab("appearance");
      } else if (hash === "#notifications" || hash === "#notif") {
        setActiveTab("notifications");
      } else if (
        hash === "#backup" ||
        hash === "#data" ||
        hash === "#export" ||
        hash === "#import"
      ) {
        setActiveTab("backup");
      } else if (hash === "#audit" || hash === "#activity") {
        setActiveTab("audit");
      } else if (hash === "#profile") {
        setActiveTab("profile");
      }
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  function handleTabClick(id: SettingsTab) {
    setActiveTab(id);
    const targetHash = id === "ai" ? "ai-models" : id;
    window.history.replaceState(null, "", `#${targetHash}`);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      nextIndex = (index + 1) % SETTINGS_SECTIONS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      nextIndex = (index - 1 + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = SETTINGS_SECTIONS.length - 1;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      const target = SETTINGS_SECTIONS[nextIndex];
      handleTabClick(target.id);
      const button = tabListRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex];
      button?.focus();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-8 items-start">
      {/* Mobile Horizontal Pill Selector */}
      <div className="sm:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
        <div
          ref={mobileTabListRef}
          role="tablist"
          aria-label="Pilih bagian pengaturan"
          className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/60 min-w-max"
        >
          {SETTINGS_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeTab === section.id;

            return (
              <button
                key={section.id}
                role="tab"
                type="button"
                id={`mobile-tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${section.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabClick(section.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0",
                  isActive
                    ? "bg-background text-foreground shadow-2xs font-semibold ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{section.shortLabel}</span>
                {section.id === "ai" && typeof aiCount === "number" && aiCount > 0 && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Left Sidebar: Clean vertical list */}
      <aside className="hidden sm:block">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Menu Pengaturan"
          className="flex flex-col gap-1 sticky top-20"
        >
          {SETTINGS_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeTab === section.id;

            return (
              <button
                key={section.id}
                role="tab"
                type="button"
                id={`tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${section.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabClick(section.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-muted text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{section.label}</span>
                </div>

                {section.id === "ai" && typeof aiCount === "number" && aiCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                    {aiCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right Content Column */}
      <div className="min-w-0 space-y-6">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="transition-opacity duration-150"
        >
          {(() => {
            switch (activeTab) {
              case "profile":
                return profileSlot;
              case "ai":
                return aiSlot;
              case "passkey":
                return passkeySlot;
              case "appearance":
                return appearanceSlot;
              case "notifications":
                return notificationsSlot;
              case "backup":
                return backupSlot;
              case "audit":
                return auditSlot;
              default:
                return null;
            }
          })()}
        </div>

        {footerInfo}
      </div>
    </div>
  );
}
