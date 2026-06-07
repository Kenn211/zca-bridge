# Contributing to zca-bridge

🇻🇳 Tiếng Việt: [CONTRIBUTING.vi.md](CONTRIBUTING.vi.md)

Thanks for your interest in improving zca-bridge. The project prefers small, focused, verified
changes.

## Requirements

- Node.js 24+
- npm with the committed `package-lock.json`
- A dedicated PostgreSQL instance if running the app or repository tests
- Docker if using the compose/container workflow

## Local Setup

```bash
npm ci
cp .env.example .env
npm run build
npm test
```

After copying `.env`, fill at least `DATABASE_URL`, `CHATWOOT_BASE_URL`, `CREDENTIALS_KEY`, and
`PUBLIC_BASE_URL`. Generate `CREDENTIALS_KEY` with:

```bash
openssl rand -hex 32
```

Do not commit `.env` or real secret values.

## Development Run

```bash
npm run dev
```

The bridge runs migrations on startup. You can also run migrations manually:

```bash
npm run migrate
```

## Tests

- Run the full suite with `npm test`.
- Some repository tests require `TEST_DATABASE_URL`; without it, they are intentionally skipped.
- If tests involving `sharp` fail to load the module, run `npm ci` again so native/optional
  dependencies are installed for the current platform, then rerun tests.
- Add tests for new behavior. Prefer pure unit tests and mock external dependencies where reasonable.

## Pull Requests

1. Branch from `main`.
2. Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`.
3. Run `npm run build` and `npm test` before opening the PR, or document why they are not passing.
4. Keep PRs focused; describe the problem, fix, and impact.
5. Do not include tokens, secrets, customer-data logs, or sensitive screenshots in PRs.

## Code Style

- TypeScript ESM, Node 24.
- Match the surrounding code style.
- Validate input at system boundaries and handle errors explicitly.
- Do not silently swallow errors; if an error is intentionally ignored, log it or leave a short comment.
- For docs, keep the default README in Vietnamese and update the English version when content changes.
