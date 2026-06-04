import { request } from "undici";
import { SessionManager } from "../zalo/sessionManager.js";
import { AccountRepo } from "../store/accountRepo.js";
import { MappingRepo } from "../store/mappingRepo.js";
import { decodeSourceId, ThreadKind } from "../routing/sourceId.js";
import { ZaloThreadKind, QuoteSource, ZaloFileRejectedError } from "../zalo/types.js";
import { OutgoingEvent } from "../chatwoot/webhookServer.js";
import { OaWindowError } from "../zalo-oa/sender.js";
import { EventLog, NOOP_LOG } from "../logging/eventLog.js";
import { OutboundNotifier } from "./outboundNotify.js";

interface ConsultHook { onOutbound(accountId: number, sourceId: string): Promise<void>; }

const MSG_NO_SESSION = "⚠️ Tài khoản Zalo đang mất kết nối — tin chưa được gửi. Hãy kết nối lại Zalo rồi gửi lại.";
const fileRejectedNote = (name: string): string =>
  `⚠️ Không gửi được tệp «${name}» sang Zalo — định dạng không được hỗ trợ hoặc tệp quá lớn.`;
const downloadFailedNote = (name: string): string =>
  `⚠️ Không tải được tệp đính kèm «${name}» từ Chatwoot để gửi sang Zalo.`;
const nameFromUrl = (url: string): string => url.split("/").pop()?.split("?")[0] || "tệp";

function toZaloKind(kind: ThreadKind): ZaloThreadKind {
  if (kind === ThreadKind.Group) return ZaloThreadKind.Group;
  if (kind === ThreadKind.OaUser) return ZaloThreadKind.OaUser;
  return ZaloThreadKind.User;
}

export class OutboundHandler {
  constructor(
    private sessions: SessionManager,
    private accounts: AccountRepo,
    private inboxIdentifierForId: (inboxId: number) => string | null,
    private mapping: MappingRepo,
    private chatwootBaseUrl: string,
    private onWindowBlocked: (evt: OutgoingEvent) => Promise<void> = async () => {},
    private log: EventLog = NOOP_LOG,
    private consult?: ConsultHook,
    private notify: OutboundNotifier = async () => {},
  ) {}

  async handle(evt: OutgoingEvent): Promise<void> {
    // Anti-loop: this Chatwoot message was imported FROM a Zalo native send.
    // Re-sending it would deliver a duplicate to the customer.
    if (await this.mapping.findByChatwootMessageId(evt.chatwootMessageId)) return;

    const identifier = this.inboxIdentifierForId(evt.inboxId);
    if (!identifier) { this.log.warn({ event: "outbound_skipped", reason: "no_inbox_identifier", inboxId: evt.inboxId, chatwootMessageId: evt.chatwootMessageId }, "outbound skipped"); return; }
    const account = await this.accounts.findByInboxIdentifier(identifier);
    if (!account) { this.log.warn({ event: "outbound_skipped", reason: "no_account", inboxId: evt.inboxId, chatwootMessageId: evt.chatwootMessageId }, "outbound skipped"); return; }
    if (!this.sessions.has(account.id)) {
      this.log.warn({ event: "outbound_skipped", reason: "no_session", accountId: account.id, chatwootMessageId: evt.chatwootMessageId }, "outbound skipped");
      await this.notify(evt, MSG_NO_SESSION); // session expired/not connected → tell the agent, drop the message
      return;
    }

    const { kind, threadId } = decodeSourceId(evt.sourceId);
    const zaloKind = toZaloKind(kind);

    let sentAny = false;
    for (const att of evt.attachments) {
      const file = await this.download(att.dataUrl);
      if (!file) {
        // download() returns null only for a permanent (4xx) failure; transient errors throw.
        this.log.warn({ event: "outbound_skipped", reason: "attachment_download_failed", accountId: account.id, chatwootMessageId: evt.chatwootMessageId }, "outbound attachment download failed");
        await this.notify(evt, downloadFailedNote(nameFromUrl(att.dataUrl)));
        continue;
      }
      try {
        const { msgId } = await this.sessions.sendAttachment(account.id, threadId, zaloKind, file, sentAny ? "" : evt.content);
        await this.recordSent(account.id, msgId, threadId, evt.chatwootMessageId);
        sentAny = true;
      } catch (err) {
        if (err instanceof OaWindowError) {
          this.log.warn({ event: "outbound_failed", reason: "oa_window", accountId: account.id, chatwootMessageId: evt.chatwootMessageId }, "outbound attachment blocked by OA window");
          await this.onWindowBlocked(evt); return;
        }
        if (err instanceof ZaloFileRejectedError) {
          // Permanent: Zalo refused this file. Notify with the name and skip it — retrying is futile.
          this.log.warn({ event: "outbound_failed", reason: "file_rejected", accountId: account.id, chatwootMessageId: evt.chatwootMessageId }, "outbound attachment rejected by Zalo");
          await this.notify(evt, fileRejectedNote(err.filename || file.filename));
          continue;
        }
        this.log.error({ event: "outbound_failed", reason: "attachment", accountId: account.id, chatwootMessageId: evt.chatwootMessageId, err }, "outbound attachment send failed");
        throw err;
      }
    }
    if (!sentAny && evt.content && evt.content.trim() !== "") {
      // Native reply: when the agent replied to a message, quote the original Zalo message
      // (only possible when we stored its quote source — i.e. an inbound/self message).
      const quote = await this.resolveQuote(evt.inReplyTo);
      try {
        const { msgId } = await this.sessions.sendText(account.id, threadId, zaloKind, evt.content, quote);
        await this.recordSent(account.id, msgId, threadId, evt.chatwootMessageId);
        sentAny = true;
      } catch (err) {
        if (err instanceof OaWindowError) {
          this.log.warn({ event: "outbound_failed", reason: "oa_window", accountId: account.id, chatwootMessageId: evt.chatwootMessageId }, "outbound blocked by OA window");
          await this.onWindowBlocked(evt); return;
        }
        this.log.error({ event: "outbound_failed", accountId: account.id, chatwootMessageId: evt.chatwootMessageId, err }, "outbound send failed");
        throw err;
      }
    }
    if (sentAny && account.type === "oa") {
      this.consult?.onOutbound(account.id, evt.sourceId).catch((err) => this.log.warn({ event: "consult_failed", accountId: account.id, sourceId: evt.sourceId, err }, "consultation onOutbound failed"));
    }
  }

