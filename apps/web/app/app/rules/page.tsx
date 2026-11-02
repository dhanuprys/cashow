import { listRules } from "@cashow/services";
import { Play } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { RuleBuilderForm } from "@/components/ledger/rule-builder-form";
import { RuleCardItem } from "@/components/ledger/rule-card-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { runRulesAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export const metadata = {
  title: "Aturan otomatis",
};

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Automasi &amp; Peringatan
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Aturan Keuangan
          </h1>
        </div>
        <form action={runRulesAction}>
          <Button type="submit" variant="outline" size="sm" className="gap-2">
            <Play className="size-3.5 fill-current" />
            Evaluasi sekarang
          </Button>
        </form>
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-52 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton twoColumn />
          </div>
        }
      >
        <Rules />
      </Suspense>
    </div>
  );
}

async function Rules() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const rules = unwrap(await listRules(ctx));
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        {activeCount} aturan aktif dari total {rules.length} aturan terdaftar.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left Column: Rules list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Daftar Aturan
            </h2>
            <span className="text-xs text-muted-foreground">{rules.length} terpasang</span>
          </div>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada aturan aktif</EmptyTitle>
                    <EmptyDescription>
                      Gunakan formulir atau pilih template di samping untuk membuat peringatan
                      otomatis (misal batas harian atau saldo minim).
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <RuleCardItem key={rule.id} rule={rule} timezone={user.timezone} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Visual Form Builder */}
        <div className="space-y-4">
          <RuleBuilderForm />
        </div>
      </div>
    </div>
  );
}
