import { listRules } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { createRuleFormAction, deleteRuleAction, runRulesAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <Rules />
    </Suspense>
  );
}

async function Rules() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const rules = unwrap(await listRules(ctx));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Aturan
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Aturan & notifikasi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rules.filter((r) => r.active).length} aturan aktif.
          </p>
        </div>
        <form action={runRulesAction}>
          <input type="hidden" name="triggerType" value="manual" />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Jalankan aturan
          </button>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada aturan</EmptyTitle>
                    <EmptyDescription>Buat aturan dari JSON trigger dan kondisi.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.active ? "Aktif" : "Nonaktif"} · v{rule.version}
                      </p>
                    </div>
                    <form action={deleteRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <ConfirmSubmitButton message="Hapus aturan ini?" variant="ghost" size="sm">
                        Hapus
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aturan baru</CardTitle>
            <CardDescription>Definisikan trigger dan kondisi dalam JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createRuleFormAction} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="rule-name">
                  Nama
                </label>
                <input
                  id="rule-name"
                  name="name"
                  required
                  maxLength={120}
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="rule-trigger">
                  Trigger (JSON)
                </label>
                <textarea
                  id="rule-trigger"
                  name="trigger"
                  defaultValue='{"type":"transaction"}'
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="rule-condition">
                  Kondisi (JSON)
                </label>
                <textarea
                  id="rule-condition"
                  name="condition"
                  defaultValue='{"metric":"expenseToday","op":"gt","value":100000}'
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="rule-description">
                  Keterangan
                </label>
                <input
                  id="rule-description"
                  name="description"
                  maxLength={500}
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
              >
                Buat aturan
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presets</CardTitle>
          <CardDescription>Buat aturan umum dalam satu klik.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            {
              name: "Batas harian 150rb",
              trigger: '{"type":"transaction"}',
              condition: '{"metric":"expenseToday","op":"gt","value":150000}',
            },
            {
              name: "Pengeluaran besar",
              trigger: '{"type":"transaction"}',
              condition: '{"metric":"expenseToday","op":"gt","value":500000}',
            },
            {
              name: "Saldo rendah",
              trigger: '{"type":"schedule"}',
              condition: '{"metric":"totalBalance","op":"lt","value":100000}',
            },
          ].map((preset) => (
            <form key={preset.name} action={createRuleFormAction} className="contents">
              <input type="hidden" name="name" value={preset.name} />
              <input type="hidden" name="trigger" value={preset.trigger} />
              <input type="hidden" name="condition" value={preset.condition} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                {preset.name}
              </button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
