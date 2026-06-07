import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { ChatwootAdminClient, ChatwootAdminError, ChatwootInboxProvisioner } from "../../src/chatwoot/adminClient.js";

let agent: MockAgent;
const base = "http://chatwoot:3000";

beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});

afterEach(async () => {
  await agent.close();
});

describe("ChatwootAdminClient", () => {
  it("creates an API inbox with webhook_url and parses id plus identifier", async () => {
    let seenHeaders: any;
    let seenBody = "";
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inboxes",
      method: "POST",
    }).reply(200, (opts) => {
      seenHeaders = opts.headers;
      seenBody = String(opts.body);
      return { id: 123, name: "Zalo - Sales", inbox_identifier: "ident-123" };
    });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    const inbox = await client.createApiInbox({
      name: "Zalo - Sales",
      webhookUrl: "http://bridge:4000/webhooks/chatwoot/s3",
    });

    expect(inbox).toEqual({ id: 123, name: "Zalo - Sales", inboxIdentifier: "ident-123" });
    expect(seenHeaders.api_access_token).toBe("TOKEN123");
    expect(JSON.parse(seenBody)).toEqual({
      name: "Zalo - Sales",
      channel: { type: "api", webhook_url: "http://bridge:4000/webhooks/chatwoot/s3" },
    });
  });

  it("throws a typed auth error for 401 or 403", async () => {
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inboxes",
      method: "POST",
    }).reply(403, { message: "forbidden" });

    const client = new ChatwootAdminClient(base, "BAD", 7);
    await expect(client.createApiInbox({ name: "Zalo - Sales", webhookUrl: "http://bridge/webhooks/chatwoot" }))
      .rejects.toMatchObject({ code: "chatwoot_auth_failed" });
  });

  it("throws when create inbox response misses identifier", async () => {
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inboxes",
      method: "POST",
    }).reply(200, { id: 123, name: "Zalo - Sales" });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    await expect(client.createApiInbox({ name: "Zalo - Sales", webhookUrl: "http://bridge/webhooks/chatwoot" }))
      .rejects.toMatchObject({ code: "chatwoot_inbox_invalid_response" });
  });

  it("lists numeric assignable user ids from payload responses", async () => {
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/agents",
      method: "GET",
    }).reply(200, { payload: [{ id: 1 }, { id: "2" }, { id: null }] });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    await expect(client.listAssignableUserIds()).resolves.toEqual([1, 2]);
  });

  it("throws when no valid assignable users remain after filtering", async () => {
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/agents",
      method: "GET",
    }).reply(200, { payload: [{ id: null }, { id: 0 }, { id: "abc" }] });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    await expect(client.listAssignableUserIds()).rejects.toMatchObject({ code: "chatwoot_no_assignable_users" });
  });

  it("sets inbox members in one request", async () => {
    let seenBody = "";
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inbox_members",
      method: "POST",
    }).reply(200, (opts) => {
      seenBody = String(opts.body);
      return { ok: true };
    });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    await client.setInboxMembers(123, [1, 2]);
    expect(JSON.parse(seenBody)).toEqual({ inbox_id: 123, user_ids: [1, 2] });
  });

  it("throws chatwoot_config_missing when not configured", async () => {
    const client = new ChatwootAdminClient(base, null, null);
    await expect(client.listAssignableUserIds()).rejects.toMatchObject({ code: "chatwoot_config_missing" });
  });

  it("provisions an inbox by creating it then assigning listed users", async () => {
    const calls: string[] = [];
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inboxes",
      method: "POST",
    }).reply(200, () => {
      calls.push("create");
      return { id: 123, name: "Zalo - Sales", inbox_identifier: "ident-123" };
    });
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/agents",
      method: "GET",
    }).reply(200, () => {
      calls.push("agents");
      return { payload: [{ id: 1 }, { id: 2 }] };
    });
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/inbox_members",
      method: "POST",
    }).reply(200, () => {
      calls.push("members");
      return { ok: true };
    });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    const provisioner = new ChatwootInboxProvisioner(client, "http://bridge:4000/webhooks/chatwoot");
    await expect(provisioner.createInboxForAccount("Sales")).resolves.toEqual({ identifier: "ident-123", id: 123 });
    expect(calls).toEqual(["agents", "create", "members"]);
  });

  it("provisioner throws when no assignable users are returned", async () => {
    agent.get(base).intercept({
      path: "/api/v1/accounts/7/agents",
      method: "GET",
    }).reply(200, { payload: [] });

    const client = new ChatwootAdminClient(base, "TOKEN123", 7);
    const provisioner = new ChatwootInboxProvisioner(client, "http://bridge:4000/webhooks/chatwoot");
    await expect(provisioner.createInboxForAccount("Sales")).rejects.toMatchObject({ code: "chatwoot_no_assignable_users" });
  });
});
