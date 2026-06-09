import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AccountRepo } from "../store/accountRepo.js";

export interface QrLoginService {
  startLogin(accountId: number): Promise<{ qrImageBase64: string }>;
}

export interface InboxProvisioner {
  createInboxForAccount(label: string): Promise<{ identifier: string; id: number }>;
}

export interface AdminRouteOptions {
  provisioner?: InboxProvisioner;
  refreshInboxIndex?: () => Promise<void>;
  applyProxy?: (accountId: number) => Promise<void>;
}

type AccountCreateBody = {
  label?: string;
  inboxMode?: "auto" | "existing" | string;
  chatwootInboxIdentifier?: string;
  chatwootInboxId?: number | string | null;
  proxyId?: number | string | null;
};

type Pre = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

function parsePositiveSafeInt(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string") {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }
  return null;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  accounts: AccountRepo,
  qr: QrLoginService,
  guard: Pre,
  opts: AdminRouteOptions = {},
): void {
  const refreshInboxIndexBestEffort = async (): Promise<void> => {
    if (!opts.refreshInboxIndex) return;
    try {
      await opts.refreshInboxIndex();
    } catch {
      // Account creation has already succeeded; keep refresh best-effort here.
    }
  };

  const parseInboxId = (value: unknown, reply: FastifyReply): number | null => {
    const inboxId = parsePositiveSafeInt(value);
    if (inboxId === null) {
      reply.code(400).send({ ok: false, error: "invalid_chatwoot_inbox_id" });
      return null;
    }
    return inboxId;
  };

  const parseProxyId = (value: unknown): number | null | undefined => {
    if (value === undefined) return undefined;      // not provided → leave unchanged
    if (value === null || value === "") return null; // explicit "no proxy"
    return parsePositiveSafeInt(value);             // number | null (null = invalid)
  };

  const createInput = async (
    body: AccountCreateBody,
    reply: FastifyReply,
  ): Promise<{ label: string; chatwootInboxIdentifier: string; chatwootInboxId?: number; proxyId?: number | null } | null> => {
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      reply.code(400).send({ ok: false });
      return null;
    }

    if (body?.inboxMode !== undefined && body.inboxMode !== "auto" && body.inboxMode !== "existing") {
      reply.code(400).send({ ok: false, error: "invalid_inbox_mode" });
      return null;
    }

    const proxyId = parseProxyId(body?.proxyId);
    if (proxyId === null && body?.proxyId !== null && body?.proxyId !== "" && body?.proxyId !== undefined) {
      // a non-empty value that failed to parse to a positive int
      reply.code(400).send({ ok: false, error: "invalid_proxy_id" });
      return null;
    }

    const explicitExisting = body?.inboxMode === "existing";
    const legacyExisting = !body?.inboxMode && typeof body?.chatwootInboxIdentifier === "string" && body.chatwootInboxIdentifier.trim() !== "";
    if (explicitExisting || legacyExisting) {
      const ident = typeof body?.chatwootInboxIdentifier === "string" ? body.chatwootInboxIdentifier.trim() : "";
      if (!ident) {
        reply.code(400).send({ ok: false, error: "chatwoot_inbox_identifier_required" });
        return null;
      }
      if (body.chatwootInboxId === undefined || body.chatwootInboxId === null) {
        reply.code(400).send({ ok: false, error: "chatwoot_inbox_id_required" });
        return null;
      }
      const inboxId = parseInboxId(body.chatwootInboxId, reply);
      if (inboxId === null) return null;
      return { label, chatwootInboxIdentifier: ident, chatwootInboxId: inboxId, proxyId: proxyId ?? null };
    }

    if (!opts.provisioner) {
      reply.code(400).send({ ok: false, error: "chatwoot_config_missing" });
      return null;
    }

    try {
      const inbox = await opts.provisioner.createInboxForAccount(label);
      return { label, chatwootInboxIdentifier: inbox.identifier, chatwootInboxId: inbox.id, proxyId: proxyId ?? null };
    } catch (err: any) {
      const code = typeof err?.code === "string" ? err.code : "chatwoot_inbox_create_failed";
      const status = code === "chatwoot_config_missing" ? 400 : 502;
      reply.code(status).send({ ok: false, error: code });
      return null;
    }
  };

  app.get("/admin/api/accounts", { preHandler: guard }, async () => accounts.listAll());

  app.post<{ Body: AccountCreateBody }>(
    "/admin/api/accounts",
    { preHandler: guard },
    async (req, reply) => {
      const input = await createInput(req.body, reply);
      if (!input) return reply;
      const acc = await accounts.create(input);
      await refreshInboxIndexBestEffort();
      return acc;
    },
  );

  app.post<{ Body: AccountCreateBody }>(
    "/admin/api/accounts/oa",
    { preHandler: guard },
    async (req, reply) => {
      const input = await createInput(req.body, reply);
      if (!input) return reply;
      const acc = await accounts.createOa(input);
      await refreshInboxIndexBestEffort();
      return reply.send({ ok: true, account: acc });
    },
  );

  app.patch<{ Params: { id: string }; Body: { label?: string; chatwootInboxIdentifier?: string; chatwootInboxId?: number | string | null; proxyId?: number | string | null } }>(
    "/admin/api/accounts/:id",
    { preHandler: guard },
    async (req, reply) => {
      const id = parsePositiveSafeInt(req.params.id);
      if (id === null) return reply.code(400).send({ ok: false });
      const patch: { label?: string; chatwootInboxIdentifier?: string; chatwootInboxId?: number } = {};
      if (typeof req.body?.label === "string") patch.label = req.body.label;
      if (typeof req.body?.chatwootInboxIdentifier === "string") {
        if (req.body.chatwootInboxIdentifier.trim() === "") return reply.code(400).send({ ok: false });
        if (req.body.chatwootInboxId === undefined || req.body.chatwootInboxId === null) {
          return reply.code(400).send({ ok: false, error: "chatwoot_inbox_id_required" });
        }
        patch.chatwootInboxIdentifier = req.body.chatwootInboxIdentifier;
      }
      if (req.body?.chatwootInboxId !== undefined) {
        if (req.body.chatwootInboxId === null) {
          return reply.code(400).send({ ok: false, error: "chatwoot_inbox_id_required" });
        }
        const inboxId = parseInboxId(req.body.chatwootInboxId, reply);
        if (inboxId === null) return reply;
        patch.chatwootInboxId = inboxId;
      }
      const proxyId = parseProxyId(req.body?.proxyId);
      if (proxyId === null && req.body?.proxyId !== null && req.body?.proxyId !== "" && req.body?.proxyId !== undefined) {
        return reply.code(400).send({ ok: false, error: "invalid_proxy_id" });
      }
      if (proxyId !== undefined) {
        const cur = await accounts.findById(id);
        if (cur && cur.proxyId !== proxyId) {
          await accounts.setProxy(id, proxyId); // marks proxy_pending = true (only on a real change)
        }
      }
      const updated = await accounts.update(id, patch);
      if (!updated) return reply.code(404).send({ ok: false });
      return reply.send({ ok: true, account: updated });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/api/accounts/:id/login",
    { preHandler: guard },
    async (req, reply) => {
      const id = parsePositiveSafeInt(req.params.id);
      if (id === null) return reply.code(400).send({ ok: false });
      return qr.startLogin(id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/api/accounts/:id/apply-proxy",
    { preHandler: guard },
    async (req, reply) => {
      const id = parsePositiveSafeInt(req.params.id);
      if (id === null) return reply.code(400).send({ ok: false });
      if (!opts.applyProxy) return reply.code(400).send({ ok: false, error: "apply_proxy_unavailable" });
      await opts.applyProxy(id);
      return reply.send({ ok: true });
    },
  );
}

export function registerAccountDeleteRoute(
  app: FastifyInstance,
  accounts: Pick<AccountRepo, "delete">,
  supervisor: { remove: (accountId: number) => Promise<void> },
  refreshIndex: () => Promise<void>,
  guard: Pre,
): void {
  app.delete<{ Params: { id: string } }>(
    "/admin/api/accounts/:id",
    { preHandler: guard },
    async (req, reply) => {
      const id = parsePositiveSafeInt(req.params.id);
      if (id === null) return reply.code(400).send({ ok: false });
      await supervisor.remove(id);
      const deleted = await accounts.delete(id);
      if (!deleted) return reply.code(404).send({ ok: false });
      await refreshIndex();
      return reply.send({ ok: true });
    },
  );
}
