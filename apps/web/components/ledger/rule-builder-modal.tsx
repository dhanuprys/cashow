"use client";

import { formatMoney, parseMoney } from "@cashow/domain";
import { AlertCircle, Bell, Clock, Code2, Sparkles, Zap } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { createRuleAction, updateRuleAction } from "@/lib/actions/ledger";
import { initialActionState } from "@/lib/actions/state";
import { RULE_METRICS, RULE_OPS, RULE_TRIGGERS } from "@/lib/rule-helpers";
import type { RuleItem } from "./rule-card-item";

const TEMPLATES = [
  {
    id: "daily-expense",
    title: "Batas Belanja Harian",
    desc: "Peringatan saat pengeluaran hari ini melebihi nominal tertentu",
    name: "Batas pengeluaran harian 200rb",
    description: "Notifikasi otomatis jika pengeluaran hari ini melebihi Rp200.000",
    trigger: "transaction",
    metric: "expenseToday",
    op: "gt",
    threshold: "200k",
    severity: "WARNING",
  },
  {
    id: "low-balance",
    title: "Saldo Rekening Menipis",
    desc: "Peringatan jika total saldo semua akun di bawah batas aman",
    name: "Peringatan saldo menipis",
    description: "Peringatan saat total seluruh saldo akun di bawah Rp500.000",
    trigger: "schedule",
    metric: "totalBalance",
    op: "lt",
    threshold: "500k",
    severity: "ALERT",
  },
  {
    id: "monthly-expense",
    title: "Batas Belanja Bulanan",
    desc: "Kawal anggaran bulanan agar tidak overbudget",
    name: "Pengeluaran bulanan capai 5jt",
    description: "Peringatan ketika pengeluaran bulan ini menyentuh Rp5.000.000",
    trigger: "transaction",
    metric: "expenseMonth",
    op: "gte",
    threshold: "5jt",
    severity: "WARNING",
  },
  {
    id: "overdue-plan",
    title: "Tagihan Rencana Tertunggak",
    desc: "Ingatkan jika ada pembayaran rencana yang melewati jatuh tempo",
    name: "Ada tagihan rencana lewat tempo",
    description: "Deteksi jika ada pembayaran atau invoice rencana tertunggak",
    trigger: "schedule",
    metric: "overduePlanCount",
    op: "gt",
    threshold: "0",
    severity: "WARNING",
  },
];

interface RuleBuilderModalProps {
  rule?: RuleItem;
  onSuccess?: () => void;
}

