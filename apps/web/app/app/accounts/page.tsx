import { formatMoney } from "@cashow/domain";
import { listAccounts, listSnapshots } from "@cashow/services";
import { Archive, ArchiveRestore, Scale, Wallet } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountForm } from "@/components/ledger/account-form";
import {
  UnlockCheckpointForm,
  VerifyCheckpointButton,
} from "@/components/ledger/checkpoint-actions";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { SnapshotForm } from "@/components/ledger/snapshot-form";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { archiveAccountAction, deleteSnapshotAction } from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ACCOUNT_TYPE_LABEL, displayDateTime, GAP_KIND_LABEL, nowLocalInput } from "@/lib/format";
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
  const timelines = await Promise.all(
    accounts.map(async (account) => ({
      accountId: account.id,
      snapshots: unwrap(await listSnapshots(ctx, account.id)),
    })),
  );
  const snapshotsByAccount = new Map(timelines.map((row) => [row.accountId, row.snapshots]));
  const live = accounts.filter((account) => account.archivedAt === null);
  const archived = accounts.filter((account) => account.archivedAt !== null);
  const total = live.reduce((sum, account) => sum + account.balance, 0n);
  const nowInput = nowLocalInput(new Date(), user.timezone);

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
          {live.length} akun aktif · total saldo perkiraan {formatMoney(total)}
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
            accounts.map((account) => {
              const snapshots = snapshotsByAccount.get(account.id) ?? [];
              const newestFirst = [...snapshots].reverse();
              return (
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
                            {ACCOUNT_TYPE_LABEL[account.type] ?? account.type} · {account.currency}{" "}
                            · saldo awal {formatMoney(account.openingBalance)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            account.balance < 0n ? "text-rose-600 dark:text-rose-400" : "",
                          )}
                        >
                          {formatMoney(account.balance)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {account.snapshotRecordedAt === null
                            ? "saldo awal + semua transaksi"
                            : `snapshot ${displayDateTime(
                                account.snapshotRecordedAt,
                                user.timezone,
                              )} + sesudahnya`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {account.snapshotAgeDays === null ? null : (
                        <span>
                          Snapshot terakhir {account.snapshotAgeDays} hari lalu
                          {account.snapshotAgeDays > 30 ? " — perlu diperbarui" : ""}
                        </span>
                      )}
                      {account.lastCheckpointAt === null ? null : (
                        <Badge variant="outline">
                          Checkpoint {displayDateTime(account.lastCheckpointAt, user.timezone)}
                        </Badge>
                      )}
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

                    <details className="rounded-2xl border border-border p-4">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <Scale className="size-4" aria-hidden="true" />
                        Rekonsiliasi &amp; snapshot
                        {snapshots.length === 0 ? null : (
                          <span className="text-xs font-normal text-muted-foreground">
                            {snapshots.length} snapshot
                          </span>
                        )}
                      </summary>

                      <div className="mt-4 space-y-5">
                        <div className="rounded-xl bg-muted/30 p-4">
                          <p className="mb-3 text-xs text-muted-foreground">
                            Catat saldo yang benar-benar tertera di bank. Selisih terhadap buku
                            dihitung otomatis.
                          </p>
                          <SnapshotForm accountId={account.id} defaultRecordedAtLocal={nowInput} />
                        </div>

                        {newestFirst.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Belum ada snapshot. Saldo masih dihitung penuh dari saldo awal dan
                            seluruh transaksi.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {newestFirst.map((snapshot) => {
                              const balanced = snapshot.gap === 0n;
                              const checkpoint = snapshot.checkpoint;
                              return (
                                <li
                                  key={snapshot.id}
                                  className="rounded-xl border border-border p-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium tabular-nums">
                                        {formatMoney(snapshot.amount)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {displayDateTime(snapshot.recordedAt, user.timezone)} ·{" "}
                                        {snapshot.transactionCount} transaksi
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <Badge variant={balanced ? "secondary" : "destructive"}>
                                        {GAP_KIND_LABEL[snapshot.gapKind] ?? snapshot.gapKind}
                                      </Badge>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        seharusnya {formatMoney(snapshot.expectedAmount)}
                                        {balanced ? "" : ` · selisih ${formatMoney(snapshot.gap)}`}
                                      </p>
                                    </div>
                                  </div>

                                  {snapshot.note === null ? null : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {snapshot.note}
                                    </p>
                                  )}

                                  <div className="mt-3 flex flex-wrap items-start gap-2">
                                    {checkpoint === null ? null : (
                                      <Badge variant={checkpoint.active ? "default" : "outline"}>
                                        {checkpoint.active
                                          ? "Checkpoint aktif"
                                          : "Checkpoint dibuka"}
                                      </Badge>
                                    )}

                                    {balanced && checkpoint?.active !== true ? (
                                      <VerifyCheckpointButton snapshotId={snapshot.id} />
                                    ) : null}

                                    {checkpoint === null ? (
                                      <form action={deleteSnapshotAction}>
                                        <input
                                          type="hidden"
                                          name="snapshotId"
                                          value={snapshot.id}
                                        />
                                        <ConfirmSubmitButton
                                          message="Hapus snapshot ini? Semua selisih sesudahnya dihitung ulang."
                                          variant="ghost"
                                        >
                                          Hapus
                                        </ConfirmSubmitButton>
                                      </form>
                                    ) : null}
                                  </div>

                                  {checkpoint?.active === true ? (
                                    <details className="mt-3">
                                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                        Buka kunci periode
                                        {checkpoint.unlockReason === null
                                          ? ""
                                          : ` · ${checkpoint.unlockReason}`}
                                      </summary>
                                      <div className="mt-2 max-w-sm">
                                        <UnlockCheckpointForm checkpointId={checkpoint.id} />
                                      </div>
                                    </details>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })
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
