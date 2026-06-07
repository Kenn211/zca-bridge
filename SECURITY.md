# Security Policy

🇻🇳 Tiếng Việt: [SECURITY.vi.md](SECURITY.vi.md)

## Reporting Vulnerabilities

Please report security issues privately to **diendh2014@gmail.com**. Do not open public issues for
vulnerabilities. Include reproduction steps, impact, sanitized logs, and the version/commit in use;
the maintainer will acknowledge within a few days.

## Supported Versions

This is an early-stage project. Security fixes target the latest `main` and the most recent
release/tag.

## Personal Zalo Risk

The personal Zalo channel uses [`zca-js`](https://github.com/RFS-ADRENO/zca-js), an **unofficial**
library. Using unofficial APIs may get a Zalo account restricted, locked, or permanently banned.
Prefer a secondary account and do not use critical accounts or accounts with sensitive data.

The Zalo Official Account (OA) channel uses Zalo's official API and is not subject to the `zca-js`
risk.

## Secrets And Sensitive Data

- **Do not commit secrets:** never commit `.env`, real tokens, app secrets, Zalo sessions, cookies,
  private keys, database dumps, or logs containing customer data.
- **Credentials encryption:** Zalo sessions and sensitive settings are encrypted at rest with
  AES-256-GCM using `CREDENTIALS_KEY`. This key must be 64 hex characters, generated with
  `openssl rand -hex 32`.
- **Admin UI:** the admin dashboard uses a first-run admin account and session cookies signed with a
  secret derived from `CREDENTIALS_KEY`. Admin passwords must be at least 8 characters; still run the
  bridge behind HTTPS and a controlled reverse proxy when exposed to the Internet.
- **Chatwoot webhook:** use `WEBHOOK_SECRET` so the webhook URL has a private secret path.
- **Zalo OA webhook:** use `ZALO_OA_SECRET_KEY` to verify the MAC signature of incoming OA webhooks.
- **Media:** attachments are archived locally; large files are served through `/media/:token` with an
  optional TTL (`MEDIA_TOKEN_TTL_DAYS`). Do not share media links beyond their intended scope.
- **Database:** run a dedicated PostgreSQL database for the bridge, isolated from Chatwoot's database.

## Safe Operations

- Use HTTPS for `PUBLIC_BASE_URL`.
- Keep `/admin/`, `/webhooks/*`, and `/media/*` behind a trusted reverse proxy.
- Rotate `CREDENTIALS_KEY`, `WEBHOOK_SECRET`, `ZALO_OA_APP_SECRET`, `ZALO_OA_SECRET_KEY`, and
  `CHATWOOT_API_ACCESS_TOKEN` if they may have leaked.
- If rotating `CREDENTIALS_KEY`, plan to re-login or migrate previously encrypted secrets.
- Limit the Chatwoot access token to the bridge's required permissions.
- Back up PostgreSQL and the media archive under the same retention policy.

## Leak Check Before Commit

Run at least this scan before committing documentation or configuration:

```bash
rg -n "BEGIN (RSA|OPENSSH|PRIVATE)|AKIA|ghp_|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]|AIza" .
rg -n "(password|secret|token|api[_-]?key|credential)" *.md .env.example docker-compose*.yml
```

Valid documentation hits should only be variable names, placeholders, or fake test fixtures. If a real
value appears, remove it from git history if already committed and rotate the secret immediately.
