import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { registerLogsRoutes } from "../../src/admin/logsRoutes.js";

function build(query: (q: any) => Promise<any[]>, guard?: any) {
  const app = Fastify();
  const logs = { query: vi.fn(query) };
  registerLogsRoutes(app, logs as any, guard ?? (async () => {}));
  return { app, logs };
}

describe("logs routes", () => {
  it("returns rows and passes parsed filters to the repo", async () => {
    const { app, logs } = build(async () => [{ id: 1, ts: "t", level: 50, event: "e", accountId: 3, msg: "m", context: {} }]);
    const res = await app.inject({ method: "GET", url: "/admin/api/logs?level=40&accountId=3&limit=50" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 1, ts: "t", level: 50, event: "e", accountId: 3, msg: "m", context: {} }]);
    expect(logs.query).toHaveBeenCalledWith({ minLevel: 40, accountId: 3, limit: 50 });
  });

  it("defaults limit to 200 and omits absent filters", async () => {
    const { app, logs } = build(async () => []);
    await app.inject({ method: "GET", url: "/admin/api/logs" });
    expect(logs.query).toHaveBeenCalledWith({ limit: 200 });
  });

  it("enforces the auth guard", async () => {
    const guard = vi.fn(async (_req: any, reply: any) => { reply.code(401).send({ ok: false }); });
    const { app, logs } = build(async () => [], guard);
    const res = await app.inject({ method: "GET", url: "/admin/api/logs" });
    expect(res.statusCode).toBe(401);
    expect(logs.query).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking details when the query throws", async () => {
    const { app } = build(async () => { throw new Error("pg exploded: secret dsn"); });
    const res = await app.inject({ method: "GET", url: "/admin/api/logs" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ ok: false, error: "query_failed" });
    expect(JSON.stringify(res.json())).not.toContain("secret dsn");
  });
});
