import { listTransactions } from "@cashow/services";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

function escapeCsv(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Mitigate CSV Formula Injection (CWE-1236) on string values
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const searchParams = request.nextUrl.searchParams;
  const rawType = searchParams.get("type");
  const type =
    rawType === "INCOME" || rawType === "EXPENSE" || rawType === "TRANSFER" ? rawType : undefined;
  const accountId = searchParams.get("accountId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const includeDeleted = searchParams.get("deleted") === "1";

  // Fetch up to 5,000 transactions per query
  const result = await listTransactions(ctx, {
    type,
    accountId: accountId === "" ? undefined : accountId,
    categoryId: categoryId === "" ? undefined : categoryId,
    search: search === "" ? undefined : search,
    from: from === "" ? undefined : from,
    to: to === "" ? undefined : to,
    includeDeleted,
    limit: 5000,
    offset: 0,
  });

  const firstBatch = unwrap(result);
  const allItems = [...firstBatch.items];
  const total = firstBatch.total;

  if (total > allItems.length) {
    const pages = Math.ceil(total / 5000);
    for (let p = 1; p < pages; p++) {
      const batchResult = await listTransactions(ctx, {
        type,
        accountId: accountId === "" ? undefined : accountId,
        categoryId: categoryId === "" ? undefined : categoryId,
        search: search === "" ? undefined : search,
        from: from === "" ? undefined : from,
        to: to === "" ? undefined : to,
        includeDeleted,
        limit: 5000,
        offset: p * 5000,
      });
      allItems.push(...unwrap(batchResult).items);
    }
  }

  const headers = [
    "id",
    "tanggal",
    "waktu",
    "jenis",
    "jumlah",
    "akun",
    "akun_tujuan",
    "kategori",
    "toko_penerima",
    "sumber",
    "catatan",
    "rencana",
    "tahap_rencana",
    "biaya_transfer",
  ];

  const rows = [headers.join(",")];

  for (const item of allItems) {
    const row = [
      escapeCsv(item.id),
      escapeCsv(item.occurredOn),
      escapeCsv(item.occurredAt),
      escapeCsv(item.type),
      escapeCsv(item.amount.toString()),
      escapeCsv(item.accountName),
      escapeCsv(item.destinationAccountName),
      escapeCsv(item.categoryName),
      escapeCsv(item.merchant),
      escapeCsv(item.counterparty),
      escapeCsv(item.note),
      escapeCsv(item.planName),
      escapeCsv(item.planItemLabel),
      escapeCsv(item.transferFeeAmount?.toString() ?? ""),
    ];
    rows.push(row.join(","));
  }

  const csv = rows.join("\r\n");
  const filename = `cashow-transaksi-${from ?? "awal"}-${to ?? "akhir"}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
