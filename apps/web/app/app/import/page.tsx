"use client";

import { FileUp } from "lucide-react";
import { useActionState, useState } from "react";
import { DropzoneFileInput } from "@/components/ledger/dropzone-file-input";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importCsvAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";

const SAMPLE = `tanggal,jumlah,jenis,catatan
2026-10-10,250000,EXPENSE,Belanja mingguan
2026-10-12,1500000,INCOME,Gaji`;

const MAX_BYTES = 2 * 1024 * 1024;

export default function ImportPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    importCsvAction,
    initialActionState,
  );
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MAX_BYTES) {
      setFileError("Berkas lebih dari 2 MB. Pecah menjadi beberapa bagian.");
      return;
    }
    try {
      setCsv(await file.text());
      setFileError(null);
    } catch {
      setFileError("Berkas tidak bisa dibaca. Pastikan formatnya teks/CSV.");
    }
  }

  const dataRows = csv.trim() === "" ? 0 : Math.max(0, csv.trim().split(/\r?\n/).length - 1);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Impor
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Impor CSV
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kolom: tanggal (YYYY-MM-DD), jumlah, jenis (INCOME/EXPENSE), catatan. Baris pertama adalah
          header dan dilewati.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Berkas atau tempel</CardTitle>
          <CardDescription>
            Transaksi masuk ke akun aktif pertama. Baris yang tidak valid dilaporkan, bukan
            diabaikan diam-diam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="csv-file">Pilih berkas CSV</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsv(SAMPLE);
                    setFileError(null);
                  }}
                >
                  <FileUp aria-hidden="true" />
                  Isi contoh
                </Button>
              </div>
              <DropzoneFileInput
                id="csv-file"
                accept=".csv,text/csv,text/plain"
                maxSizeBytes={MAX_BYTES}
                description="Tarik berkas CSV ke sini, atau klik untuk memilih"
                onFileSelect={(file) => void onFile(file ?? undefined)}
              />
              {fileError === null ? null : (
                <p className="text-sm text-destructive" role="alert">
                  {fileError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="csv">Data CSV</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {dataRows} baris data
                </span>
              </div>
              <Textarea
                id="csv"
                name="csv"
                rows={6}
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder="tanggal,jumlah,jenis,catatan"
                required
              />
            </div>

            <div aria-live="polite" className="min-h-0">
              {state.status === "error" ? (
                <p className="text-sm text-destructive" role="alert">
                  {state.message}
                </p>
              ) : null}
              {state.status === "success" ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>
              ) : null}
            </div>

            <SubmitButton className="w-full sm:w-auto" disabled={csv.trim() === ""}>
              Impor
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
