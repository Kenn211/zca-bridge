import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AccountRepo } from "../store/accountRepo.js";

export interface QrLoginService {
  startLogin(accountId: number): Promise<{ qrImageBase64: string }>;
}

type Pre = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function registerAdminRoutes(
  app: FastifyInstance,
  accounts: AccountRepo,
  qr: QrLoginService,
  guard: Pre,
): void {
  app.get("/admin/api/accounts", { preHandler: guard }, async () => accounts.listAll());

  app.post<{ Body: { label: string; chatwootInboxIdentifier: string; chatwootInboxId?: number } }>(
    "/admin/api/accounts",
    { preHandler: guard },
    async (req) => {
      const input: { label: string; chatwootInboxIdentifier: string; chatwootInboxId?: number } = {
        label: req.body.label,
        chatwootInboxIdentifier: req.body.chatwootInboxIdentifier,
      };
      if (req.body.chatwootInboxId !== undefined && req.body.chatwootInboxId !== null) {
        input.chatwootInboxId = Number(req.body.chatwootInboxId);
      }
      return accounts.create(input);
    },
  );

  app.post<{ Body: { label: string; chatwootInboxIdentifier: string; chatwootInboxId?: number } }>(
    "/admin/api/accounts/oa",
    { preHandler: guard },
    async (req, reply) => {
      if (!req.body?.label || !req.body?.chatwootInboxIdentifier) {
        return reply.code(400).send({ ok: false });
      }
      const input: { label: string; chatwootInboxIdentifier: string; chatwootInboxId?: number } = {
        label: req.body.label,
        chatwootInboxIdentifier: req.body.chatwootInboxIdentifier,
      };
      if (req.body.chatwootInboxId !== undefined && req.body.chatwootInboxId !== null) {
        input.chatwootInboxId = Number(req.body.chatwootInboxId);
      }
      const acc = await accounts.createOa(input);
      return reply.send({ ok: true, account: acc });
    },
  );

  app.patch<{ Params: { id: string }; Body: { label?: string; chatwootInboxIdentifier?: string; chatwootInboxId?: number | null } }>(
    "/admin/api/accounts/:id",
    { preHandler: guard },
    async (req, reply) => {
      const id = Number(req.params.id);
      const patch: { label?: string; chatwootInboxIdentifier?: string; chatwootInboxId?: number | null } = {};
      if (typeof req.body?.label === "string") patch.label = req.body.label;
      if (typeof req.body?.chatwootInboxIdentifier === "string") {
        if (req.body.chatwootInboxIdentifier.trim() === "") return reply.code(400).send({ ok: false });
        patch.chatwootInboxIdentifier = req.body.chatwootInboxIdentifier;
      }
      if (req.body?.chatwootInboxId !== undefined) {
        patch.chatwootInboxId = req.body.chatwootInboxId === null ? null : Number(req.body.chatwootInboxId);
      }
      const updated = await accounts.update(id, patch);
      if (!updated) return reply.code(404).send({ ok: false });
      return reply.send({ ok: true, account: updated });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/api/accounts/:id/login",
    { preHandler: guard },
    async (req) => qr.startLogin(Number(req.params.id)),
  );
}

export function registerAccountDeleteRoute(
  app: FastifyInstance,
  accounts: Pick<AccountRepo, "delete">,
  sessions: { remove: (accountId: number) => Promise<void> },
  refreshIndex: () => Promise<void>,
  guard: Pre,
): void {
  app.delete<{ Params: { id: string } }>(
    "/admin/api/accounts/:id",
    { preHandler: guard },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ ok: false });
      await sessions.remove(id);
      const deleted = await accounts.delete(id);
      if (!deleted) return reply.code(404).send({ ok: false });
      await refreshIndex();
      return reply.send({ ok: true });
    },
  );
}
