import { request } from "undici";
import { ChatwootClient, Attachment } from "../chatwoot/client.js";
import { ChatwootAppClient } from "../chatwoot/appClient.js";
import { MappingRepo } from "../store/mappingRepo.js";
import { ConversationRepo } from "../store/conversationRepo.js";
import { IncomingMessage, ZaloThreadKind, toRoutingKindOf } from "../zalo/types.js";
import { MediaKind, MEDIA_LABEL } from "../zalo/classify.js";
import { MediaArchive } from "../media/archive.js";
import { encodeSourceId } from "../routing/sourceId.js";
import { EventLog, NOOP_LOG } from "../logging/eventLog.js";

type EnrichFn = (accountId: number, sourceId: string, identifier: string, senderUid: string) => Promise<void>;

interface ConsultHook { onInbound(accountId: number, sourceId: string): Promise<void>; }
interface InfoRequestHook { onInbound(accountId: number, sourceId: string): Promise<void>; }
interface WatermarkHook { onRelayed(accountId: number, timeMs: number): void; }

// Prefix on messages the operator sent directly from the native Zalo app.
const SELF_PREFIX = "📱 từ app Zalo";

const MEDIA_ICON: Record<MediaKind, string> = { image: "🖼️", audio: "🎙️", video: "🎥", file: "📎" };

function safeName(name: string): string {
  const cleaned = (name || "file").replace(/[/\\]/g, "_").replace(/[^\w.\-]/g, "_").replace(/^\.+$/, "file").slice(0, 120);
  return cleaned || "file";
}

function archiveKey(accountId: number, msg: IncomingMessage, filename: string): string {
  const kind = msg.kind === ZaloThreadKind.Group ? "group" : "user";
  return `${accountId}/${kind}_${msg.threadId}/${msg.msgId}_${safeName(filename)}`;
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  gif: "image/gif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", ogg: "audio/ogg",
  pdf: "application/pdf",
};

// Canonical extension per content-type (reverse of EXT_CONTENT_TYPE; jpg is canonical for jpeg).
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mp4": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/ogg": "ogg",
  "application/pdf": "pdf",
};

// Make the filename extension reflect the real content-type. Zalo's sticker `webpc` endpoint,
// for instance, serves a GIF, so a resolver-guessed ".png" would mislabel the archived file.
// Unknown content-types and already-correct extensions are left untouched.
export function alignExtension(filename: string, contentType: string): string {
  const want = CONTENT_TYPE_EXT[contentType];
  if (!want) return filename;
  const current = filename.split(".").pop()?.toLowerCase() ?? "";
  if (current === want || (want === "jpg" && current === "jpeg")) return filename;
  const base = filename.replace(/\.[A-Za-z0-9]+$/, "");
  return `${base}.${want}`;
}

function contentTypeFor(mediaType: MediaKind, filename: string, downloaded: string): string {
  if (downloaded && downloaded !== "application/octet-stream") return downloaded;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_CONTENT_TYPE[ext]) return EXT_CONTENT_TYPE[ext];
  switch (mediaType) {
    case "image": return "image/jpeg";
    case "audio": return "audio/mp4";
    case "video": return "video/mp4";
    default: return "application/octet-stream";
  }
}

