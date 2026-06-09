# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Per-account egress proxy for personal Zalo accounts (HTTP/HTTPS/SOCKS5, optional auth) with a new
  admin **Proxy** tab, an "apply proxy" reconnect flow, and encrypted proxy passwords at rest.
- Automatic reconnection supervisor for personal accounts with exponential backoff
  (5s/15s/45s/2m/5m cap), a new `reconnecting` account status, and conservative auth-vs-network
  error classification (only a real session/login failure forces a manual QR rescan).

## [1.0.1] - 2026-06-08

### Changed
- Updated project metadata for the `v1.0.1` maintainer release.
- Updated the maintainer roadmap to reflect the current green local test status.
- Upgraded `@fastify/static` to the patched 9.x line.
- Upgraded Vitest to the patched 4.x line.

### Security
- Cleared `npm audit` findings for production and development dependencies.

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

[1.0.1]: https://github.com/diendh/zca-bridge/releases/tag/v1.0.1
[0.1.0]: https://github.com/diendh/zca-bridge/releases/tag/v0.1.0
