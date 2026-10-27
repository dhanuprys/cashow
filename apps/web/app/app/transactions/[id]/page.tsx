import { formatMoney } from "@cashow/domain";
import { getTransaction } from "@cashow/services";
import { ArrowLeft, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AttachmentUploader } from "@/components/ledger/attachment-uploader";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { LinkButton } from "@/components/ledger/link-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={income ? "default" : transfer ? "outline" : "secondary"}>
                  {feeForTransfer
                    ? "Biaya transfer"
                    : transfer
                      ? "Transfer"
                      : income
                        ? "Pemasukan"
                        : "Pengeluaran"}
                </Badge>
                {transaction.source === "QUICK_ADD" ? (
                  <Badge variant="outline">Catat cepat</Badge>
                ) : null}
              </div>
              <CardTitle className="mt-3 text-xl">{title}</CardTitle>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
                  income ? "text-emerald-600 dark:text-emerald-400" : "",
                )}
              >
                {income ? "+" : transfer ? "" : "−"}
                {formatMoney(transaction.amount)}
              </p>
              {transfer && transaction.transferFeeAmount !== null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Plus biaya {formatMoney(transaction.transferFeeAmount)} di akun asal.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
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
                    >
                      <Pencil aria-hidden="true" />
                      Ubah
                    </LinkButton>
                  ) : null}
                  {feeForTransfer ? null : (
                    <form action={deleteTransactionAction}>
                      <input type="hidden" name="transactionId" value={transaction.id} />
                      <ConfirmSubmitButton
                        size="sm"
                        message={
                          transfer
                            ? "Hapus transfer ini? Biaya transfernya ikut terhapus."
                            : "Hapus transaksi ini? Catatan tetap tersimpan dan bisa dipulihkan."
                        }
                      >
                        <Trash2 aria-hidden="true" />
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
                    <RotateCcw aria-hidden="true" />
                    Pulihkan
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Tanggal" value={displayDateTime(transaction.occurredAt, user.timezone)} />
            <Row label="Tanggal buku" value={displayLocalDate(transaction.occurredOn)} />
            {transfer ? (
              <>
                <Row label="Dari akun" value={transaction.accountName} />
                <Row label="Ke akun" value={transaction.destinationAccountName ?? "—"} />
              </>
            ) : (
              <Row label="Akun" value={transaction.accountName} />
            )}
            {transaction.type === "INCOME" || transaction.type === "EXPENSE" ? (
              <Row label="Kategori" value={transaction.categoryName ?? "Tanpa kategori"} />
            ) : null}
            {transaction.planId === null || transaction.planName === null ? null : (
              <div>
                <dt className="text-xs text-muted-foreground">Rencana pembayaran</dt>
                <dd className="mt-0.5">
                  <Link href={`/app/plans/${transaction.planId}`} className="hover:underline">
                    {transaction.planName}
                    {transaction.planItemLabel === null ? "" : ` · ${transaction.planItemLabel}`}
                  </Link>
                </dd>
              </div>
            )}
            {transfer && transaction.transferFeeId !== null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Biaya transfer</dt>
                <dd className="mt-0.5">
                  <Link
                    href={`/app/transactions/${transaction.transferFeeId}`}
                    className="hover:underline"
                  >
                    {transaction.transferFeeAmount === null
                      ? "Lihat biaya"
                      : formatMoney(transaction.transferFeeAmount)}
                  </Link>
                </dd>
              </div>
            ) : null}
            {feeForTransfer && transaction.transferId !== null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Untuk transfer</dt>
                <dd className="mt-0.5">
                  <Link
                    href={`/app/transactions/${transaction.transferId}`}
                    className="hover:underline"
                  >
                    Buka transfer
                  </Link>
                </dd>
              </div>
            ) : null}
            {transaction.merchant === null ? null : (
              <Row label="Toko / penerima" value={transaction.merchant} />
            )}
            {transaction.counterparty === null ? null : (
              <Row label="Sumber" value={transaction.counterparty} />
            )}
            <Row label="Dicatat" value={displayDateTime(transaction.createdAt, user.timezone)} />
            <Row label="ID" value={transaction.id} mono />
          </dl>

          {transaction.note === null ? null : (
            <>
              <Separator className="my-4" />
              <p className="whitespace-pre-wrap text-sm">{transaction.note}</p>
            </>
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
                        <p className="truncate text-xs font-medium">{attachment.fileName}</p>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words", mono ? "font-mono text-xs" : "")}>{value}</dd>
    </div>
  );
}
