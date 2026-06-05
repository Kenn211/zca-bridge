# Contributing to zca-bridge

🇻🇳 Tiếng Việt: [CONTRIBUTING.vi.md](CONTRIBUTING.vi.md)

Thanks for your interest in improving zca-bridge.

## Prerequisites

- Node.js 20+
- A PostgreSQL instance for local runs (separate from Chatwoot's DB)
- Docker (optional, for the container workflow)

## Setup

```bash
npm ci
cp .env.example .env   # fill in DATABASE_URL, CHATWOOT_BASE_URL, CREDENTIALS_KEY, PUBLIC_BASE_URL
npm run build
npm test
```

Run the dev server with `npm run dev` (watch mode). Migrations run automatically on
startup; you can also run them with `npm run migrate`.

## Tests

- Run the suite with `npm test` (Vitest). Tests live under `test/` mirroring `src/`.
- Add tests for new behavior. Prefer pure, dependency-free units where possible;
  the existing suite mocks `pg` rather than hitting a real database.
- Some tests are quarantined as drifted from `src` — see [ROADMAP.md](ROADMAP.md).
  Do not un-skip them without reconciling the underlying code.

## Pull requests

1. Branch from `main`.
2. Use [Conventional Commits](https://www.conventionalcommits.org/) for messages
   (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`).
3. Ensure `npm run build` and `npm test` pass before opening the PR (CI enforces this).
4. Keep changes focused; describe what and why in the PR body.

## Code style

- TypeScript (ESM), Node 20. Keep files focused and small; prefer immutable updates.
- Match the surrounding code's conventions. Validate input at system boundaries and
  handle errors explicitly — never swallow them silently.
