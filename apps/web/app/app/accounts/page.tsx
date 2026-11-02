import { formatMoney, parseDbTimestamp, toLocalDateTimeInput } from "@cashow/domain";
import { listAccounts, listSnapshots } from "@cashow/services";
import { Archive, ArchiveRestore, ArrowLeftRight, ChevronDown, Scale, Wallet } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountForm, EditAccountDialog } from "@/components/ledger/account-form";
import {
  UnlockCheckpointForm,
  VerifyCheckpointButton,
} from "@/components/ledger/checkpoint-actions";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
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

export const metadata = {
  title: "Akun",
};

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Dompet &amp; rekening
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Akun
        </h1>
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-52 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton />
          </div>
        }
      >
        <Accounts />
      </Suspense>
    </div>
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
      <p className="-mt-3 text-sm text-muted-foreground">
        {live.length} akun aktif · total saldo perkiraan {formatMoney(total)}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                          <Wallet className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            <Link
                              href={`/app/transactions?accountId=${account.id}`}
                              className="hover:text-primary hover:underline break-words line-clamp-2"
                            >
                              {account.name}
                            </Link>
                            {account.archivedAt === null ? null : (
                              <Badge variant="secondary" className="shrink-0">
                                Arsip
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {ACCOUNT_TYPE_LABEL[account.type] ?? account.type} · {account.currency}{" "}
                            · saldo awal {formatMoney(account.openingBalance)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            account.balance < 0n ? "text-rose-700 dark:text-rose-400" : "",
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
                          {account.snapshotAgeDays === 0
                            ? "Snapshot terakhir hari ini"
                            : `Snapshot terakhir ${account.snapshotAgeDays} hari lalu`}
                          {account.snapshotAgeDays > 30 ? " — perlu diperbarui" : ""}
                        </span>
                      )}
                      {account.lastCheckpointAt === null ? null : (
                        <Badge variant="outline">
                          Checkpoint {displayDateTime(account.lastCheckpointAt, user.timezone)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                      <div className="flex items-center gap-1">
                        <EditAccountDialog
                          account={{
                            id: account.id,
                            name: account.name,
                            type: account.type,
                            openingBalance: account.openingBalance.toString(),
                            currency: account.currency,
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/app/transactions?accountId=${account.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ArrowLeftRight className="size-3" aria-hidden="true" />
                          <span>Mutasi</span>
                        </Link>
                        <form action={archiveAccountAction} className="shrink-0">
                          <input type="hidden" name="accountId" value={account.id} />
                          <input
                            type="hidden"
                            name="archived"
                            value={account.archivedAt === null ? "true" : "false"}
                          />
                          <SubmitButton variant="ghost" size="sm" pendingLabel="Menyimpan…">
                            {account.archivedAt === null ? (
                              <>
                                <Archive aria-hidden="true" />
                                <span>Arsipkan</span>
                              </>
                            ) : (
                              <>
                                <ArchiveRestore aria-hidden="true" />
                                <span>Aktifkan</span>
                              </>
                            )}
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    <details className="group rounded-2xl border border-border bg-muted/20 p-4 transition-colors open:bg-card">
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <Scale className="size-4" aria-hidden="true" />
                          <span>Rekonsiliasi &amp; snapshot</span>
                          {snapshots.length > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">
                              ({snapshots.length})
                            </span>
                          )}
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
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

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2">
                                    <div className="flex flex-wrap items-center gap-2">
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
                                    </div>

                                    {checkpoint === null ? (
                                      <form action={deleteSnapshotAction} className="shrink-0">
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

                                  {checkpoint?.active !== true ? (
                                    <details className="group mt-2">
                                      <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                                        <span>Ubah snapshot</span>
                                        <ChevronDown className="size-3 transition-transform duration-200 group-open:rotate-180" />
                                      </summary>
                                      <div className="mt-3 rounded-2xl border border-border bg-background p-4">
                                        <SnapshotForm
                                          accountId={account.id}
                                          defaultRecordedAtLocal={nowInput}
                                          snapshot={{
                                            id: snapshot.id,
                                            amount: snapshot.amount.toString(),
                                            recordedAtLocal: toLocalDateTimeInput(
                                              parseDbTimestamp(snapshot.recordedAt),
                                              user.timezone,
                                            ),
                                            note: snapshot.note,
                                          }}
                                        />
                                      </div>
                                    </details>
                                  ) : null}

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
