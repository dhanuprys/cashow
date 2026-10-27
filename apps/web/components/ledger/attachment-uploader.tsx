"use client";

import { ImagePlus, Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("PROOF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    if (original === undefined) return;
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

      if (inputRef.current !== null) inputRef.current.value = "";
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unggahan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Jenis lampiran"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          size="sm"
        >
          <NativeSelectOption value="PROOF">Bukti</NativeSelectOption>
          <NativeSelectOption value="RECEIPT">Struk</NativeSelectOption>
          <NativeSelectOption value="INVOICE">Faktur</NativeSelectOption>
          <NativeSelectOption value="CONTRACT">Kontrak</NativeSelectOption>
        </NativeSelect>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="sr-only"
          id={`attachment-${transactionId}`}
          onChange={onUpload}
          disabled={busy}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip aria-hidden="true" />
          )}
          {busy ? "Mengunggah…" : "Lampirkan berkas"}
        </Button>
        <span className="text-xs text-muted-foreground">
          <ImagePlus className="mr-1 inline size-3.5" aria-hidden="true" />
          JPG, PNG, WebP, HEIC, atau PDF · foto dikompres otomatis
        </span>
      </div>

      {error === null ? null : (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
