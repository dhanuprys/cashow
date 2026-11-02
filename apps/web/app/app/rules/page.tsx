import { listRules } from "@cashow/services";
import { Play } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { RuleManager } from "@/components/ledger/rule-manager";
import { Button } from "@/components/ui/button";
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
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Automasi &amp; Peringatan
          </p>
          <h1 className="mt-1 sm:mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Aturan Keuangan
          </h1>
        </div>
        <form action={runRulesAction} className="w-full sm:w-auto">
          <Button type="submit" variant="outline" size="sm" className="w-full sm:w-auto gap-2">
            <Play className="size-3.5 fill-current" />
            Evaluasi sekarang
          </Button>
        </form>
      </section>

      <Suspense fallback={<ContentSkeleton />}>
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

  return <RuleManager rules={rules} timezone={user.timezone} />;
}