  private async resolveQuote(inReplyTo: number | undefined): Promise<QuoteSource | undefined> {
    if (inReplyTo == null) return undefined;
    const mapped = await this.mapping.findByChatwootMessageId(inReplyTo);
    return mapped?.quoteSrc ?? undefined;
  }

  // Link the Zalo msg id we just sent to its Chatwoot message id. When this send
  // echoes back via selfListen, the inbound self handler finds the msg id and skips it.
  private async recordSent(accountId: number, msgId: string, threadId: string, chatwootMessageId: number): Promise<void> {
    await this.mapping.recordIfNew({
      zaloAccountId: accountId, zaloMsgId: msgId, zaloThreadId: threadId,
      direction: "out", chatwootMessageId,
    });
    this.log.info({ event: "outbound_sent", accountId, chatwootMessageId, zaloMsgId: msgId }, "outbound sent to Zalo");
  }

  // Webhook data_urls use Chatwoot's public FRONTEND_URL (e.g. localhost), which is
  // unreachable from inside the bridge container. Rewrite the origin to the internal base.
  private toInternalUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl);
      const base = new URL(this.chatwootBaseUrl);
      u.protocol = base.protocol;
      u.host = base.host; // hostname + port
      return u.toString();
    } catch {
      return rawUrl;
    }
  }

  private async download(url: string): Promise<{ filename: string; data: Buffer } | null> {
    let target = this.toInternalUrl(url);
    if (!/^https?:\/\//i.test(target)) return null; // non-fetchable ref (e.g. data:) → permanent
    let res = await request(target, { method: "GET", headersTimeout: 10_000, bodyTimeout: 30_000 });
    // Chatwoot's blobs/redirect data_url 302s to the signed disk URL. undici does not follow
    // redirects here, so follow manually (rewriting each hop to the internal host).
    let hops = 0;
    while (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) {
      res.body.dump();
      target = this.toInternalUrl(String(res.headers.location));
      res = await request(target, { method: "GET", headersTimeout: 10_000, bodyTimeout: 30_000 });
      hops++;
    }
    // 5xx (and any network/timeout error above, which throws) is transient → let it propagate so the
    // queue retries. 4xx means the blob is gone/forbidden → permanent, signalled by returning null.
    if (res.statusCode >= 500) { res.body.dump(); throw new Error(`attachment download failed (${res.statusCode}): ${target}`); }
    if (res.statusCode >= 400) { res.body.dump(); return null; }
    const data = Buffer.from(await res.body.arrayBuffer());
    const filename = target.split("/").pop()?.split("?")[0] || "attachment";
    return { filename, data };
  }
}