// A real attachment that fails to download must NOT be silently dropped: that loses the
// media while marking the job done. Throwing lets the durable queue retry (transient
// CDN/network failures then succeed on a later attempt).
export async function downloadMedia(href: string): Promise<{ bytes: Buffer; contentType: string }> {
  // Zalo CDN video/file downloads can be slow; allow up to 60s for the body.
  const opts = { method: "GET" as const, headersTimeout: 10_000, bodyTimeout: 60_000 };
  let target = href;
  let res = await request(target, opts);
  // OA image URLs 302-redirect to the real object. undici does not follow redirects, so
  // without this we'd read the empty redirect body (0 bytes), archive it, and Chatwoot
  // would render "image no longer available". Follow up to 5 hops manually.
  let hops = 0;
  while (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) {
    res.body.dump();
    target = new URL(String(res.headers.location), target).toString();
    res = await request(target, opts);
    hops++;
  }
  if (res.statusCode >= 400) {
    res.body.dump();
    throw new Error(`attachment download failed (${res.statusCode}): ${href}`);
  }
  const bytes = Buffer.from(await res.body.arrayBuffer());
  // A 0-byte body is never a valid attachment; throw so the durable queue retries a
  // transient failure instead of silently archiving (and relaying) a broken image.
  if (bytes.length === 0) throw new Error(`attachment download returned an empty body: ${href}`);
  const contentType = (res.headers["content-type"] as string) ?? "application/octet-stream";
  return { bytes, contentType };
}

export class InboundHandler {
  private locks = new Map<string, Promise<unknown>>(); // per source_id serialization
  private enrichedOa = new Set<string>(); // OA contacts already backfilled this process run

  constructor(
    private chatwoot: ChatwootClient,
    private mapping: MappingRepo,
    private conversations: ConversationRepo,
    private enrich: EnrichFn,
    private appClient: ChatwootAppClient,
    private archive: MediaArchive,
    private maxAttachmentBytes: number,
    private log: EventLog = NOOP_LOG,
    private consult?: ConsultHook,
    private infoRequest?: InfoRequestHook,
    private watermark?: WatermarkHook,
  ) {}

