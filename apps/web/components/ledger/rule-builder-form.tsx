"use client";

import { formatMoney, parseMoney } from "@cashow/domain";
import { Code2, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createRuleAction } from "@/lib/actions/ledger";
import { initialActionState } from "@/lib/actions/state";
import { RULE_METRICS, RULE_OPS, RULE_TRIGGERS } from "@/lib/rule-helpers";

export function RuleBuilderForm() {
  const [state, formAction] = useActionState(createRuleAction, initialActionState);
  const [mode, setMode] = useState<"visual" | "json">("visual");

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("transaction");
  const [metric, setMetric] = useState("expenseToday");
  const [op, setOp] = useState("gt");
  const [thresholdInput, setThresholdInput] = useState("150k");
  const [severity, setSeverity] = useState("INFO");

  // Raw JSON state (for advanced mode)
  const [rawTrigger, setRawTrigger] = useState('{"type":"transaction"}');
  const [rawCondition, setRawCondition] = useState(
    '{"metric":"expenseToday","op":"gt","value":150000}',
  );

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

  function applyPreset(preset: {
    name: string;
    description: string;
    trigger: string;
    metric: string;
    op: string;
    threshold: string;
    severity?: string;
  }) {
    setName(preset.name);
    setDescription(preset.description);
    setTriggerType(preset.trigger);
    setMetric(preset.metric);
    setOp(preset.op);
    setThresholdInput(preset.threshold);
    if (preset.severity) setSeverity(preset.severity);
    setMode("visual");
  }

  return (
    <div className="space-y-4">
      {/* Preset pills for quick fill */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-amber-600" />
          <span>Pilih template cepat:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              applyPreset({
                name: "Batas pengeluaran harian 200rb",
                description: "Notifikasi otomatis jika pengeluaran hari ini melebihi Rp200.000",
                trigger: "transaction",
                metric: "expenseToday",
                op: "gt",
                threshold: "200k",
                severity: "WARNING",
              })
            }
          >
            Batas Harian 200rb
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              applyPreset({
                name: "Peringatan saldo menipis",
                description: "Peringatan saat total seluruh saldo akun di bawah Rp500.000",
                trigger: "schedule",
                metric: "totalBalance",
                op: "lt",
                threshold: "500k",
                severity: "ALERT",
              })
            }
          >
            Saldo Rendah &lt; 500rb
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              applyPreset({
                name: "Ada tagihan rencana lewat tempo",
                description: "Deteksi jika ada pembayaran atau invoice rencana tertunggak",
                trigger: "schedule",
                metric: "overduePlanCount",
                op: "gt",
                threshold: "0",
                severity: "WARNING",
              })
            }
          >
            Rencana Terlambat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              applyPreset({
                name: "Pengeluaran bulanan capai 5jt",
                description: "Peringatan ketika pengeluaran bulan ini menyentuh Rp5.000.000",
                trigger: "transaction",
                metric: "expenseMonth",
                op: "gte",
                threshold: "5jt",
                severity: "INFO",
              })
            }
          >
            Pengeluaran Bulanan 5jt
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Buat aturan baru</CardTitle>
              <CardDescription>
                Tentukan kondisi otomatis untuk memicu peringatan keuangan.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (mode === "visual") {
                  setRawTrigger(generatedTrigger);
                  setRawCondition(generatedCondition);
                  setMode("json");
                } else {
                  setMode("visual");
                }
              }}
              className="text-xs text-muted-foreground"
            >
              <Code2 className="mr-1 size-3.5" />
              {mode === "visual" ? "Mode JSON" : "Mode Visual"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {mode === "visual" ? (
              <>
                <input type="hidden" name="trigger" value={generatedTrigger} />
                <input type="hidden" name="condition" value={generatedCondition} />
                <input type="hidden" name="severity" value={severity} />

                <div>
                  <FieldLabel htmlFor="rule-name">Nama aturan</FieldLabel>
                  <Input
                    id="rule-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Batas belanja harian 150rb"
                    required
                    maxLength={120}
                    className="mt-1.5"
                  />
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Kondisi Otomatis
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="rule-trigger-select" className="text-xs">
                        Kapan dievaluasi?
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
                      <FieldLabel htmlFor="rule-metric-select" className="text-xs">
                        Metrik yang dipantau
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
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="rule-op-select" className="text-xs">
                        Kondisi perbandingan
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

                    <div>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="rule-threshold-input" className="text-xs">
                          {metricInfo.unit === "money"
                            ? "Nilai target (bisa 100k, 2jt)"
                            : metricInfo.unit === "hours"
                              ? "Jumlah jam"
                              : "Jumlah target"}
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

                  {/* Summary sentence preview */}
                  <div className="rounded-lg bg-background p-2.5 text-xs text-muted-foreground border">
                    <span className="font-semibold text-foreground">Pratinjau: </span>
                    Peringatkan saat{" "}
                    <span className="font-medium text-foreground">{metricInfo.label}</span>{" "}
                    {RULE_OPS[op]?.label.toLowerCase()} (
                    <span className="font-mono">{RULE_OPS[op]?.symbol}</span>){" "}
                    <span className="font-semibold text-foreground">
                      {metricInfo.unit === "money" && parsedThreshold !== null
                        ? formatMoney(parsedThreshold)
                        : thresholdInput}
                    </span>
                    .
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="rule-severity-select" className="text-xs">
                      Tingkat keparahan (Severity)
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
                  <div>
                    <FieldLabel htmlFor="rule-desc" className="text-xs">
                      Keterangan tambahan (opsional)
                    </FieldLabel>
                    <Input
                      id="rule-desc"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Contoh: Mengingatkan agar hemat saat akhir bulan"
                      maxLength={500}
                      className="mt-1"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Raw JSON Developer Mode */
              <>
                <div>
                  <FieldLabel htmlFor="rule-name-json">Nama aturan</FieldLabel>
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
                    rows={3}
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
                    rows={4}
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
              </>
            )}

            {state.status === "error" && (
              <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {state.message}
              </p>
            )}

            <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <SubmitButton>Simpan Aturan</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
