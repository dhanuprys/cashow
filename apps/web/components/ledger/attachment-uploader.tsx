"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropzoneFileInput } from "@/components/ledger/dropzone-file-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/**
 * Compress a phone photo before upload. Receipts are text-heavy; 1600 px on
 * the long edge keeps them readable while cutting a multi-megabyte original.
 * Any decode failure falls back to the original file.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  if (file.size < 800_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_500_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (context === null) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (blob === null || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function AttachmentUploader({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("PROOF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(original: File | null) {
    if (original === null) return;
    if (original.size > MAX_INPUT_BYTES) {
      setError("Berkas maksimal 20 MB sebelum dikompres.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const file = await compressImage(original);
      const body = new FormData();
      body.set("transactionId", transactionId);
      body.set("kind", kind);
      body.set("file", file);

      const response = await fetch("/api/attachments", { method: "POST", body });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.message ?? "Unggahan gagal.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unggahan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`attachment-kind-${transactionId}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Jenis Lampiran
        </label>
        <NativeSelect
          id={`attachment-kind-${transactionId}`}
          aria-label="Jenis lampiran"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          size="sm"
          className="w-auto"
        >
          <NativeSelectOption value="PROOF">Bukti</NativeSelectOption>
          <NativeSelectOption value="RECEIPT">Struk</NativeSelectOption>
          <NativeSelectOption value="INVOICE">Faktur</NativeSelectOption>
          <NativeSelectOption value="CONTRACT">Kontrak</NativeSelectOption>
        </NativeSelect>
      </div>

      <DropzoneFileInput
        id={`attachment-${transactionId}`}
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        maxSizeBytes={MAX_INPUT_BYTES}
        description="Tarik lampiran ke sini atau klik untuk unggah"
        disabled={busy}
        onFileSelect={(file) => void onUpload(file)}
      />

      {busy ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Mengompresi dan mengunggah lampiran…</span>
        </div>
      ) : null}

      {error === null ? null : (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