  async handle(accountId: number, identifier: string, msg: IncomingMessage): Promise<void> {
    const sourceId = encodeSourceId(toRoutingKindOf(msg.kind), msg.threadId);
    const key = `${identifier}:${sourceId}`;
    const prev = this.locks.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => this.process(accountId, identifier, sourceId, msg));
    this.locks.set(key, next);
    try { await next; } finally { if (this.locks.get(key) === next) this.locks.delete(key); }
  }

  private async process(accountId: number, identifier: string, sourceId: string, msg: IncomingMessage): Promise<void> {
    if (msg.isSelf) { await this.processSelf(accountId, identifier, sourceId, msg); return; }

    const conversationId = await this.resolveConversation(accountId, identifier, sourceId, msg);
    if (msg.kind === ZaloThreadKind.OaUser) this.consult?.onInbound(accountId, sourceId).catch((err) => this.log.warn({ event: "consult_failed", accountId, sourceId, err }, "consultation onInbound failed"));
    if (msg.kind === ZaloThreadKind.OaUser) this.infoRequest?.onInbound(accountId, sourceId).catch((err) => this.log.warn({ event: "info_request_failed", accountId, sourceId, err }, "info request onInbound failed"));
    const built = await this.buildOutput(accountId, msg);
    // Native reply: the public inbox API cannot set in_reply_to, so a resolvable quote is
    // routed through the Application API as an incoming message instead.
    const inReplyTo = await this.resolveQuote(accountId, msg);
    const created = inReplyTo != null && this.appClient.enabled
      ? await this.appClient.createIncomingMessage(conversationId, built.content, { inReplyTo, attachments: built.attachments })
      : await this.chatwoot.createMessage(identifier, sourceId, conversationId, built);
    await this.mapping.recordIfNew({
      zaloAccountId: accountId, zaloMsgId: msg.msgId, zaloThreadId: msg.threadId,
      direction: "in", chatwootMessageId: created.id, quoteSrc: msg.quoteSrc,
    });
    this.log.info({ event: "inbound_relayed", accountId, sourceId, chatwootMessageId: created.id }, "inbound relayed to Chatwoot");
    if (msg.kind === ZaloThreadKind.OaUser) {
      const t = Number(msg.quoteSrc.ts);
      if (Number.isFinite(t) && t > 0) this.watermark?.onRelayed(accountId, t);
    }
  }

  // A message the operator sent directly from the native Zalo app.
  private async processSelf(accountId: number, identifier: string, sourceId: string, msg: IncomingMessage): Promise<void> {
    // Anti-loop: a known msg id means this is the echo of a message already in Chatwoot.
    if (await this.mapping.findByZaloMsgId(accountId, msg.msgId)) return;

    const conversationId = await this.resolveConversation(accountId, identifier, sourceId, msg);
    const built = await this.buildOutput(accountId, msg);
    const content = built.content ? `${SELF_PREFIX}\n${built.content}` : SELF_PREFIX;
    const inReplyTo = await this.resolveQuote(accountId, msg);
    const created = await this.appClient.createOutgoingMessage(conversationId, content, built.attachments, { inReplyTo });
    await this.mapping.recordIfNew({
      zaloAccountId: accountId, zaloMsgId: msg.msgId, zaloThreadId: msg.threadId,
      direction: "out", chatwootMessageId: created.id, quoteSrc: msg.quoteSrc,
    });
  }

  // Resolve a quoted Zalo message id to the Chatwoot message it was relayed as, if known.
  private async resolveQuote(accountId: number, msg: IncomingMessage): Promise<number | undefined> {
    if (!msg.quoteMsgId) return undefined;
    const quoted = await this.mapping.findByZaloMsgId(accountId, msg.quoteMsgId);
    return quoted?.chatwootMessageId ?? undefined;
  }

  // Build the Chatwoot message body from a classified Zalo message. For media: download
  // once, archive (source of truth), then attach if within the size cap or post a text +
  // tokenized link when too large. Non-media types render as labelled fallback text.
  private async buildOutput(accountId: number, msg: IncomingMessage): Promise<{ content: string; attachments?: Attachment[] }> {
    const c = msg.classified;
    if (c.kind !== "media") return { content: c.text };

    const { bytes, contentType: downloaded } = await downloadMedia(c.href);
    const contentType = contentTypeFor(c.mediaType, c.filename, downloaded);
    const filename = alignExtension(c.filename, contentType);
    const key = archiveKey(accountId, msg, filename);
    await this.archive.put(key, bytes, contentType);

    if (bytes.length <= this.maxAttachmentBytes) {
      return { content: c.caption, attachments: [{ filename, content: bytes, contentType }] };
    }
    const mb = Math.ceil(bytes.length / (1024 * 1024));
    const url = this.archive.urlFor(key);
    return { content: `${MEDIA_ICON[c.mediaType]} ${MEDIA_LABEL[c.mediaType]} (${mb}MB) — quá lớn để hiển thị. Tải tại: ${url}` };
  }

  // Resolve (creating if needed) the contact + persistent conversation for a thread.
  private async resolveConversation(accountId: number, identifier: string, sourceId: string, msg: IncomingMessage): Promise<number> {
    const existing = await this.chatwoot.getContact(identifier, sourceId);
    const enrichKey = `${identifier}:${sourceId}`;
    if (!existing) {
      await this.chatwoot.createContact(identifier, { sourceId, name: msg.senderName || msg.senderUid });
      this.enrichedOa.add(enrichKey);
      this.enrich(accountId, sourceId, identifier, msg.senderUid).catch(() => {});
    } else if (msg.kind === ZaloThreadKind.OaUser && !this.enrichedOa.has(enrichKey)) {
      // OA contacts can't be named at create-time (no zca session); backfill name/avatar
      // once per process run for contacts that may still show the raw user id.
      this.enrichedOa.add(enrichKey);
      this.enrich(accountId, sourceId, identifier, msg.senderUid).catch(() => {});
    }
    let conversationId = await this.conversations.getChatwootId(accountId, sourceId);
    if (!conversationId) {
      const conv = await this.chatwoot.createConversation(identifier, sourceId);
      await this.conversations.saveChatwootId(accountId, sourceId, conv.id);
      conversationId = (await this.conversations.getChatwootId(accountId, sourceId)) ?? conv.id;
    }
    return conversationId;
  }
}
