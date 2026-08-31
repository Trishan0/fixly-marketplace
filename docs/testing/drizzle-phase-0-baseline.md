# Drizzle Migration Phase 0 Baseline

- Captured: 2026-08-31
- Plan commit: `e6cf66a`
- Runtime: Node `v22.22.1`, npm `9.2.0`
- Backend source mode: CommonJS JavaScript with TypeScript `allowJs` transition enabled

## Dependency qualification

The selected implementation direction is Drizzle ORM with the existing `pg` pool, recorded in ADR 0007. The current target is a reviewed stable Drizzle 0.45.x release pinned exactly during Phase 2. Drizzle 1.0 is currently release-candidate software and is excluded from production adoption.

The package registry did not return metadata from this environment. Phase 2 must therefore perform the decisive qualification after installation: lockfile integrity, Node 22/TypeScript 7 compatibility, typecheck, lint, build, unit tests, PostgreSQL integration tests, migration smoke tests, and Neon pooled-connection checks.

## Quality results

| Check | Result | Notes |
| --- | --- | --- |
| Backend typecheck | Pass | `npm run typecheck` |
| Backend lint | Pass | `npm run lint` |
| Backend build | Pass | `npm run build` |
| Backend unit tests | Pass | 4 files, 10 tests; requires loopback-listener permission in this sandbox |
| Backend integration tests | Not runnable locally | Correctly refused because `TEST_DATABASE_URL` is absent |
| Backend migration status | Not runnable locally | Configured managed PostgreSQL host is unreachable from this sandbox DNS environment |
| Backend dependency audit | Pass | `npm audit --audit-level=high` reported zero vulnerabilities |
| Frontend lint | Pass with warnings | 3 existing React fast-refresh warnings; no lint errors |
| Frontend build | Pass with warning | Vite produced a 736.22 KB minified main JS chunk (212.01 KB gzip), above its chunk-size warning threshold |

## Baseline limitations

- A CI PostgreSQL service already runs the integration suite, but this local environment has no `TEST_DATABASE_URL`; no integration result is claimed here.
- Production/staging migration status must be captured from an environment with authorized database network access. Never copy the production connection string into a local test configuration.
- The unit-test listener restriction is a sandbox limitation. The suite passes when run with the approved local-listener permission.

## Current architecture inventory

- 171 direct `pool.query`/`client.query` calls in 29 production source files.
- 18 application tables, plus migration infrastructure.
- 70 route handlers registered under `backend/src/routes`.
- The complete endpoint/authorization/response inventory is [API authorization matrix](../api/authorization-matrix.md).
- The full side-effect and transaction audit is [transaction inventory](../domain/transaction-inventory.md).

## Phase 0 exit decision

Phase 0 is ready to close after the ADR, this baseline, and the query inventory are reviewed and committed. Phase 1 may begin with characterization tests; it must not install Drizzle or migrate runtime queries yet.
