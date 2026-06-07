# Zalo-Chatwoot Bridge

🇻🇳 Tiếng Việt: [README.md](README.md)

![Zalo-Chatwoot Bridge](zalo-chatwoot.png)

[![CI](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`zca-bridge` is a self-hosted sidecar that syncs [Zalo](https://zalo.me) conversations two-way with
[Chatwoot](https://www.chatwoot.com). It turns Zalo into a Chatwoot inbox so agents can receive,
send, note, and review conversation history from the helpdesk.

The default README is Vietnamese. This file is the English version.

## Summary

- **Zalo OA channel:** uses Zalo's official API, with OAuth, webhook handling, send/receive, backfill,
  and selected customer-info request flows.
- **Personal Zalo channel:** uses [`zca-js`](https://github.com/RFS-ADRENO/zca-js) and QR login.
  This is an unofficial API path and can get accounts restricted or banned.
- **Chatwoot:** receives outbound webhooks from Chatwoot and pushes inbound messages through the
  Chatwoot APIs.
- **Durable queue:** stores jobs in PostgreSQL, retries transient failures, and dead-letters permanent
  failures.
- **Media:** archives attachments locally; oversized files can be served through tokenized `/media`
  links.

Node 24+ · TypeScript ESM · Fastify · PostgreSQL · Vitest · Docker

> This is an independent project. It is not owned by, sponsored by, or officially endorsed by Zalo,
> VNG, Chatwoot, or the `zca-js` developers.

## Important Warning

Personal Zalo accounts are connected through `zca-js`, an **unofficial** library. Using unofficial
APIs may get a Zalo account restricted, locked, or permanently banned. Prefer a secondary account and
do not use critical business accounts or accounts with sensitive data.

The **Zalo Official Account (OA)** channel uses Zalo's official API and is not subject to the
`zca-js` risk. See [SECURITY.md](SECURITY.md).

## Features

- Two-way Zalo ↔ Chatwoot messaging.
- Text, image, file, voice, video, sticker, location, and fallback handling for unknown content.
- Echo/loop suppression through `message_map`.
- Durable media archive and tokenized links for large files.
- Quote/reply, reactions, and message recall for personal accounts.
- Zalo OA OAuth, webhooks, image/file sending, OA image compression before upload, and startup backfill.
- Admin dashboard at `/admin/` for first-run admin setup, Chatwoot/OA settings, account management,
  QR login, webhook URLs, and logs.

## Architecture

- **Inbound:** personal Zalo (`zca-js`) or Zalo OA webhook/backfill → message classification →
  PostgreSQL job queue → worker → Chatwoot Application/Platform API.
- **Outbound:** Chatwoot webhook → PostgreSQL job queue → worker → personal Zalo sender or OA sender.
- **Media:** attachments are downloaded into the local archive; files larger than the Chatwoot upload
  cap are sent as `/media/:token` links.
- **Settings:** sensitive admin UI settings are encrypted with `CREDENTIALS_KEY`.

### Main Modules

- `src/zalo` — personal Zalo adapter, message classification, session handling, QR login.
- `src/zalo-oa` — OA OAuth, webhook, sender, backfill, signature verification, image compression.
- `src/chatwoot` — client, Application API, webhook server, inbox provisioning.
- `src/handlers` — inbound/outbound orchestration, failure notes, contact-info sync.
- `src/worker` and `src/store` — durable queue, repositories, migrations.
- `src/admin` — admin API, login, settings, webhook info, log dashboard.
- `src/media` — archive and tokenized media serving.

## Requirements

- An existing Chatwoot instance. This project **does not bundle or distribute Chatwoot**.
- A dedicated PostgreSQL database for the bridge, separate from Chatwoot's database.
- Node.js 24+ for direct runs, or Docker for container runs.
- `PUBLIC_BASE_URL` must be an externally reachable bridge URL when using webhooks, OA, or an iframe.

## Quick Configuration

Copy `.env.example` to `.env`, then fill in real values:

```bash
cp .env.example .env
```

Minimum variables:

- `DATABASE_URL` — the bridge's dedicated PostgreSQL database.
- `CHATWOOT_BASE_URL` — the Chatwoot URL reachable from the bridge.
- `CREDENTIALS_KEY` — 32-byte hex encryption key, generated with `openssl rand -hex 32`.
- `PUBLIC_BASE_URL` — public bridge URL, for example `https://bridge.example.com`.

Recommended variables:

- `CHATWOOT_API_ACCESS_TOKEN` and `CHATWOOT_ACCOUNT_ID` — required for automatic inbox provisioning,
  importing messages sent from the native Zalo app, and posting private notes when outbound sends
  permanently fail.
- `WEBHOOK_SECRET` — adds a secret segment to the Chatwoot webhook URL.
- `MEDIA_ARCHIVE_ROOT`, `MEDIA_TOKEN_TTL_DAYS`, `CHATWOOT_MAX_ATTACHMENT_MB` — media archive controls.
- `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `ZALO_OA_SECRET_KEY`, `ZALO_OA_OAUTH_REDIRECT` — required
  only for the OA channel.

Never commit `.env`, real tokens, app secrets, Zalo sessions, or database dumps.

## Run With Docker

### Prebuilt Image

Download `docker-compose.full.yml`, prepare `.env`, then run:

```bash
cp .env.example .env
docker compose -f docker-compose.full.yml up -d
```

The bridge runs at `http://localhost:4000`. This compose file includes a dedicated PostgreSQL service
for the bridge and pulls `ghcr.io/diendh/zca-bridge:latest`.

### Build From Source

```bash
cp .env.example .env
docker compose -f docker-compose.example.yml up -d --build
```

The example compose file only runs the bridge and its PostgreSQL database. You still need your own
Chatwoot and must point `CHATWOOT_BASE_URL` at it.

### Single Container

```bash
docker run --env-file .env -p 4000:4000 ghcr.io/diendh/zca-bridge:latest
```

For single-container runs, `DATABASE_URL` and `CHATWOOT_BASE_URL` must point to services reachable
from inside the container.

## Run Directly

```bash
npm ci
npm run build
npm start
```

Migrations run automatically on startup. The bridge listens on `$PORT`, default `4000`.

Development mode:

```bash
npm run dev
```

## First-Run Setup

1. Open `PUBLIC_BASE_URL/admin/` or `http://localhost:4000/admin/`.
2. Create the first admin user. Passwords must be at least 8 characters.
3. In Settings, verify `CHATWOOT_BASE_URL`, Chatwoot account id/token, and OA settings if used.
4. Create a bridge account:
   - Personal Zalo: add an account, create or attach a Chatwoot inbox, start login, and scan the QR.
   - Zalo OA: add an OA account, connect OA, and complete OAuth.
5. Copy webhook URLs from the admin dashboard:
   - Chatwoot webhook: configure it on the matching Chatwoot inbox.
   - Zalo OA webhook: configure it in the Zalo developer console when OA is enabled.
6. Send one inbound and one outbound test message to confirm mapping and echo suppression.

## Tests

```bash
npm test
```

The test suite uses Vitest. If tests involving `sharp` fail to load the module, run `npm ci` again so
native/optional dependencies are installed for the current platform, then rerun tests.

Some repository tests require `TEST_DATABASE_URL`; without it, those tests are intentionally skipped.
See [ROADMAP.md](ROADMAP.md) for the current test debt.

## Security And Leak Checks

- Do not put real secrets in README files, issues, PRs, logs, or screenshots.
- `CREDENTIALS_KEY` must be 64 hex characters and kept environment-specific.
- The admin UI uses a first-run admin account and session cookies signed with a secret derived from
  `CREDENTIALS_KEY`.
- Use HTTPS for `PUBLIC_BASE_URL`, especially when exposing `/admin/`, `/webhooks/*`, and `/media/*`.
- Use `WEBHOOK_SECRET` for Chatwoot webhooks and `ZALO_OA_SECRET_KEY` to verify OA webhooks.
- Before committing documentation, scan with `rg` or a secret scanner and confirm only placeholders
  and variable names are present.

## Related Docs

- [SECURITY.md](SECURITY.md) — security policy and safe operations.
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution guide.
- [ROADMAP.md](ROADMAP.md) — roadmap and current test debt.
- [CHANGELOG.md](CHANGELOG.md) — release history.

## Third Parties

This project integrates with [Chatwoot](https://www.chatwoot.com), [Zalo](https://zalo.me), and
[`zca-js`](https://github.com/RFS-ADRENO/zca-js). All brand names, logos, trademarks, and product names
belong to their respective owners; mentions are for describing technical integration only.

## License

Copyright 2026 Tom.

Released under the [Apache License 2.0](LICENSE).
