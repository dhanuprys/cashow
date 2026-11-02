import { formatMoney } from "@cashow/domain";
import { getTransaction } from "@cashow/services";
import { ArrowLeft, Copy, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AttachmentUploader } from "@/components/ledger/attachment-uploader";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { LinkButton } from "@/components/ledger/link-button";
import { PageSkeleton } from "@/components/ledger/page-skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteAttachmentAction,
  deleteTransactionAction,
  restoreTransactionAction,
} from "@/lib/actions/ledger";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  ATTACHMENT_KIND_LABEL,
  displayDateTime,
  displayLocalDate,
  formatBytes,
} from "@/lib/format";
import { ledgerErrorCode } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Detail transaksi",
};

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransactionDetail params={params} />
    </Suspense>
  );
}

async function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const { id } = await params;

  const result = await getTransaction(ctx, id);
  if (!result.ok) {
    if (ledgerErrorCode(result.error) === "NOT_FOUND") notFound();
    throw result.error;
  }

  const transaction = result.value;
  const income = transaction.type === "INCOME";
  const transfer = transaction.type === "TRANSFER";
  const feeForTransfer = transaction.transferId !== null;
  const editable =
    (transaction.type === "INCOME" || transaction.type === "EXPENSE") && !feeForTransfer;
  const title = transfer
    ? (transaction.note ?? `Transfer ke ${transaction.destinationAccountName ?? "akun lain"}`)
    : (transaction.merchant ??
      transaction.counterparty ??
      transaction.note ??
      transaction.categoryName ??
      (income ? "Pemasukan" : "Pengeluaran"));

  const cloneQuery = new URLSearchParams();
  cloneQuery.set("type", transaction.type);
  cloneQuery.set("amount", transaction.amount.toString());
  cloneQuery.set("accountId", transaction.accountId);
  if (transaction.categoryId) cloneQuery.set("categoryId", transaction.categoryId);
  if (transaction.merchant) cloneQuery.set("merchant", transaction.merchant);
  if (transaction.note) cloneQuery.set("note", transaction.note);
  const cloneHref = `/app/transactions/new?${cloneQuery.toString()}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/app/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Semua transaksi
      </Link>

      {transaction.deletedAt === null ? null : (
        <Alert variant="destructive">
          <Trash2 aria-hidden="true" />
          <AlertTitle>Transaksi ini dihapus</AlertTitle>
          <AlertDescription>
            Tidak dihitung di saldo dan laporan. Pulihkan untuk memakainya lagi.
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/15 border-b border-border/40 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={income ? "default" : transfer ? "outline" : "secondary"}
                  className="font-medium"
                >
                  {feeForTransfer
                    ? "Biaya transfer"
                    : transfer
                      ? "Transfer"
                      : income
                        ? "Pemasukan"
                        : "Pengeluaran"}
                </Badge>
                {transaction.source === "QUICK_ADD" ? (
                  <Badge variant="outline" className="border-dashed text-xs">
                    Catat cepat
                  </Badge>
                ) : null}
              </div>

              <CardTitle className="text-xl sm:text-2xl font-bold break-words [overflow-wrap:anywhere] text-foreground">
                {title}
              </CardTitle>

              <div className="pt-1">
                <p
                  className={cn(
                    "text-3xl sm:text-4xl font-bold tabular-nums tracking-tight break-words",
                    income
                      ? "text-emerald-700 dark:text-emerald-400"
                      : transfer
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-foreground",
                  )}
                >
                  {income ? "+" : transfer ? "" : "−"}
                  {formatMoney(transaction.amount)}
                </p>
                {transfer && transaction.transferFeeAmount !== null ? (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <span>Termasuk biaya</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(transaction.transferFeeAmount)}
                    </span>
                    <span>di akun asal</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
              {feeForTransfer && transaction.transferId !== null ? (
                <LinkButton
                  href={`/app/transactions/${transaction.transferId}`}
                  variant="outline"
                  size="sm"
                >
                  Lihat transfer
                </LinkButton>
              ) : null}

              {transaction.deletedAt === null ? (
                <>
                  {editable ? (
                    <LinkButton
                      href={`/app/transactions/${transaction.id}/edit`}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Ubah
                    </LinkButton>
                  ) : null}
                  {!transfer && !feeForTransfer && (
                    <LinkButton href={cloneHref} variant="outline" size="sm" className="gap-1.5">
                      <Copy className="size-3.5" aria-hidden="true" />
                      Duplikasi
                    </LinkButton>
                  )}
                  {feeForTransfer ? null : (
                    <form action={deleteTransactionAction}>
                      <input type="hidden" name="transactionId" value={transaction.id} />
                      <ConfirmSubmitButton
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        message={
                          transfer
                            ? "Hapus transfer ini? Biaya transfernya ikut terhapus."
                            : "Hapus transaksi ini? Catatan tetap tersimpan dan bisa dipulihkan."
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Hapus
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </>
              ) : feeForTransfer ? null : (
                <form action={restoreTransactionAction}>
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <ConfirmSubmitButton
                    size="sm"
                    variant="default"
                    message="Pulihkan transaksi ini? Saldo dan laporan akan menghitungnya lagi."
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Pulihkan
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">Waktu Transaksi</dt>
              <dd className="font-medium text-foreground">
                {displayDateTime(transaction.occurredAt, user.timezone)}
              </dd>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">Tanggal Pembukuan</dt>
              <dd className="font-medium text-foreground">
                {displayLocalDate(transaction.occurredOn)}
              </dd>
            </div>

            {transfer ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                  <dt className="text-xs font-medium text-muted-foreground">Dari Akun</dt>
                  <dd className="font-medium text-foreground">{transaction.accountName}</dd>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                  <dt className="text-xs font-medium text-muted-foreground">Ke Akun</dt>
                  <dd className="font-medium text-foreground">
                    {transaction.destinationAccountName ?? "—"}
                  </dd>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Akun</dt>
                <dd className="font-medium text-foreground">{transaction.accountName}</dd>
              </div>
            )}

            {transaction.type === "INCOME" || transaction.type === "EXPENSE" ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Kategori</dt>
                <dd className="font-medium text-foreground">
                  {transaction.categoryName ?? "Tanpa kategori"}
                </dd>
              </div>
            ) : null}

            {transaction.planId !== null && transaction.planName !== null && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Rencana Pembayaran</dt>
                <dd className="mt-0.5 font-medium">
                  <Link
                    href={`/app/plans/${transaction.planId}`}
                    className="text-primary hover:underline"
                  >
                    {transaction.planName}
                    {transaction.planItemLabel === null ? "" : ` · ${transaction.planItemLabel}`}
                  </Link>
                </dd>
              </div>
            )}

            {transfer && transaction.transferFeeId !== null ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Biaya Transfer</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  <Link
                    href={`/app/transactions/${transaction.transferFeeId}`}
                    className="text-primary hover:underline"
                  >
                    {transaction.transferFeeAmount === null
                      ? "Lihat biaya"
                      : formatMoney(transaction.transferFeeAmount)}
                  </Link>
                </dd>
              </div>
            ) : null}

            {feeForTransfer && transaction.transferId !== null ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Untuk Transfer</dt>
                <dd className="mt-0.5 font-medium">
                  <Link
                    href={`/app/transactions/${transaction.transferId}`}
                    className="text-primary hover:underline"
                  >
                    Buka transfer
                  </Link>
                </dd>
              </div>
            ) : null}

            {transaction.merchant !== null && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Toko / Penerima</dt>
                <dd className="font-medium text-foreground">{transaction.merchant}</dd>
              </div>
            )}

            {transaction.counterparty !== null && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">Sumber Pihak</dt>
                <dd className="font-medium text-foreground">{transaction.counterparty}</dd>
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">Dicatat pada</dt>
              <dd className="text-xs text-muted-foreground">
                {displayDateTime(transaction.createdAt, user.timezone)}
              </dd>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">ID Referensi</dt>
              <dd className="font-mono text-xs text-muted-foreground break-all select-all">
                {transaction.id}
              </dd>
            </div>
          </dl>

          {transaction.note !== null && (
            <div className="rounded-xl border border-border/70 bg-background p-3.5 space-y-1.5 mt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catatan
              </span>
              <p className="whitespace-pre-wrap text-sm text-foreground">{transaction.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {transfer ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Alokasi</CardTitle>
          </CardHeader>
          <CardContent>
            {transaction.type === "INCOME" ? (
              transaction.allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada pengeluaran yang menarik dari pemasukan ini.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {transaction.allocations.map((allocation) => (
                    <li
                      key={allocation.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <Link
                        href={`/app/transactions/${allocation.expenseId}`}
                        className="min-w-0 truncate hover:underline"
                      >
                        {allocation.counterpartyLabel}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {displayLocalDate(allocation.counterpartyOccurredOn)}
                        </span>
                      </Link>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(allocation.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : transaction.allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pengeluaran ini belum dikaitkan ke pemasukan mana pun.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {transaction.allocations.map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <Link
                      href={`/app/transactions/${allocation.incomeId}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      {allocation.counterpartyLabel}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {displayLocalDate(allocation.counterpartyOccurredOn)}
                      </span>
                    </Link>
                    <span className="shrink-0 tabular-nums">{formatMoney(allocation.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            {transaction.type === "EXPENSE" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Dialokasikan {formatMoney(transaction.allocated)} dari{" "}
                {formatMoney(transaction.amount)}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lampiran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {transaction.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada berkas.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {transaction.attachments.map((attachment) => {
                const isImage = attachment.mimeType.startsWith("image/");
                const source = `/api/attachments/${attachment.id}`;
                return (
                  <li
                    key={attachment.id}
                    className="overflow-hidden rounded-2xl border border-border"
                  >
                    {isImage ? (
                      <a href={source} target="_blank" rel="noreferrer" className="block">
                        {/* biome-ignore lint/performance/noImgElement: same-origin attachment preview; the Next image optimizer would proxy it */}
                        <img
                          src={source}
                          alt={attachment.fileName}
                          loading="lazy"
                          decoding="async"
                          className="h-36 w-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-36 items-center justify-center bg-muted/40"
                      >
                        <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
                      </a>
                    )}
                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" title={attachment.fileName}>
                          {attachment.fileName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ATTACHMENT_KIND_LABEL[attachment.kind] ?? attachment.kind} ·{" "}
                          {formatBytes(attachment.byteSize)}
                        </p>
                      </div>
                      <form action={deleteAttachmentAction}>
                        <input type="hidden" name="attachmentId" value={attachment.id} />
                        <input type="hidden" name="transactionId" value={transaction.id} />
                        <ConfirmSubmitButton
                          size="icon-xs"
                          message="Hapus lampiran ini?"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" />
                          <span className="sr-only">Hapus lampiran</span>
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {transaction.deletedAt === null ? (
            <AttachmentUploader transactionId={transaction.id} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
