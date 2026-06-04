import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { registerAdminRoutes } from "../../src/admin/routes.js";

const PASS: any = async () => {};

function buildApp() {
  const app = Fastify();
  const accounts = {
    listAll: vi.fn(async () => [{ id: 1, label: "Sales", status: "connected", chatwootInboxIdentifier: "ident-1" }]),
    create: vi.fn(async (i: any) => ({ id: 2, label: i.label, status: "pending_qr", chatwootInboxIdentifier: i.chatwootInboxIdentifier })),
    createOa: vi.fn(async (i: any) => ({ id: 3, label: i.label, status: "pending_qr", type: "oa", chatwootInboxIdentifier: i.chatwootInboxIdentifier, zaloOaId: null })),
    update: vi.fn(async (id: number, p: any) => (id === 99 ? null : { id, label: p.label ?? "Sales", status: "connected", chatwootInboxIdentifier: p.chatwootInboxIdentifier ?? "ident-1" })),
  };
  const qr = { startLogin: vi.fn(async () => ({ qrImageBase64: "data:image/png;base64,AAA" })) };
  registerAdminRoutes(app, accounts as any, qr as any, PASS);
  return { app, accounts, qr };
}

describe("admin routes", () => {
  it("GET /admin/api/accounts lists accounts", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/admin/api/accounts" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("POST /admin/api/accounts creates an account", async () => {
    const { app, accounts } = buildApp();
    const res = await app.inject({ method: "POST", url: "/admin/api/accounts", payload: { label: "Support", chatwootInboxIdentifier: "ident-9" } });
    expect(res.statusCode).toBe(200);
    expect(accounts.create).toHaveBeenCalledWith({ label: "Support", chatwootInboxIdentifier: "ident-9" });
  });

  it("POST /admin/api/accounts forwards chatwootInboxId when provided", async () => {
    const { app, accounts } = buildApp();
    const res = await app.inject({ method: "POST", url: "/admin/api/accounts", payload: { label: "Sales", chatwootInboxIdentifier: "ident-5", chatwootInboxId: 5 } });
    expect(res.statusCode).toBe(200);
    expect(accounts.create).toHaveBeenCalledWith({ label: "Sales", chatwootInboxIdentifier: "ident-5", chatwootInboxId: 5 });
  });

  it("POST /admin/api/accounts/oa creates an OA account", async () => {
    const { app, accounts } = buildApp();
    const res = await app.inject({ method: "POST", url: "/admin/api/accounts/oa", payload: { label: "OA Support", chatwootInboxIdentifier: "oa-ident-1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(accounts.createOa).toHaveBeenCalledWith({ label: "OA Support", chatwootInboxIdentifier: "oa-ident-1" });
  });

  it("POST /admin/api/accounts/oa returns 400 when label is missing", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "POST", url: "/admin/api/accounts/oa", payload: { chatwootInboxIdentifier: "oa-ident-1" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().ok).toBe(false);
  });

  it("PATCH /admin/api/accounts/:id updates inbox fields", async () => {
    const { app, accounts } = buildApp();
    const res = await app.inject({ method: "PATCH", url: "/admin/api/accounts/2", payload: { label: "Renamed", chatwootInboxIdentifier: "ident-x" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(accounts.update).toHaveBeenCalledWith(2, { label: "Renamed", chatwootInboxIdentifier: "ident-x" });
  });

  it("PATCH /admin/api/accounts/:id returns 400 on empty inbox identifier", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "PATCH", url: "/admin/api/accounts/2", payload: { chatwootInboxIdentifier: "  " } });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /admin/api/accounts/:id returns 404 when account missing", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "PATCH", url: "/admin/api/accounts/99", payload: { label: "X" } });
    expect(res.statusCode).toBe(404);
  });

  it("POST /admin/api/accounts/:id/login returns a QR image", async () => {
    const { app, qr } = buildApp();
    const res = await app.inject({ method: "POST", url: "/admin/api/accounts/1/login" });
    expect(res.statusCode).toBe(200);
    expect(res.json().qrImageBase64).toContain("base64");
    expect(qr.startLogin).toHaveBeenCalledWith(1);
  });
});
