import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { LogsRepo, LogQuery } from "../store/logsRepo.js";

type Pre = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function registerLogsRoutes(
  app: FastifyInstance,
  logs: Pick<LogsRepo, "query">,
  guard: Pre,
): void {
  app.get<{ Querystring: { level?: string; accountId?: string; limit?: string } }>(
    "/admin/api/logs",
    { preHandler: guard },
    async (req, reply) => {
      const q: LogQuery = { limit: 200 };
      const level = Number(req.query.level);
      if (Number.isFinite(level) && level > 0) q.minLevel = level;
      const accountId = Number(req.query.accountId);
      if (Number.isFinite(accountId) && accountId > 0) q.accountId = accountId;
      const limit = Number(req.query.limit);
      if (Number.isFinite(limit) && limit > 0) q.limit = limit;
      try {
        return await logs.query(q);
      } catch (err) {
        req.log.error({ err }, "logs query failed");
        return reply.code(500).send({ ok: false, error: "query_failed" });
      }
    },
  );
}
