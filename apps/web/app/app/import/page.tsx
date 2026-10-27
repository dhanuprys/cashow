"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { importCsvAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";

export default function ImportPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    importCsvAction,
    initialActionState,
  );

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
          Format: tanggal, jumlah, jenis (INCOME/EXPENSE), catatan. Baris pertama adalah header.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Tempel CSV</CardTitle>
          <CardDescription>Contoh: 2026-10-10,250000,EXPENSE,Belanja</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <Textarea name="csv" rows={10} className="font-mono text-xs" />
            {state.status === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {state.message}
              </p>
            ) : null}
            {state.status === "success" ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.message}</p>
            ) : null}
            <SubmitButton>Impor</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
