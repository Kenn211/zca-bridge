# Security Policy

🇻🇳 Tiếng Việt: [SECURITY.vi.md](SECURITY.vi.md)

## Reporting a vulnerability

Please report security issues privately to **c@vietts.dev**. Do not open a public
issue for vulnerabilities. Include reproduction steps and impact; expect an
acknowledgement within a few days.

## Supported versions

This is an early-stage project. Security fixes target the latest `main` and the
most recent tagged release.

## Unofficial Zalo API risk (read first)

Personal Zalo accounts are connected through [`zca-js`](https://github.com/RFS-ADRENO/zca-js),
an **unofficial** library. Using an unofficial API can get a Zalo account
**locked or permanently banned**. Use a secondary account, never a critical one,
and accept the risk. The Official Account (OA) channel uses Zalo's official API
and is not subject to this risk.

## Handling of secrets and sensitive data

- **Credentials encryption:** Zalo session credentials are encrypted at rest with
  AES-256-GCM using `CREDENTIALS_KEY` (a 32-byte hex key, `openssl rand -hex 32`).
  Never commit a real key; `.env` is gitignored.
- **Admin API:** Protect `/admin/api/*` with `ADMIN_TOKEN`.
- **Webhook authenticity:** Use `WEBHOOK_SECRET` for the Chatwoot webhook path and
  `ZALO_OA_SECRET_KEY` to verify the MAC signature of incoming OA webhooks.
- **Media:** Attachments are archived locally; oversized media is served through
  tokenized `/media` links with an optional TTL (`MEDIA_TOKEN_TTL_DAYS`).
- **Database:** Run a dedicated PostgreSQL for the bridge, isolated from Chatwoot's DB.

## Operational guidance

- Keep the bridge behind HTTPS at `PUBLIC_BASE_URL`.
- Rotate `CREDENTIALS_KEY`, `ADMIN_TOKEN`, and `WEBHOOK_SECRET` if they may have leaked.
- The durable queue retries transient failures and dead-letters permanent ones, so
  a crash or restart does not lose or silently drop messages.
