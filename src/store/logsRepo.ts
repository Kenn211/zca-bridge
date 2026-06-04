import type { Pool } from "pg";

export interface LogRow {
  ts: Date;
  level: number;
  event: string | null;
  accountId: number | null;
  msg: string;
  context: Record<string, unknown>;
}

export interface StoredLog {
  id: number;
  ts: string;
  level: number;
  event: string | null;
  accountId: number | null;
  msg: string;
  context: Record<string, unknown>;
}

export interface LogQuery {
  minLevel?: number;
  accountId?: number;
  limit: number;
}

const MAX_LIMIT = 1000;

export class LogsRepo {
  constructor(private pool: Pool) {}

  async insertMany(rows: LogRow[]): Promise<void> {
    if (rows.length === 0) return;
    const cols = 6;
    const params: unknown[] = [];
    const tuples = rows.map((r, i) => {
      const b = i * cols;
      params.push(r.ts, r.level, r.event, r.accountId, r.msg, JSON.stringify(r.context));
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
    });
    await this.pool.query(
      `INSERT INTO event_logs (ts, level, event, account_id, msg, context) VALUES ${tuples.join(", ")}`,
      params,
    );
  }

  async query(q: LogQuery): Promise<StoredLog[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (typeof q.minLevel === "number") { params.push(q.minLevel); where.push(`level >= $${params.length}`); }
    if (typeof q.accountId === "number") { params.push(q.accountId); where.push(`account_id = $${params.length}`); }
    const limit = Math.min(Math.max(1, Math.floor(q.limit) || 0), MAX_LIMIT);
    params.push(limit);
    const sql =
      "SELECT id, ts, level, event, account_id, msg, context FROM event_logs" +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` ORDER BY id DESC LIMIT $${params.length}`;
    const r = await this.pool.query(sql, params);
    return r.rows.map((row: any) => ({
      id: Number(row.id),
      ts: row.ts instanceof Date ? row.ts.toISOString() : String(row.ts),
      level: row.level,
      event: row.event ?? null,
      accountId: row.account_id ?? null,
      msg: row.msg,
      context: row.context ?? {},
    }));
  }

  /** Keep at most `keep` most-recent rows. */
  async prune(keep: number): Promise<void> {
    await this.pool.query(
      "DELETE FROM event_logs WHERE id <= (SELECT COALESCE(MAX(id), 0) FROM event_logs) - $1",
      [keep],
    );
  }
}
