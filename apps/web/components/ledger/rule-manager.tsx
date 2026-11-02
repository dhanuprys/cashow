"use client";

import { Bell, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { RuleBuilderModal } from "@/components/ledger/rule-builder-modal";
import { RuleCardItem, type RuleItem } from "@/components/ledger/rule-card-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RuleManagerProps {
  rules: RuleItem[];
  timezone?: string;
}

export function RuleManager({ rules, timezone }: RuleManagerProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | undefined>(undefined);

  const activeCount = useMemo(() => rules.filter((r) => r.active).length, [rules]);
  const pausedCount = rules.length - activeCount;

  // Filter rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (activeTab === "ACTIVE" && !rule.active) return false;
      if (activeTab === "PAUSED" && rule.active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = rule.name.toLowerCase().includes(q);
        const matchesDesc = rule.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [rules, activeTab, searchQuery]);

  function handleOpenCreate() {
    setEditingRule(undefined);
    setDialogOpen(true);
  }

  function handleOpenEdit(rule: RuleItem) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Subheader and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 -mt-2">
        <p className="text-sm text-muted-foreground">
          {activeCount} aturan aktif dari {rules.length} aturan terpasang.
        </p>

        <Button
          type="button"
          onClick={handleOpenCreate}
          size="sm"
          className="gap-1.5 cursor-pointer w-full sm:w-auto"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Tambah Aturan
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aturan keuangan…"
                className="pl-9 w-full"
                aria-label="Cari aturan"
              />
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "ALL"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Semua ({rules.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ACTIVE")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "ACTIVE"
                    ? "bg-background text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Aktif ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PAUSED")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  activeTab === "PAUSED"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Dijeda ({pausedCount})
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <SlidersHorizontal
                className="size-8 stroke-[1.5] text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-foreground">
                {searchQuery || activeTab !== "ALL"
                  ? "Tidak ada aturan yang cocok"
                  : "Belum ada aturan aktif"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {searchQuery || activeTab !== "ALL"
                  ? "Coba ubah kata kunci pencarian atau sesuaikan filter status."
                  : "Pasang batas belanja harian, bulanan, atau peringatan saldo menipis untuk menjaga cashflow Anda."}
              </p>
              {!searchQuery && activeTab === "ALL" && (
                <Button type="button" size="sm" onClick={handleOpenCreate} className="mt-3 gap-1.5">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Buat Aturan Pertama
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredRules.map((rule) => (
            <RuleCardItem key={rule.id} rule={rule} timezone={timezone} onEdit={handleOpenEdit} />
          ))
        )}
      </div>

      {/* Builder Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-xl max-h-[min(92dvh,720px)] sm:rounded-xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Bell className="size-4 sm:size-5 text-primary shrink-0" aria-hidden="true" />
              <span>
                {editingRule ? `Ubah Aturan: ${editingRule.name}` : "Pasang Aturan Keuangan Baru"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingRule
                ? "Perbarui kondisi pemicu, target nominal, atau tingkat peringatan."
                : "Pilih template siap pakai atau rangkai kondisi otomatis sesuai kebutuhan."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <RuleBuilderModal
              key={editingRule?.id ?? "new"}
              rule={editingRule}
              onSuccess={() => setDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
