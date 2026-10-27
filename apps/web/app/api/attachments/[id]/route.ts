import { isLedgerError, readAttachment } from "@cashow/services";
import { findLedgerSession } from "@/lib/ledger";
import { attachmentStorage } from "@/lib/storage";

/** Serve one attachment to its owner; bytes never leave the session scope. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await findLedgerSession();
  if (session === null) {
    return Response.json({ ok: false, message: "Sesi berakhir." }, { status: 401 });
  }

  const { id } = await params;
  const result = await readAttachment(session.ctx, attachmentStorage, id);
  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.error.message },
      { status: isLedgerError(result.error) ? result.error.status : 500 },
    );
  }

  const { attachment, bytes } = result.value;
  const safeName = attachment.fileName.replace(/["\r\n]/g, "_");
  const body = new Blob([new Uint8Array(bytes)], { type: attachment.mimeType });

  return new Response(body, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": body.size.toString(),
      "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
