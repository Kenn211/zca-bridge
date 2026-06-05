# Maintainer Roadmap

🇻🇳 Tiếng Việt: [ROADMAP.vi.md](ROADMAP.vi.md)

This roadmap reflects the maintainer's current intentions and is not a commitment.

## Near term
- Reconcile and restore the quarantined tests (see Test debt below).
- Expand unit coverage for handlers and the worker/queue.
- Document a production deployment guide (reverse proxy, HTTPS, backups).

## Medium term
- Observability: structured metrics and health/readiness endpoints.
- Robustness for the durable queue (visibility timeouts, poison-message handling).
- Broader OA feature parity with personal accounts (reactions, recall where supported).

## Longer term
- Multi-account management improvements in the admin dashboard.
- Media lifecycle controls (retention policies, storage backends).

## Test debt (quarantined)

These tests drifted from `src` and are excluded from the committed suite. Restore
them when the underlying code is reconciled:
- `test/worker/worker.test.ts` — "invokes onPermanentFailure when a job dead-letters" (skipped).
- `test/handlers/outbound.test.ts` — "archives the file and sends the customer a download link when Zalo rejects it" (skipped).
- `test/handlers/outbound.test.ts` — "falls back to the agent note when the customer link message also fails" (skipped).
- `test/handlers/outboundNotes.test.ts` — references a removed `src/handlers/outboundNotes` module (kept local, not committed).
- `test/zalo-oa/sender.test.ts` — requires `sharp`, which `src` does not use (kept local, not committed).
- `test/zalo-oa/imageCompress.test.ts` — requires `sharp`, which `src` does not use (kept local, not committed).

## How Codex is used

See the "How Codex will be used" section in the [README](README.md).
