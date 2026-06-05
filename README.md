# Zalo-Chatwoot Bridge

![Zalo-Chatwoot Bridge](zalo-chatwoot.png)

🇻🇳 Tiếng Việt: [README.vi.md](README.vi.md)

[![CI](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/diendh/zca-bridge/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A self-hosted sidecar that syncs [Zalo](https://zalo.me) conversations two-way with
[Chatwoot](https://www.chatwoot.com). It supports both personal Zalo accounts (via
[`zca-js`](https://github.com/RFS-ADRENO/zca-js), QR login) and Official Accounts (OA, via Zalo's
official REST API), surfacing Zalo messages as a Chatwoot inbox so agents can send and receive
without leaving their helpdesk. Package/technical name: `zca-bridge`.

Node 24 · TypeScript (ESM) · Fastify · PostgreSQL

> This is an independent project. It is not owned by, sponsored by, or officially endorsed by Zalo, VNG, Chatwoot, or the `zca-js` developers.

## Why this matters

Vietnamese support teams live on Zalo, but Zalo has no native Chatwoot integration, so agents end up
juggling the Zalo app separately from their helpdesk. This bridge brings Zalo into Chatwoot as a
normal inbox, self-hosted so conversation data stays on infrastructure you control.

## Use cases

- SMB and agency support teams consolidating channels in Chatwoot.
- Teams already on Chatwoot who want to add Zalo without a SaaS middleman.
- Businesses on Zalo OA wanting agent collaboration, notes, and history in Chatwoot.
- Self-hosting for data residency and privacy.

## ⚠️ Risk warning

Personal Zalo accounts are connected via [`zca-js`](https://github.com/RFS-ADRENO/zca-js) — an
**unofficial** library. Using an unofficial API can get your Zalo account **locked or permanently
banned**. Consider carefully and use it **at your own risk** — prefer a secondary account, and do
not use it for critical accounts. This project provides no warranty and takes no responsibility if
your account runs into trouble.

> Using unofficial APIs may get your account restricted, locked, or permanently banned. Use it at your own risk.

The **Official Account (OA)** channel uses Zalo's official API and is therefore **exempt** from this
risk. See [SECURITY.md](SECURITY.md).

## Features

- Two-way messaging Zalo ↔ Chatwoot (text, image, file, voice, video, sticker, location, and more).
- Durable store-then-process queue with retry and dead-letter, so messages survive restarts.
- Bidirectional echo/loop suppression via `message_map`.
- Durable media archive (every attachment is backed up locally; oversized files are served via
  tokenized links).
- Quote/reply, reactions, and message recall for personal accounts; OA supports text quote-reply.

## Architecture

The bridge moves messages along two durable paths, both backed by a PostgreSQL job queue.

- **Inbound:** Zalo personal events (via the `zca-js` adapter) and OA webhooks → classify → durable
  job queue (PostgreSQL) → worker → Chatwoot Application/Platform API.
- **Outbound:** Chatwoot webhook → queue → worker → Zalo (personal sender / OA sender).
- `message_map` suppresses echo loops between the two systems; media is archived locally and served
  via tokenized links when needed.

### Module map

- `src/zalo` — personal adapter, classify, session, QR login.
- `src/zalo-oa` — OA OAuth, webhook, sender, backfill.
- `src/chatwoot` — client, webhook server.
- `src/worker` + `src/store` — durable queue, repos, migrations.
- `src/handlers` — inbound/outbound orchestration.
- `src/admin` — admin API + dashboard.
- `src/media` — archive + tokenized serving.

## Requirements

- **Bring your own Chatwoot** — this project does NOT bundle or distribute Chatwoot. Point the
  bridge at your existing Chatwoot instance.
- A dedicated PostgreSQL for the bridge, separate from Chatwoot's database. The bridge auto-runs
  migrations on startup.
- Node 24+ (or Docker).

## Configuration

Copy `.env.example` to `.env` and fill in the values (each variable is documented inline in
`.env.example`). Minimum required: `DATABASE_URL`, `CHATWOOT_BASE_URL`, `CREDENTIALS_KEY`,
`PUBLIC_BASE_URL`.

## Run

### All-in-one — bundled Chatwoot (one file)

Spin up everything (Chatwoot rails + sidekiq + Postgres + Redis **and** the bridge with its own
Postgres) from a single file:

```bash
cp .env.example .env   # then edit .env: set the *_PASSWORD values, CHATWOOT_SECRET_KEY_BASE,
                       # CREDENTIALS_KEY, PUBLIC_BASE_URL...
docker compose -f docker-compose.full.yml up -d --build
```

Chatwoot UI: `http://localhost:3000` · Bridge: `http://localhost:4000`. This does not bundle or
redistribute Chatwoot — it orchestrates the official upstream `chatwoot/chatwoot` image at runtime.
One-time step after first boot: create your Chatwoot account, generate an Access Token, put
`CHATWOOT_API_ACCESS_TOKEN` and `CHATWOOT_ACCOUNT_ID` into `.env`, then re-run `up -d`.

### Docker Compose (bring your own Chatwoot)

```bash
cp .env.example .env   # then edit .env
docker compose -f docker-compose.example.yml up -d --build
```

The compose file starts the bridge and its Postgres. Set `CHATWOOT_BASE_URL` to your Chatwoot.

### Prebuilt image (ghcr.io)

```bash
docker run --env-file .env -p 4000:4000 ghcr.io/diendh/zca-bridge:latest
```

Note: you still need a reachable PostgreSQL and Chatwoot. Alternatively, in
`docker-compose.example.yml` replace `build: .` with `image: ghcr.io/diendh/zca-bridge:latest` to
run the published image.

### Direct

```bash
npm ci
npm run build
npm start          # auto-runs migrations on startup, then listens on $PORT (default 4000)
```

## Test

```bash
npm test
```

Tests run on Vitest. A few tests are quarantined as drifted from `src`; see [ROADMAP.md](ROADMAP.md).

## Security notes

Credentials are encrypted at rest (`CREDENTIALS_KEY`, AES-256-GCM). Protect admin and webhook
endpoints with `ADMIN_TOKEN` / `WEBHOOK_SECRET` / `ZALO_OA_SECRET_KEY`, and run a dedicated database.
See [SECURITY.md](SECURITY.md).

## Maintainer roadmap

See [ROADMAP.md](ROADMAP.md).

## How Codex will be used

I will use Codex to maintain zca-bridge more efficiently: reviewing pull requests, generating tests,
improving TypeScript code quality, refactoring the Zalo/Chatwoot sync logic, checking webhook and
queue reliability, improving Docker deployment, writing documentation, triaging issues, and reviewing
security-sensitive areas such as tokens, webhooks, media uploads, retries, and API integrations.

## Third-party notice

This project integrates with and depends on third-party products:

- [Chatwoot](https://www.chatwoot.com)
- [Zalo](https://zalo.me)
- [`zca-js`](https://github.com/RFS-ADRENO/zca-js)

All brand names, logos, trademarks, and product names belong to their respective owners. Mentions of
these third parties are for describing technical integration only.

## License

Copyright 2026 Tom. Released under the [Apache License 2.0](LICENSE).

This project is an independent bridge only. Chatwoot, Zalo, and `zca-js` belong to their respective
owners.
