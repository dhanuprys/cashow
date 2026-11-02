"use client";

import { PROVIDER_MODELS } from "@cashow/domain";
import type { AiProviderSummary, AiProviderType } from "@cashow/services";
import {
  Bot,
  Check,
  CheckCircle2,
  CopyPlus,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import {
  deleteAiProviderConfigAction,
  saveAiProviderConfigAction,
  setDefaultAiProviderConfigAction,
} from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

const PROVIDER_INFO: Record<
  AiProviderType,
  {
    label: string;
    badgeVariant: "default" | "secondary" | "outline";
    defaultModel: string;
    defaultBaseUrl: string;
    docsUrl: string;
    keyPlaceholder: string;
    requiresBaseUrl: boolean;
  }
> = {
  DEEPSEEK: {
    label: "DeepSeek",
    badgeVariant: "secondary",
    defaultModel: "deepseek-v4-flash",
    defaultBaseUrl: "https://api.deepseek.com",
    docsUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
    requiresBaseUrl: false,
  },
  GOOGLE: {
    label: "Google AI Studio",
    badgeVariant: "outline",
    defaultModel: "gemini-flash-latest",
    defaultBaseUrl: "",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIzaSy...",
    requiresBaseUrl: false,
  },
  OPENAI: {
    label: "ChatGPT (OpenAI)",
    badgeVariant: "default",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    requiresBaseUrl: false,
  },
  OPENAI_COMPATIBLE: {
    label: "OpenAI Compatible",
    badgeVariant: "outline",
    defaultModel: "",
    defaultBaseUrl: "https://api.omniroute.ai/v1",
    docsUrl: "",
    keyPlaceholder: "sk-... atau token proxy",
    requiresBaseUrl: true,
  },
};

interface TestResult {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
  latencyMs?: number;
  model?: string;
}

export function AiModelManager({ configs }: { configs: AiProviderSummary[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiProviderSummary | null>(null);
  const [copySourceId, setCopySourceId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>("DEEPSEEK");
  const [selectedModelPreset, setSelectedModelPreset] = useState<string>(
    PROVIDER_INFO.DEEPSEEK.defaultModel,
  );
  const [customModelsList, setCustomModelsList] = useState<string[]>([]);
  const [newCustomModelInput, setNewCustomModelInput] = useState<string>("");
  const [baseUrlInput, setBaseUrlInput] = useState(PROVIDER_INFO.DEEPSEEK.defaultBaseUrl);
  const [showApiKey, setShowApiKey] = useState(false);
  // Remounts the form so uncontrolled fields pick up the current defaults.
  const [formKey, setFormKey] = useState(0);

  // Per-config testing state for immediate client-side feedback
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const [saveState, saveAction] = useActionState<ActionState, FormData>(
    saveAiProviderConfigAction,
    initialActionState,
  );

  const isEditing = editing !== null;
  const providerConfigs = configs.filter((c) => c.provider === selectedProvider);

  useEffect(() => {
    if (saveState.status === "success") {
      toast.add({
        title: "Tersimpan",
        description: saveState.message ?? "Model AI berhasil disimpan.",
      });
      setDialogOpen(false);
    } else if (saveState.status === "error" && saveState.message) {
      toast.add({ title: "Gagal", description: saveState.message });
    }
  }, [saveState]);

  async function runConnectivityTest(config: AiProviderSummary) {
    setTestingId(config.id);
    setTestResults((prev) => ({
      ...prev,
      [config.id]: { status: "testing" },
    }));

    try {
      const res = await fetch("/api/chat/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: config.id }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        model?: string;
        latencyMs?: number;
        reply?: string;
      };

      if (res.ok && data.ok) {
        setTestResults((prev) => ({
          ...prev,
          [config.id]: {
            status: "success",
            latencyMs: data.latencyMs,
            model: data.model,
            message: `Koneksi aktif (${data.latencyMs}ms)`,
          },
        }));
        toast.add({
          title: "Koneksi Berhasil",
          description: `${config.name} (${data.model}) merespons dalam ${data.latencyMs} ms.`,
        });
      } else {
        const errorMsg = data.error || "Gagal menghubungkan ke model AI.";
        setTestResults((prev) => ({
          ...prev,
          [config.id]: {
            status: "error",
            message: errorMsg,
          },
        }));
        toast.add({
          title: "Koneksi Gagal",
          description: errorMsg,
        });
      }
    } catch (err) {
      const fallbackMsg = err instanceof Error ? err.message : "Jaringan bermasalah.";
      setTestResults((prev) => ({
        ...prev,
        [config.id]: {
          status: "error",
          message: fallbackMsg,
        },
      }));
      toast.add({
        title: "Koneksi Gagal",
        description: fallbackMsg,
      });
    } finally {
      setTestingId(null);
    }
  }

  function resetForm(provider: AiProviderType) {
    setSelectedProvider(provider);
    setCopySourceId("");
    setSelectedModelPreset(PROVIDER_INFO[provider].defaultModel);
    setCustomModelsList([]);
    setNewCustomModelInput("");
    setBaseUrlInput(PROVIDER_INFO[provider].defaultBaseUrl);
    setShowApiKey(false);
    setFormKey((key) => key + 1);
  }

  function openCreate() {
    setEditing(null);
    setCopySourceId("");
    resetForm("DEEPSEEK");
    setDialogOpen(true);
  }

  function openDuplicate(source: AiProviderSummary) {
    setEditing(null);
    setSelectedProvider(source.provider);
    setCopySourceId(source.id);
    setSelectedModelPreset(source.model || PROVIDER_INFO[source.provider].defaultModel);
    setCustomModelsList([...(source.customModels ?? [])]);
    setNewCustomModelInput("");
    setBaseUrlInput(source.baseUrl ?? PROVIDER_INFO[source.provider].defaultBaseUrl);
    setShowApiKey(false);
    setFormKey((key) => key + 1);
    setDialogOpen(true);
  }

  function openEdit(config: AiProviderSummary) {
    setEditing(config);
    setCopySourceId("");
    setSelectedProvider(config.provider);
    setSelectedModelPreset(config.model || PROVIDER_INFO[config.provider].defaultModel);
    setCustomModelsList([...(config.customModels ?? [])]);
    setNewCustomModelInput("");
    setBaseUrlInput(config.baseUrl ?? PROVIDER_INFO[config.provider].defaultBaseUrl);
    setShowApiKey(false);
    setFormKey((key) => key + 1);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (open) {
      // Opening from the trigger always starts a fresh "create" form.
      if (editing === null && copySourceId === "") resetForm("DEEPSEEK");
    } else {
      setEditing(null);
      setCopySourceId("");
    }
    setDialogOpen(open);
  }

  function handleProviderChange(newProvider: AiProviderType) {
    setSelectedProvider(newProvider);
    setCopySourceId("");
    setSelectedModelPreset(PROVIDER_INFO[newProvider].defaultModel);
    setCustomModelsList([]);
    setNewCustomModelInput("");
    setBaseUrlInput(PROVIDER_INFO[newProvider].defaultBaseUrl);
  }

  function addCustomModel() {
    const trimmed = newCustomModelInput.trim();
    if (!trimmed) return;
    if (!customModelsList.includes(trimmed)) {
      setCustomModelsList([...customModelsList, trimmed]);
    }
    setNewCustomModelInput("");
  }

  function removeCustomModel(modelToRemove: string) {
    setCustomModelsList(customModelsList.filter((m) => m !== modelToRemove));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">
            {configs.length} model tersimpan
          </span>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
              />
            }
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Tambah Token / Model
          </DialogTrigger>
          <DialogContent className="max-w-md sm:max-w-lg max-h-[min(90dvh,680px)] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="shrink-0 p-6 pb-4 border-b border-border/40 pr-12">
              <DialogTitle>
                {isEditing ? "Ubah Token Model AI" : "Tambah Token Model AI"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditing
                  ? "Perbarui label, model, atau endpoint. Biarkan API key kosong jika tidak ingin menggantinya."
                  : "Simpan token API Google AI Studio, DeepSeek, atau OpenAI Anda. Token disimpan di database pribadi akun Anda dan hanya dipakai untuk permintaan chat Anda."}
              </DialogDescription>
            </DialogHeader>

            <form
              key={formKey}
              action={saveAction}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              {isEditing && <input type="hidden" name="id" value={editing.id} />}
              {!isEditing && copySourceId !== "" && (
                <input type="hidden" name="copyApiKeyFromId" value={copySourceId} />
              )}

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                <FieldGroup className="space-y-3.5">
                  <Field>
                    <FieldLabel htmlFor="ai-provider">Penyedia AI</FieldLabel>
                    <NativeSelect
                      id="ai-provider"
                      name="provider"
                      value={selectedProvider}
                      disabled={isEditing}
                      onChange={(e) => handleProviderChange(e.target.value as AiProviderType)}
                    >
                      <NativeSelectOption value="DEEPSEEK">DeepSeek</NativeSelectOption>
                      <NativeSelectOption value="GOOGLE">
                        Gemini (Google AI Studio)
                      </NativeSelectOption>
                      <NativeSelectOption value="OPENAI">ChatGPT (OpenAI Resmi)</NativeSelectOption>
                      <NativeSelectOption value="OPENAI_COMPATIBLE">
                        OpenAI Compatible (Omniroute, OpenRouter, dll.)
                      </NativeSelectOption>
                    </NativeSelect>
                    <FieldDescription>
                      {isEditing ? (
                        "Penyedia tidak dapat diubah. Hapus lalu buat ulang jika perlu berpindah penyedia."
                      ) : PROVIDER_INFO[selectedProvider].docsUrl ? (
                        <a
                          href={PROVIDER_INFO[selectedProvider].docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Dapatkan API Key di sini
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      ) : (
                        "Gunakan Base URL dan token dari proxy / gateway kompatibel OpenAI."
                      )}
                    </FieldDescription>
                  </Field>

                  {providerConfigs.length > 0 && !isEditing && (
                    <Field>
                      <FieldLabel htmlFor="ai-key-source">Kredensial &amp; Kunci API</FieldLabel>
                      <NativeSelect
                        id="ai-key-source"
                        value={copySourceId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCopySourceId(val);
                          if (val !== "") {
                            const found = providerConfigs.find((c) => c.id === val);
                            if (found?.baseUrl) {
                              setBaseUrlInput(found.baseUrl);
                            }
                          }
                        }}
                      >
                        <NativeSelectOption value="">+ Masukkan Kunci API Baru</NativeSelectOption>
                        {providerConfigs.map((c) => (
                          <NativeSelectOption key={c.id} value={c.id}>
                            Gunakan Kunci dari: {c.name} ({c.maskedApiKey})
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldDescription>
                        Pakai kembali kunci yang tersimpan dari model lain agar tidak perlu salin
                        ulang.
                      </FieldDescription>
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="ai-name">Label / Nama Koneksi</FieldLabel>
                    <Input
                      id="ai-name"
                      name="name"
                      required
                      defaultValue={
                        isEditing
                          ? editing.name
                          : copySourceId !== ""
                            ? `${providerConfigs.find((c) => c.id === copySourceId)?.name ?? ""} (Koneksi Baru)`
                            : ""
                      }
                      placeholder={
                        selectedProvider === "DEEPSEEK"
                          ? "DeepSeek Akun Pribadi"
                          : selectedProvider === "GOOGLE"
                            ? "Gemini Google AI Studio"
                            : selectedProvider === "OPENAI"
                              ? "ChatGPT OpenAI Pribadi"
                              : "Omniroute / Custom Gateway"
                      }
                    />
                    <FieldDescription>
                      Nama penanda untuk membedakan koneksi ini di antarmuka chat.
                    </FieldDescription>
                  </Field>

                  {!isEditing && copySourceId !== "" ? (
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <Key className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span>
                          Menggunakan API key tersimpan dari{" "}
                          <strong>
                            {providerConfigs.find((c) => c.id === copySourceId)?.name ??
                              "Model Tersimpan"}
                          </strong>
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setCopySourceId("")}
                        className="text-[11px] h-7 text-muted-foreground hover:text-foreground"
                      >
                        Kunci Baru
                      </Button>
                    </div>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="ai-key">
                        API Key{isEditing ? " (opsional)" : ""}
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          id="ai-key"
                          name="apiKey"
                          type={showApiKey ? "text" : "password"}
                          required={!isEditing && copySourceId === ""}
                          autoComplete="off"
                          placeholder={
                            isEditing
                              ? "Biarkan kosong untuk mempertahankan key saat ini"
                              : PROVIDER_INFO[selectedProvider].keyPlaceholder
                          }
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showApiKey ? "Sembunyikan API key" : "Tampilkan API key"}
                        >
                          {showApiKey ? (
                            <EyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </Field>
                  )}

                  <Field>
                    <FieldLabel htmlFor="ai-baseurl">
                      Base URL{" "}
                      {PROVIDER_INFO[selectedProvider].requiresBaseUrl ? "(Wajib)" : "(Opsional)"}
                    </FieldLabel>
                    <Input
                      id="ai-baseurl"
                      name="baseUrl"
                      required={PROVIDER_INFO[selectedProvider].requiresBaseUrl}
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                      placeholder={
                        selectedProvider === "OPENAI_COMPATIBLE"
                          ? "https://api.omniroute.ai/v1 atau https://openrouter.ai/api/v1"
                          : "Kosongkan jika menggunakan endpoint resmi bawaan"
                      }
                    />
                    <FieldDescription>
                      {selectedProvider === "OPENAI_COMPATIBLE"
                        ? "Alamat endpoint API kompatibel OpenAI (Omniroute, OpenRouter, vLLM, Ollama, dll.)."
                        : "Bisa disesuaikan untuk proxy atau gateway enterprise (opsional)."}
                    </FieldDescription>
                  </Field>

                  {selectedProvider !== "OPENAI_COMPATIBLE" ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                          <span>Model Bawaan (Otomatis Aktif di Chat):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {PROVIDER_MODELS[selectedProvider].map((m) => (
                            <Badge key={m.id} variant="secondary" className="text-[11px] font-mono">
                              {m.label} ({m.id})
                            </Badge>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Semua model bawaan di atas otomatis aktif dan dapat dipilih di ruang chat.
                        </p>
                      </div>

                      <Field>
                        <FieldLabel htmlFor="ai-model-primary">Model Utama / Default</FieldLabel>
                        <NativeSelect
                          id="ai-model-primary"
                          name="model"
                          value={selectedModelPreset}
                          onChange={(e) => setSelectedModelPreset(e.target.value)}
                        >
                          {PROVIDER_MODELS[selectedProvider].map((m) => (
                            <NativeSelectOption key={m.id} value={m.id}>
                              {m.label} ({m.id})
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <FieldDescription>
                          Model yang terpilih otomatis saat Anda membuka percakapan baru.
                        </FieldDescription>
                      </Field>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs text-foreground">
                      <div className="flex items-center gap-1.5 font-medium text-primary">
                        <Cpu className="size-3.5" aria-hidden="true" />
                        <span>Penyedia Kustom / Kompatibel</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Penyedia ini tidak memiliki model default bawaan. Masukkan satu atau lebih
                        model kustom di bawah agar dapat digunakan di chat.
                      </p>
                      <input type="hidden" name="model" value={customModelsList[0] ?? ""} />
                    </div>
                  )}

                  <Field className="space-y-2">
                    <FieldLabel htmlFor="new-custom-model">
                      Model Kustom{" "}
                      {selectedProvider === "OPENAI_COMPATIBLE"
                        ? "(Wajib Minimal 1)"
                        : "(Opsional, Bisa Lebih Dari Satu)"}
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="new-custom-model"
                        value={newCustomModelInput}
                        onChange={(e) => setNewCustomModelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomModel();
                          }
                        }}
                        placeholder={
                          selectedProvider === "OPENAI_COMPATIBLE"
                            ? "Contoh: agy/gemini-3.8-flash-high, chatgpt-4o-latest"
                            : selectedProvider === "GOOGLE"
                              ? "Contoh: gemini-3.8-pro, gemini-3.5-pro"
                              : selectedProvider === "DEEPSEEK"
                                ? "Contoh: deepseek-reasoner"
                                : "Contoh: o1, gpt-4.5-preview"
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomModel}
                        className="shrink-0"
                      >
                        + Tambah
                      </Button>
                    </div>
                    {customModelsList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {customModelsList.map((cm) => (
                          <Badge
                            key={cm}
                            variant="secondary"
                            className="gap-1 pl-2.5 pr-1 py-1 font-mono text-xs"
                          >
                            <span>{cm}</span>
                            <button
                              type="button"
                              onClick={() => removeCustomModel(cm)}
                              className="hover:bg-muted-foreground/20 rounded p-0.5"
                              aria-label={`Hapus ${cm}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedProvider === "OPENAI_COMPATIBLE"
                          ? "Belum ada model kustom. Ketik identifier model di atas lalu klik '+ Tambah'."
                          : "Belum ada model kustom tambahan. Anda bisa menambahkan model kapan saja."}
                      </p>
                    )}
                    <input type="hidden" name="customModels" value={customModelsList.join(",")} />
                  </Field>

                  <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
                    <input
                      type="checkbox"
                      name="isDefault"
                      value="true"
                      defaultChecked={editing ? editing.isDefault : configs.length === 0}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Jadikan model utama (default)</span>
                  </label>
                </FieldGroup>

                {saveState.status === "error" && saveState.message ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    {saveState.message}
                  </p>
                ) : null}
              </div>

              <DialogFooter className="p-4 px-6 shrink-0 border-t border-border/50 bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  size="sm"
                >
                  Batal
                </Button>
                <SubmitButton size="sm">
                  {isEditing ? "Simpan Perubahan" : "Simpan Model"}
                </SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Empty className="border border-dashed border-border py-8">
          <EmptyHeader>
            <Bot className="size-8 text-muted-foreground" aria-hidden="true" />
            <EmptyTitle>Belum ada token model AI</EmptyTitle>
            <EmptyDescription>
              Asisten AI memerlukan API key aktif. Tambahkan token DeepSeek, Google AI Studio, atau
              OpenAI agar Anda bisa mulai bertanya tentang saldo, mutasi, dan anggaran.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreate}
              className="gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Token Sekarang
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border bg-card/50">
          {configs.map((config) => {
            const info = PROVIDER_INFO[config.provider] ?? PROVIDER_INFO.DEEPSEEK;

            return (
              <div
                key={config.id}
                className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Cpu className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{config.name}</p>
                      <Badge variant={info.badgeVariant} className="text-[10px]">
                        {info.label}
                      </Badge>
                      {config.isDefault && (
                        <Badge variant="default" className="gap-1 text-[10px]">
                          <Check className="size-2.5" aria-hidden="true" />
                          Utama
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Key className="size-3" aria-hidden="true" />
                        {config.maskedApiKey}
                      </span>
                      {config.baseUrl && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate text-[11px]">
                            <Globe className="size-3" aria-hidden="true" />
                            {config.baseUrl}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {PROVIDER_MODELS[config.provider]?.map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="text-[10px] py-0 px-1.5 font-mono"
                        >
                          {p.label}
                        </Badge>
                      ))}
                      {config.customModels?.map((cm) => (
                        <Badge
                          key={cm}
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 font-mono border-primary/40 text-primary bg-primary/5"
                        >
                          {cm}{" "}
                          <span className="text-[9px] text-muted-foreground ml-0.5">(kustom)</span>
                        </Badge>
                      ))}
                      {(!PROVIDER_MODELS[config.provider] ||
                        PROVIDER_MODELS[config.provider].length === 0) &&
                        (!config.customModels || config.customModels.length === 0) &&
                        config.model && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 font-mono border-primary/40 text-primary bg-primary/5"
                          >
                            {config.model}
                          </Badge>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 self-end sm:self-center">
                  {/* Live connectivity status badge */}
                  {testResults[config.id]?.status === "testing" && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-primary/30 text-primary animate-pulse text-[10px]"
                    >
                      <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
                      Menguji...
                    </Badge>
                  )}
                  {testResults[config.id]?.status === "success" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]"
                    >
                      <CheckCircle2 className="size-2.5" aria-hidden="true" />
                      {testResults[config.id]?.message}
                    </Badge>
                  )}
                  {testResults[config.id]?.status === "error" && (
                    <Badge
                      variant="destructive"
                      className="gap-1 text-[10px] max-w-[200px] truncate"
                      title={testResults[config.id]?.message}
                    >
                      <XCircle className="size-2.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{testResults[config.id]?.message}</span>
                    </Badge>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={testingId === config.id}
                    onClick={() => void runConnectivityTest(config)}
                    className="gap-1 text-xs font-medium"
                    title="Uji kirim prompt ke endpoint model AI ini"
                  >
                    {testingId === config.id ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <PlugZap className="size-3 text-primary" aria-hidden="true" />
                    )}
                    {testingId === config.id ? "Menguji…" : "Uji Koneksi"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => openDuplicate(config)}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Daftarkan model lain menggunakan kunci dan endpoint ini"
                  >
                    <CopyPlus className="size-3" aria-hidden="true" />+ Model Serupa
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => openEdit(config)}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                    Ubah
                  </Button>

                  {!config.isDefault && (
                    <form action={setDefaultAiProviderConfigAction}>
                      <input type="hidden" name="id" value={config.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="xs"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Jadikan Utama
                      </Button>
                    </form>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Hapus ${config.name}`}
                        />
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus token model AI ini?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Token <strong>{config.name}</strong> akan dihapus dari akun Anda. Anda
                          bisa menambahkannya kembali sewaktu-waktu.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <form action={deleteAiProviderConfigAction}>
                          <input type="hidden" name="id" value={config.id} />
                          <AlertDialogAction type="submit">Hapus</AlertDialogAction>
                        </form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
