# Maintainer Roadmap

🇻🇳 Tiếng Việt: [ROADMAP.vi.md](ROADMAP.vi.md)

This roadmap reflects the maintainer's current intent and is not a release commitment.

## Current State

- The default README is Vietnamese; the English version lives at [README.en.md](README.en.md).
- The bridge includes an admin dashboard, first-run admin setup, encrypted settings, logs, personal
  Zalo/OA account management, webhook URL helper, and account deletion.
- Zalo OA includes OAuth, webhook verification, token refresh, backfill, image/file sending, large
  image compression, and selected customer-info request flows.
- Personal accounts have per-account proxies, an auto-reconnect supervisor with exponential backoff,
  and a per-account Chatwoot account id override.
- Basic operational alerting over Telegram/webhook (lost login, stuck reconnecting, dead-lettered
  jobs) is present in the codebase.
- Media archive, tokenized media links, durable queueing, and dead-letter handling are present in the
  codebase.

## Near Term

- Standardize production guidance: reverse proxy, HTTPS, PostgreSQL/media archive backup, and secret
  rotation.
- Revisit `.env.example` and compose comments so they fully match the current admin UI flow.
- Expand coverage for outbound failure flows, OA media upload, and Chatwoot inbox provisioning.
- Add a database-backed integration test profile for repository tests that currently require
  `TEST_DATABASE_URL`.

## Medium Term

- Add richer health/readiness checks beyond `/healthz`.
- Improve observability for queue depth, retries, dead letters, and webhook latency.
- Improve multi-account management in the admin dashboard.
- Complete media retention policy and storage backend options.

## Longer Term

- Expand Zalo OA parity if the official API supports more reaction/recall or equivalent metadata.
- Harden production operations: migration strategy, backup/restore drills, metrics dashboard, and
  richer alerting.
- Run periodic security reviews for tokens, webhooks, media links, and admin sessions.

## Test Status

Latest local check on the v1.0.4 code on 2026-06-17:

- 70 test files passed.
- 7 test files were intentionally skipped because they require `TEST_DATABASE_URL`.
- 426 tests passed, 29 tests skipped.
- `npm run build` passed.

The previous local `sharp` load error was resolved by reinstalling dependencies with `npm ci`.

Remaining test debt is focused on database-backed repository tests that need a configured
`TEST_DATABASE_URL`.

## How Codex Is Used

See "Cách Codex được sử dụng" in [README.md](README.md).