export function RuleBuilderModal({ rule, onSuccess }: RuleBuilderModalProps) {
  const isEditing = rule !== undefined;

  // Extract initial values from existing rule if present
  const initialTriggerType = (rule?.trigger as { type?: string })?.type ?? "transaction";
  const conditionObj = (rule?.condition ?? {}) as {
    metric?: string;
    op?: string;
    value?: number;
  };
  const settingsObj = (rule?.settings ?? {}) as {
    severity?: string;
    cooldownMinutes?: number;
  };

  const initialMetric = conditionObj.metric ?? "expenseToday";
  const initialOp = conditionObj.op ?? "gt";
  const initialThreshold = conditionObj.value !== undefined ? String(conditionObj.value) : "150k";
  const initialSeverity = settingsObj.severity ?? "WARNING";

  const [state, formAction] = useActionState(
    isEditing ? updateRuleAction : createRuleAction,
    initialActionState,
  );
  const [mode, setMode] = useState<"visual" | "json">("visual");

  // Form states
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [triggerType, setTriggerType] = useState(initialTriggerType);
  const [metric, setMetric] = useState(initialMetric);
  const [op, setOp] = useState(initialOp);
  const [thresholdInput, setThresholdInput] = useState(initialThreshold);
  const [severity, setSeverity] = useState(initialSeverity);

  // Raw JSON state (for advanced dev mode)
  const [rawTrigger, setRawTrigger] = useState(
    JSON.stringify(rule?.trigger ?? { type: initialTriggerType }, null, 2),
  );
  const [rawCondition, setRawCondition] = useState(
    JSON.stringify(
      rule?.condition ?? {
        metric: initialMetric,
        op: initialOp,
        value: 150000,
      },
      null,
      2,
    ),
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: isEditing ? "Aturan Diperbarui" : "Aturan Dibuat",
      description: isEditing
        ? "Perubahan aturan otomatis berhasil disimpan."
        : "Aturan otomatis baru telah aktif.",
    });
    onSuccess?.();
  }, [state, isEditing, onSuccess]);

  const parsedThreshold = parseMoney(thresholdInput);
  const metricInfo = RULE_METRICS[metric] ?? {
    label: metric,
    unit: "money",
    description: "",
  };

  // Derive generated JSON
  const generatedTrigger = JSON.stringify({ type: triggerType });
  const generatedThresholdNumber =
    metricInfo.unit === "money"
      ? parsedThreshold !== null
        ? Number(parsedThreshold)
        : 0
      : Number(thresholdInput) || 0;

  const generatedCondition = JSON.stringify({
    metric,
    op,
    value: generatedThresholdNumber,
  });

  function applyTemplate(tpl: (typeof TEMPLATES)[number]) {
    setName(tpl.name);
    setDescription(tpl.description);
    setTriggerType(tpl.trigger);
    setMetric(tpl.metric);
    setOp(tpl.op);
    setThresholdInput(tpl.threshold);
    setSeverity(tpl.severity);
    setMode("visual");
  }

  return (
    <div className="space-y-4">
      {/* Template cards (only show if creating fresh rule) */}
      {!isEditing && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Sparkles className="size-3.5 text-amber-500" aria-hidden="true" />
            <span>Pilih Template Cepat</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="group flex flex-col text-left p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 hover:border-border transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tpl.title}
                  </span>
                  <Zap className="size-3 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0 ml-1.5" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1 leading-snug">
                  {tpl.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Form */}
      <form action={formAction} className="space-y-4">
        {isEditing && <input type="hidden" name="ruleId" value={rule.id} />}
        <input type="hidden" name="active" value={rule?.active !== false ? "true" : "false"} />

        <div className="flex items-center justify-between">
          <FieldLabel
            htmlFor="rule-name"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Detail Aturan
          </FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              if (mode === "visual") {
                setRawTrigger(generatedTrigger);
                setRawCondition(generatedCondition);
                setMode("json");
              } else {
                setMode("visual");
              }
            }}
            className="text-[11px] text-muted-foreground h-7 gap-1"
          >
            <Code2 className="size-3" />
            {mode === "visual" ? "Mode JSON" : "Mode Visual"}
          </Button>
        </div>

        {mode === "visual" ? (
          <>
            <input type="hidden" name="trigger" value={generatedTrigger} />
            <input type="hidden" name="condition" value={generatedCondition} />
            <input type="hidden" name="severity" value={severity} />

            <div>
              <FieldLabel htmlFor="rule-name">Nama Aturan</FieldLabel>
              <Input
                id="rule-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Batas belanja harian 200rb"
                required
                maxLength={120}
                className="mt-1.5"
              />
            </div>

            {/* Natural Sentence Condition Builder */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kapan Aturan Ini Berjalan?
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3 text-primary" aria-hidden="true" />
                  Evaluasi Otomatis
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="rule-trigger-select" className="text-xs">
                    Waktu Pengecekan
                  </FieldLabel>
                  <NativeSelect
                    id="rule-trigger-select"
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value)}
                    className="mt-1 w-full text-sm"
                  >
                    {Object.entries(RULE_TRIGGERS).map(([key, item]) => (
                      <NativeSelectOption key={key} value={key}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div>
                  <FieldLabel htmlFor="rule-severity-select" className="text-xs">
                    Tingkat Peringatan
                  </FieldLabel>
                  <NativeSelect
                    id="rule-severity-select"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="mt-1 w-full text-sm"
                  >
                    <NativeSelectOption value="INFO">Info (Normal)</NativeSelectOption>
                    <NativeSelectOption value="WARNING">Peringatan (Warning)</NativeSelectOption>
                    <NativeSelectOption value="ALERT">Bahaya (Kritis / Alert)</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Kondisi Pemicu
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <FieldLabel htmlFor="rule-metric-select" className="text-xs">
                      Yang Dipantau
                    </FieldLabel>
                    <NativeSelect
                      id="rule-metric-select"
                      value={metric}
                      onChange={(e) => {
                        setMetric(e.target.value);
                        if (RULE_METRICS[e.target.value]?.unit === "count") {
                          setThresholdInput("0");
                        }
                      }}
                      className="mt-1 w-full text-sm"
                    >
                      {Object.entries(RULE_METRICS).map(([key, item]) => (
                        <NativeSelectOption key={key} value={key}>
                          {item.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="sm:col-span-1">
                    <FieldLabel htmlFor="rule-op-select" className="text-xs">
                      Kondisi
                    </FieldLabel>
                    <NativeSelect
                      id="rule-op-select"
                      value={op}
                      onChange={(e) => setOp(e.target.value)}
                      className="mt-1 w-full text-sm"
                    >
                      {Object.entries(RULE_OPS).map(([key, item]) => (
                        <NativeSelectOption key={key} value={key}>
                          {item.label} ({item.symbol})
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="rule-threshold-input" className="text-xs">
                        {metricInfo.unit === "money"
                          ? "Target Nominal"
                          : metricInfo.unit === "hours"
                            ? "Jumlah Jam"
                            : "Jumlah"}
                      </FieldLabel>
                      {metricInfo.unit === "money" && parsedThreshold !== null && (
                        <span className="text-[11px] font-medium text-primary tabular-nums">
                          {formatMoney(parsedThreshold)}
                        </span>
                      )}
                    </div>
                    {metricInfo.unit === "money" ? (
                      <CurrencyInput
                        id="rule-threshold-input"
                        value={thresholdInput}
                        onValueChange={setThresholdInput}
                        placeholder="150k atau 150.000"
                        className="mt-1"
                        required
                      />
                    ) : (
                      <Input
                        id="rule-threshold-input"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                        placeholder="1"
                        className="mt-1"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Natural Sentence Preview Box */}
              <div className="rounded-lg bg-background p-3 text-xs border border-border/80 flex items-start gap-2 shadow-2xs">
                <Bell className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">Ringkasan: </strong>
                  Beri peringatan saat{" "}
                  <strong className="text-foreground">{metricInfo.label}</strong>{" "}
                  {RULE_OPS[op]?.label.toLowerCase()} (
                  <span className="font-mono">{RULE_OPS[op]?.symbol}</span>){" "}
                  <strong className="text-primary font-semibold">
                    {metricInfo.unit === "money" && parsedThreshold !== null
                      ? formatMoney(parsedThreshold)
                      : thresholdInput}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="rule-desc">Keterangan Tambahan (Opsional)</FieldLabel>
              <Input
                id="rule-desc"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Mengingatkan pengeluaran saat akhir pekan"
                maxLength={500}
                className="mt-1.5"
              />
            </div>
          </>
        ) : (
          /* Raw JSON Developer Mode */
          <div className="space-y-3">
            <div>
              <FieldLabel htmlFor="rule-name-json">Nama Aturan</FieldLabel>
              <Input
                id="rule-name-json"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                className="mt-1"
              />
            </div>
            <div>
              <FieldLabel htmlFor="rule-trigger-raw">Trigger (JSON)</FieldLabel>
              <textarea
                id="rule-trigger-raw"
                name="trigger"
                value={rawTrigger}
                onChange={(e) => setRawTrigger(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="rule-condition-raw">Kondisi (JSON)</FieldLabel>
              <textarea
                id="rule-condition-raw"
                name="condition"
                value={rawCondition}
                onChange={(e) => setRawCondition(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="rule-desc-json">Keterangan</FieldLabel>
              <Input
                id="rule-desc-json"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{state.message}</span>
          </p>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 sm:-mb-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none flex justify-end">
          <SubmitButton className="w-full sm:w-auto h-10 sm:h-9 text-sm font-medium">
            {isEditing ? "Simpan Perubahan" : "Pasang Aturan"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
