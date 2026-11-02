"use client";

import { FileText, Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { cn } from "@/lib/utils";

export interface DropzoneFileInputProps {
  id?: string;
  name?: string;
  accept?: string;
  maxSizeBytes?: number;
  description?: string;
  className?: string;
  disabled?: boolean;
  onFileSelect?: (file: File | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropzoneFileInput({
  id = "file-dropzone",
  name,
  accept,
  maxSizeBytes = 10 * 1024 * 1024,
  description = "Tarik dan lepas berkas ke sini, atau klik untuk memilih",
  className,
  disabled = false,
  onFileSelect,
}: DropzoneFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
      onFileSelect?.(null);
      return;
    }

    if (maxSizeBytes && file.size > maxSizeBytes) {
      setError(`Ukuran berkas melebihi batas maksimal ${formatBytes(maxSizeBytes)}`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    onFileSelect?.(file);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  function handleDragOver(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile) {
        // Transfer to file input element so native FormData contains it
        if (inputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(droppedFile);
          inputRef.current.files = dataTransfer.files;
        }
        handleFile(droppedFile);
      }
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    handleFile(file);
  }

  function removeFile() {
    handleFile(null);
  }

  const isImage = selectedFile?.type.startsWith("image/");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Hidden real input for standard Form submission */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
      />

      {!selectedFile ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group relative flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-6 text-center transition-all cursor-pointer select-none hover:border-primary/50 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
            isDragging && "border-primary bg-primary/5 scale-[1.005]",
            disabled && "cursor-not-allowed opacity-50 hover:border-border/80 hover:bg-muted/20",
          )}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <UploadCloud className="size-5" />
          </div>
          <p className="mt-3 text-xs font-medium text-foreground sm:text-sm">{description}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {accept ? accept.replaceAll(",", " · ") : "Semua jenis berkas didukung"} · maks.{" "}
            {formatBytes(maxSizeBytes)}
          </p>
        </button>
      ) : (
        <Attachment
          state="done"
          className="w-full justify-between rounded-2xl border-border bg-card p-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AttachmentMedia variant={isImage ? "image" : "icon"} className="size-11 rounded-xl">
              {isImage && previewUrl ? (
                // biome-ignore lint/performance/noImgElement: Blob preview object URL cannot be optimized by next/image
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="size-full object-cover rounded-xl"
                />
              ) : isImage ? (
                <ImageIcon className="size-5 text-muted-foreground" />
              ) : (
                <FileText className="size-5 text-muted-foreground" />
              )}
            </AttachmentMedia>
            <AttachmentContent className="min-w-0">
              <AttachmentTitle className="text-xs font-semibold text-foreground">
                {selectedFile.name}
              </AttachmentTitle>
              <AttachmentDescription className="text-[11px]">
                {formatBytes(selectedFile.size)} · {selectedFile.type || "Berkas"}
              </AttachmentDescription>
            </AttachmentContent>
          </div>
          <AttachmentActions>
            <AttachmentAction
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={removeFile}
              disabled={disabled}
              aria-label="Hapus berkas"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      )}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
