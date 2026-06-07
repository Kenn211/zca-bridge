# Maintainer Roadmap

🇻🇳 Tiếng Việt: [ROADMAP.vi.md](ROADMAP.vi.md)

This roadmap reflects the maintainer's current intent and is not a release commitment.

## Current State

- The default README is Vietnamese; the English version lives at [README.en.md](README.en.md).
- The bridge includes an admin dashboard, first-run admin setup, encrypted settings, logs, personal
  Zalo/OA account management, webhook URL helper, and account deletion.
- Zalo OA includes OAuth, webhook verification, token refresh, backfill, image/file sending, large
  image compression, and selected customer-info request flows.
- Media archive, tokenized media links, durable queueing, and dead-letter handling are present in the
  codebase.

## Near Term

- Restore a green local/CI test state, especially the test group that fails when the native `sharp`
  module cannot be loaded.
- Standardize production guidance: reverse proxy, HTTPS, PostgreSQL/media archive backup, and secret
  rotation.
- Revisit `.env.example` and compose comments so they fully match the current admin UI flow.
- Expand coverage for outbound failure flows, OA media upload, and Chatwoot inbox provisioning.

## Medium Term

- Add richer health/readiness checks beyond `/healthz`.
- Improve observability for queue depth, retries, dead letters, and webhook latency.
- Improve multi-account management in the admin dashboard.
- Complete media retention policy and storage backend options.

## Longer Term

- Expand Zalo OA parity if the official API supports more reaction/recall or equivalent metadata.
- Harden production operations: migration strategy, backup/restore drills, metrics dashboard, and
  alerts.
- Run periodic security reviews for tokens, webhooks, media links, and admin sessions.

## Test Debt

Latest local `npm test` check on 2026-06-07:

- 62 test files passed.
- 5 test files were intentionally skipped because they require `TEST_DATABASE_URL`.
- 5 suites failed because Vitest/Vite could not load the `sharp` module.
- 353 tests passed, 20 tests skipped.

Files currently failing due to the `sharp` load error:

- `test/handlers/outbound.test.ts`
- `test/handlers/outboundConsult.test.ts`
- `test/handlers/outboundLog.test.ts`
- `test/zalo-oa/sender.test.ts`
- `test/zalo-oa/imageCompress.test.ts`

`sharp` is now a dependency in `package.json` and is used by `src/zalo-oa/imageCompress.ts`, so the
fix should target native/optional dependency installation or test-runner configuration rather than
removing these tests.

## How Codex Is Used

See "Cách Codex được sử dụng" in [README.md](README.md).
