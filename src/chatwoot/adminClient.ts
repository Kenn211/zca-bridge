import { request } from "undici";

export type ChatwootAdminErrorCode =
  | "chatwoot_config_missing"
  | "chatwoot_auth_failed"
  | "chatwoot_inbox_create_failed"
  | "chatwoot_inbox_invalid_response"
  | "chatwoot_agents_list_failed"
  | "chatwoot_inbox_members_failed"
  | "chatwoot_no_assignable_users";

export class ChatwootAdminError extends Error {
  constructor(
    public code: ChatwootAdminErrorCode,
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ChatwootAdminError";
  }
}

export interface CreatedApiInbox {
  id: number;
  inboxIdentifier: string;
  name: string;
}

export class ChatwootAdminClient {
  constructor(
    private baseUrl: string,
    private accessToken: string | null,
    private accountId: number | null,
  ) {}

  async createApiInbox(input: { name: string; webhookUrl: string }): Promise<CreatedApiInbox> {
    const { baseUrl, token, accountId } = this.requireConfig();
    const res = await request(`${baseUrl}/api/v1/accounts/${accountId}/inboxes`, {
      method: "POST",
      headers: { "content-type": "application/json", api_access_token: token },
      body: JSON.stringify({
        name: input.name,
        channel: { type: "api", webhook_url: input.webhookUrl },
      }),
    });
    if (res.statusCode === 401 || res.statusCode === 403) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_auth_failed", `Chatwoot auth failed: ${res.statusCode}`, res.statusCode);
    }
    if (res.statusCode >= 400) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_inbox_create_failed", `Chatwoot create inbox failed: ${res.statusCode}`, res.statusCode);
    }
    const body = (await res.body.json()) as any;
    const id = Number(body?.id);
    const inboxIdentifier = typeof body?.inbox_identifier === "string" ? body.inbox_identifier : "";
    if (!Number.isFinite(id) || id <= 0 || inboxIdentifier.trim() === "") {
      throw new ChatwootAdminError("chatwoot_inbox_invalid_response", "Chatwoot create inbox response did not include id and inbox_identifier");
    }
    return { id, inboxIdentifier, name: String(body?.name ?? input.name) };
  }

  async listAssignableUserIds(): Promise<number[]> {
    const { baseUrl, token, accountId } = this.requireConfig();
    const res = await request(`${baseUrl}/api/v1/accounts/${accountId}/agents`, {
      method: "GET",
      headers: { api_access_token: token },
    });
    if (res.statusCode === 401 || res.statusCode === 403) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_auth_failed", `Chatwoot auth failed: ${res.statusCode}`, res.statusCode);
    }
    if (res.statusCode >= 400) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_agents_list_failed", `Chatwoot list agents failed: ${res.statusCode}`, res.statusCode);
    }
    const body = (await res.body.json()) as any;
    const rows = Array.isArray(body) ? body : Array.isArray(body?.payload) ? body.payload : [];
    const ids = rows
      .map((row: any) => Number(row?.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
      throw new ChatwootAdminError("chatwoot_no_assignable_users", "Chatwoot returned no assignable users");
    }
    return ids;
  }

  async setInboxMembers(inboxId: number, userIds: number[]): Promise<void> {
    const { baseUrl, token, accountId } = this.requireConfig();
    const res = await request(`${baseUrl}/api/v1/accounts/${accountId}/inbox_members`, {
      method: "POST",
      headers: { "content-type": "application/json", api_access_token: token },
      body: JSON.stringify({ inbox_id: inboxId, user_ids: userIds }),
    });
    if (res.statusCode === 401 || res.statusCode === 403) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_auth_failed", `Chatwoot auth failed: ${res.statusCode}`, res.statusCode);
    }
    if (res.statusCode >= 400) {
      res.body.dump();
      throw new ChatwootAdminError("chatwoot_inbox_members_failed", `Chatwoot set inbox members failed: ${res.statusCode}`, res.statusCode);
    }
    res.body.dump();
  }

  private requireConfig(): { baseUrl: string; token: string; accountId: number } {
    const baseUrl = this.baseUrl?.replace(/\/$/, "");
    if (!baseUrl || !this.accessToken || !this.accountId) {
      throw new ChatwootAdminError("chatwoot_config_missing", "Chatwoot base URL, account id, and API access token are required");
    }
    return { baseUrl, token: this.accessToken, accountId: this.accountId };
  }
}

export class ChatwootInboxProvisioner {
  constructor(
    private client: ChatwootAdminClient,
    private webhookUrl: string,
  ) {}

  async createInboxForAccount(label: string): Promise<{ identifier: string; id: number }> {
    const userIds = await this.client.listAssignableUserIds();
    const inbox = await this.client.createApiInbox({
      name: `Zalo - ${label}`,
      webhookUrl: this.webhookUrl,
    });
    await this.client.setInboxMembers(inbox.id, userIds);
    return { identifier: inbox.inboxIdentifier, id: inbox.id };
  }
}
