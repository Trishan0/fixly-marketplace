# ADR 0007: Drizzle Persistence Architecture

- Status: Accepted
- Date: 2026-08-31

## Context

Fixly uses PostgreSQL through `pg`, with 171 direct query calls distributed across HTTP routes, agent orchestration, agent tools, middleware, and services. This leaves query result shapes implicit, permits business workflows to bypass shared invariants, and makes multi-record transactions inconsistent.

The application already has a safe numbered-SQL migration runner backed by the `schema_migrations` ledger, a PostgreSQL advisory lock, checksums, and real PostgreSQL integration-test support. Replacing that migration history while changing the data-access layer would create unnecessary deployment risk.

## Decision

Adopt Drizzle ORM incrementally, using its `node-postgres` adapter around Fixly's existing configured `pg.Pool`.

- The initial dependency target is the reviewed stable Drizzle 0.45.x line, pinned exactly when it is added in Phase 2. Drizzle 1.0 release candidates are not production dependencies.
- Phase 2 must prove the exact package versions work with Node 22, TypeScript 7, the existing CommonJS runtime, PostgreSQL 18 CI, and the Neon pooled connection configuration before any production source query is migrated.
- `backend/src/db/migrations/*.sql` and the existing `schema_migrations` ledger remain the sole production schema-change mechanism. Drizzle Kit may introspect a disposable database created from those migrations, but it must not apply schema changes to shared databases and must never create a second migration ledger.
- Drizzle table schemas are the typed application contract. Numbered SQL migrations remain the immutable schema-history contract. Every schema pull request changes both, and CI verifies they agree.
- Controllers own HTTP translation, policies own authorization decisions, services own business workflows, and repositories own database queries. Only database infrastructure and repositories may access Drizzle.
- `pg` driver/pool access is forbidden outside database infrastructure, numbered migrations, and isolated test support after the compatibility layer is removed.
- Drizzle query APIs are the default. PostgreSQL-specific SQL is allowed only inside a repository or database-infrastructure module, through a parameterized Drizzle `sql` template. Dynamic SQL identifiers must be allowlisted.
- Multi-record writes use one explicit transaction. In-app notification rows and audit/outbox rows that define the command outcome are written through that same transaction. SMTP, Gemini, storage deletion, and other network work happen after commit.
- UUIDs remain strings. PostgreSQL `NUMERIC` values remain exact decimal strings at persistence boundaries. Money must not be calculated with JavaScript binary floating-point; Phase 4 selects and tests the decimal implementation before payment migration.

## Consequences

- The migration is vertical and incremental. Existing `pg` queries coexist temporarily through the same underlying pool until their owning domain is converted.
- No bulk ORM rewrite is permitted. Every migrated domain needs behavior, authorization, failure, replay, and relevant race-condition tests before its legacy SQL is deleted.
- Repository boundaries give the application one place for database projections, query names, transactions, and database-error mapping.
- The existing SQL migration runner is preserved, so application rollback remains compatible with additive schema changes and corrective forward migrations.
- A future move to a newer Drizzle major version or a different migration runner requires a new ADR, staging qualification, and a production rollback plan.
