import { isLedgerError, uploadAttachment } from "@cashow/services";
import { findLedgerSession } from "@/lib/ledger";
import { attachmentStorage } from "@/lib/storage";

/**
 * Receipt/invoice upload. The browser compresses large photos before sending,
 * so a 10 MB guard in the service is a backstop, not the normal path.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await findLedgerSession();
  if (session === null) {
    return Response.json({ ok: false, message: "Sesi berakhir." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "Unggahan tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  const transactionId = form.get("transactionId");
  const kind = form.get("kind");

  if (!(file instanceof File) || typeof transactionId !== "string" || transactionId === "") {
    return Response.json(
      { ok: false, message: "Berkas dan transaksi wajib ada." },
      { status: 400 },
    );
  }

  const result = await uploadAttachment(session.ctx, attachmentStorage, {
    transactionId,
    kind: typeof kind === "string" && kind !== "" ? kind : undefined,
    fileName: file.name === "" ? "lampiran" : file.name,
    mimeType: file.type === "" ? "application/octet-stream" : file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.error.message },
      { status: isLedgerError(result.error) ? result.error.status : 500 },
    );
  }

  return Response.json({
    ok: true,
    attachment: {
      id: result.value.id,
      fileName: result.value.fileName,
      mimeType: result.value.mimeType,
      byteSize: result.value.byteSize.toString(),
    },
  });
}
