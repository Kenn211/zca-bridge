import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { LogsRepo } from "../../src/store/logsRepo.js";
import { createPool } from "../../src/store/db.js";
import { runMigrations } from "../../src/store/migrate.js";
import type { Pool } from "pg";

function stubPool() {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const pool = {
    calls,
    query: vi.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }),
  };
  return pool;
}

describe("LogsRepo (stubbed pool)", () => {
  it("insertMany builds a multi-row INSERT with params in column order", async () => {
    const pool = stubPool();
    const ts = new Date("2026-06-03T00:00:00.000Z");
    await new LogsRepo(pool as any).insertMany([
      { ts, level: 50, event: "outbound_failed", accountId: 3, msg: "boom", context: { a: 1 } },
      { ts, level: 30, event: "inbound_relayed", accountId: null, msg: "ok", context: {} },
    ]);
    const call = pool.calls[0];
    expect(call.sql).toContain("INSERT INTO event_logs");
    expect(call.sql).toContain("($1, $2, $3, $4, $5, $6)");
    expect(call.sql).toContain("($7, $8, $9, $10, $11, $12)");
    expect(call.params.slice(0, 6)).toEqual([ts, 50, "outbound_failed", 3, "boom", JSON.stringify({ a: 1 })]);
    expect(call.params.slice(6)).toEqual([ts, 30, "inbound_relayed", null, "ok", JSON.stringify({})]);
  });

  it("insertMany with no rows issues no query", async () => {
    const pool = stubPool();
    await new LogsRepo(pool as any).insertMany([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("query filters by level and account, clamps limit to 1000, orders by id DESC", async () => {
    const pool = stubPool();
    await new LogsRepo(pool as any).query({ minLevel: 40, accountId: 3, limit: 99999 });
    const call = pool.calls[0];
    expect(call.sql).toContain("level >= $1");
    expect(call.sql).toContain("account_id = $2");
    expect(call.sql).toContain("ORDER BY id DESC");
    expect(call.sql).toContain("LIMIT $3");
    expect(call.params).toEqual([40, 3, 1000]);
  });

  it("query with no filters uses default limit 200 and no WHERE", async () => {
    const pool = stubPool();
    await new LogsRepo(pool as any).query({ limit: 200 });
    const call = pool.calls[0];
    expect(call.sql).not.toContain("WHERE");
    expect(call.params).toEqual([200]);
  });

  it("query maps rows, converting Date ts to ISO string", async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: "7", ts: new Date("2026-06-03T01:02:03.000Z"), level: 50, event: "x", account_id: 3, msg: "m", context: { k: "v" } }],
        rowCount: 1,
      })),
    };
    const out = await new LogsRepo(pool as any).query({ limit: 10 });
    expect(out).toEqual([{ id: 7, ts: "2026-06-03T01:02:03.000Z", level: 50, event: "x", accountId: 3, msg: "m", context: { k: "v" } }]);
  });

  it("prune deletes rows below max(id) - keep", async () => {
    const pool = stubPool();
    await new LogsRepo(pool as any).prune(10000);
    expect(pool.calls[0].sql).toContain("DELETE FROM event_logs");
    expect(pool.calls[0].sql).toContain("MAX(id)");
    expect(pool.calls[0].params).toEqual([10000]);
  });
});

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;
d("LogsRepo (real DB)", () => {
  let pool: Pool;
  beforeAll(async () => {
    await runMigrations(url!);
    pool = createPool(url!);
    await pool.query("TRUNCATE event_logs RESTART IDENTITY");
  });
  afterAll(async () => { if (pool) await pool.end(); });

  it("inserts, queries newest-first with filters, and prunes", async () => {
    const repo = new LogsRepo(pool);
    const ts = new Date();
    await repo.insertMany([
      { ts, level: 30, event: "inbound_relayed", accountId: 1, msg: "a", context: {} },
      { ts, level: 50, event: null, accountId: 3, msg: "b", context: { err: "x" } },
    ]);
    const errOnly = await repo.query({ minLevel: 40, limit: 10 });
    expect(errOnly.map((r) => r.msg)).toEqual(["b"]);
    const acct1 = await repo.query({ accountId: 1, limit: 10 });
    expect(acct1.map((r) => r.msg)).toEqual(["a"]);
    await repo.prune(0); // keep only the latest id
    const remaining = await repo.query({ limit: 10 });
    expect(remaining.length).toBe(1);
  });
});
