import { Zalo, LoginQRCallbackEventType } from "zca-js";
import type { LoginQRCallbackEvent } from "zca-js";
import { QrLoginService } from "../admin/routes.js";
import { SessionManager } from "./sessionManager.js";
import { ZcaAdapter } from "./zcaAdapter.js";
import { AccountRepo } from "../store/accountRepo.js";
import { MappingRepo } from "../store/mappingRepo.js";
import { encryptCredentials } from "../crypto/credentials.js";
import { IncomingMessage } from "./types.js";

export class ZcaQrLoginService implements QrLoginService {
  constructor(
    private sessions: SessionManager,
    private accounts: AccountRepo,
    private mapping: MappingRepo,
    private credentialsKey: Buffer,
    private onInbound: (accountId: number, msg: IncomingMessage) => void
  ) {}

  async startLogin(accountId: number): Promise<{ qrImageBase64: string }> {
    const zalo = new Zalo({ selfListen: true });
    return await new Promise((resolve, reject) => {
      let resolved = false;
      zalo
        .loginQR({}, async (event: LoginQRCallbackEvent) => {
          if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
            const img = event.data?.image;
            const dataUrl = img?.startsWith("data:") ? img : `data:image/png;base64,${img}`;
            if (!resolved) { resolved = true; resolve({ qrImageBase64: dataUrl }); }
          }
          if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
            try {
              const creds = { imei: event.data.imei, cookie: event.data.cookie, userAgent: event.data.userAgent, language: "vi" };
              await this.mapping.saveCredentials(accountId, encryptCredentials(creds, this.credentialsKey));
              const adapter = await ZcaAdapter.fromCredentials(creds);
              this.sessions.register(accountId, adapter);
              this.sessions.bindInbound(accountId, this.onInbound);
              await this.accounts.updateStatus(accountId, "connected");
            } catch (err) {
              console.error("QR login GotLoginInfo error for account", accountId, err);
              await this.accounts.updateStatus(accountId, "expired").catch(() => {});
            }
          }
        })
        .catch((err: unknown) => { if (!resolved) { resolved = true; reject(err); } });
    });
  }
}
