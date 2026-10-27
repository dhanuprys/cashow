import { formatMoney } from "@cashow/domain";
import { listAccounts } from "@cashow/services";
import { Archive, ArchiveRestore, Wallet } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountForm } from "@/components/ledger/account-form";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { archiveAccountAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ACCOUNT_TYPE_LABEL } from "@/lib/format";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <Accounts />
    </Suspense>
  );
}

async function Accounts() {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const accounts = unwrap(await listAccounts(ctx));
  const live = accounts.filter((account) => account.archivedAt === null);
  const archived = accounts.filter((account) => account.archivedAt !== null);
  const total = live.reduce((sum, account) => sum + account.balance, 0n);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Dompet & rekening
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {live.length} akun aktif · total saldo {formatMoney(total)}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada akun</EmptyTitle>
                    <EmptyDescription>
                      Tambahkan dompet tunai, rekening bank, atau e-wallet.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-muted">
                        <Wallet className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          {account.name}
                          {account.archivedAt === null ? null : (
                            <Badge variant="secondary">Arsip</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ACCOUNT_TYPE_LABEL[account.type] ?? account.type} · {account.currency} ·
                          saldo awal {formatMoney(account.openingBalance)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        account.balance < 0n ? "text-rose-600 dark:text-rose-400" : "",
                      )}
                    >
                      {formatMoney(account.balance)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <details className="w-full">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Ubah akun
                      </summary>
                      <div className="mt-3 rounded-2xl border border-border p-4">
                        <AccountForm
                          account={{
                            id: account.id,
                            name: account.name,
                            type: account.type,
                            openingBalance: account.openingBalance.toString(),
                            currency: account.currency,
                          }}
                        />
                      </div>
                    </details>

                    <form action={archiveAccountAction}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <input
                        type="hidden"
                        name="archived"
                        value={account.archivedAt === null ? "true" : "false"}
                      />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Menyimpan…">
                        {account.archivedAt === null ? (
                          <>
                            <Archive aria-hidden="true" />
                            Arsipkan
                          </>
                        ) : (
                          <>
                            <ArchiveRestore aria-hidden="true" />
                            Aktifkan
                          </>
                        )}
                      </SubmitButton>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tambah akun</CardTitle>
            <CardDescription>Saldo awal boleh nol atau negatif.</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountForm />
          </CardContent>
        </Card>
      </div>

      {archived.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          Akun yang diarsipkan tetap menyimpan riwayat, tetapi tidak muncul di pilihan transaksi
          baru.
        </p>
      )}
    </div>
  );
}
