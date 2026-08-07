# AlphaForge Backend — Tests

## Structure
- `unit/modules/` — unit tests, mirrors `src/modules/` 1:1
- `integration/` — cross-module flows (e.g. auth → broker connect → order placement)
- `fixtures/` — mock data (sample Breeze API responses, test strategies, etc.)
- `output/` — coverage reports and test artifacts (gitignored, not committed)
- `docs/` — testing strategy, what's covered vs. known gaps

## Running tests
cd backend
npm test
## Conventions
- Test files: `*.test.ts`, named after the file they test (`auth.service.test.ts` tests `auth.service.ts`)
- No tests hit the real ICICI Breeze API or a real database — use fixtures and mocks
