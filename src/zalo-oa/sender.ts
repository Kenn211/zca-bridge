import { request } from "undici";
import { Sender, ZaloThreadKind, QuoteSource, ZaloFileRejectedError } from "../zalo/types.js";
import { buildMultipart } from "../chatwoot/multipart.js";

// Zalo OA Message API v3.0 requires a message-type sub-path; the bare /v3.0/oa/message
// returns 404 "empty or invalid API". `cs` = consultation (tư vấn): the free reply to a
// user who messaged the OA within the 7-day customer-service window.
const MESSAGE_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

// A few common document content-types; Zalo's /upload/file infers most from the
// filename, so anything unrecognised falls back to a generic binary type.
const FILE_CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

function fileContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_CONTENT_TYPE[ext] ?? "application/octet-stream";
}
// Zalo error codes meaning "cannot send a free message now" (out of consultation window / quota).
// Confirm the exact set against current docs during execution (spec open item).
const WINDOW_ERROR_CODES = new Set([-32, -33, -2008]);

export class OaWindowError extends Error {}

/** Zalo returned a non-zero, non-window error code for a send. */
export class OaSendError extends Error {
  constructor(public readonly code: number, message: string) { super(message); }
}

export class OaSender implements Sender {
  constructor(private getAccessToken: () => Promise<string>) {}

  async sendText(threadId: string, _kind: ZaloThreadKind, text: string, quote?: QuoteSource): Promise<{ msgId: string }> {
    const recipient = { user_id: threadId };
    const qid = quote?.msgId?.trim();
    if (!qid) return this.send({ recipient, message: { text } });
    try {
      return await this.send({ recipient, message: { text, quote_message_id: qid } });
    } catch (err) {
      // Zalo rejected the quote (e.g. stale/invalid id): still deliver the reply, unquoted.
      // If this unquoted retry also fails it propagates to the queue (which retries) — by design.
      // Window errors and transport failures are not quote problems — let them propagate.
      if (err instanceof OaSendError) return this.send({ recipient, message: { text } });
      throw err;
    }
  }

  async sendAttachment(threadId: string, _kind: ZaloThreadKind, file: { filename: string; data: Buffer }, caption: string): Promise<{ msgId: string }> {
    const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
    // Zalo OA has two upload paths: images go through /upload/image (png/jpeg/gif/webp
    // only) and are sent as a media template; every other file type goes through
    // /upload/file and is sent as a `file` attachment. Routing a non-image through the
    // image endpoint returns "-201 file is invalid. We only support png and jpeg".
    return IMAGE_EXTS.has(ext)
      ? this.sendImage(threadId, file, caption, ext)
      : this.sendFile(threadId, file, caption);
  }

  private async sendImage(threadId: string, file: { filename: string; data: Buffer }, caption: string, ext: string): Promise<{ msgId: string }> {
    const contentType =
      ext === "png" ? "image/png" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" :
      "image/jpeg";
    const attachmentId = await this.upload("https://openapi.zalo.me/v2.0/oa/upload/image", file.filename, contentType, file.data, "attachment_id", "OA upload failed");
    return this.send({
      recipient: { user_id: threadId },
      message: { text: caption || undefined, attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "image", attachment_id: attachmentId }] } } },
    });
  }

  private async sendFile(threadId: string, file: { filename: string; data: Buffer }, caption: string): Promise<{ msgId: string }> {
    const token = await this.upload("https://openapi.zalo.me/v2.0/oa/upload/file", file.filename, fileContentType(file.filename), file.data, "token", "OA file upload failed");
    return this.send({
      recipient: { user_id: threadId },
      message: { text: caption || undefined, attachment: { type: "file", payload: { token } } },
    });
  }

  // Upload one multipart file and return the identifier Zalo issues for it
  // (`attachment_id` for images, `token` for files).
  private async upload(url: string, filename: string, contentType: string, data: Buffer, idField: "attachment_id" | "token", errLabel: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const { body, contentType: multipartContentType } = buildMultipart(
      {},
      [{ name: "file", filename, contentType, content: data }],
    );
    const res = await request(url, {
      method: "POST",
      headers: { access_token: accessToken, "content-type": multipartContentType, "content-length": String(body.length) },
      body,
    });
    const json = (await res.body.json()) as any;
    const id = json?.data?.[idField];
    if (!id) throw new ZaloFileRejectedError(filename, `${errLabel}: ${json?.error} ${json?.message ?? ""}`.trim());
    return String(id);
  }

  private async send(payload: unknown): Promise<{ msgId: string }> {
    const token = await this.getAccessToken();
    const res = await request(MESSAGE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", access_token: token },
      body: JSON.stringify(payload),
    });
    const json = (await res.body.json()) as any;
    const code = Number(json?.error ?? -1);
    if (code === 0) return { msgId: String(json?.data?.message_id ?? "") };
    if (WINDOW_ERROR_CODES.has(code)) throw new OaWindowError(`OA send blocked (window/quota): ${code} ${json?.message ?? ""}`.trim());
    throw new OaSendError(code, `OA send failed: ${code} ${json?.message ?? ""}`.trim());
  }
}
