# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-05

Initial public release.

### Added
- Two-way Zalo ↔ Chatwoot bridging for personal accounts (via `zca-js`, QR login)
  and Official Accounts (OA, official REST API): text, image, audio, video, file,
  sticker, and location.
- Durable job queue (store-then-process) with retry and dead-letter handling.
- Bidirectional echo/loop suppression via `message_map`.
- Durable media archive with token-served links for oversized attachments.
- Quote/reply, reactions, and message recall for personal accounts; OA text quote-reply.
- Admin API and dashboard, settings, and event logs.
- Docker image published to GitHub Container Registry: `ghcr.io/diendh/zca-bridge`.
- GitHub Actions CI (build + test) and tag-triggered image publishing.

### Notes
- Personal Zalo accounts use the unofficial `zca-js` library and may be locked or
  banned by Zalo. Use at your own risk. See [SECURITY.md](SECURITY.md).

[0.1.0]: https://github.com/diendh/zca-bridge/releases/tag/v0.1.0
