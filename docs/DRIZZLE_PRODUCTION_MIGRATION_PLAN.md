# Fixly Production-Grade Drizzle and Persistence Migration Plan

**Status:** Proposed for implementation
**Scope:** Backend persistence, domain workflows, database correctness, and the operational controls required to run them safely in production
**Primary decision:** Adopt Drizzle ORM incrementally on top of the existing PostgreSQL `pg` pool
**Migration principle:** Preserve API behavior while replacing direct SQL access one domain at a time; correctness and rollback safety take priority over speed of conversion

## 1. Outcome

At completion, Fixly will have a typed, transaction-safe persistence layer rather than SQL distributed through HTTP routes, middleware, services, and AI orchestration code.

The completed system must provide:

- A reviewed Drizzle schema covering every production table, relationship, index, constraint, default, PostgreSQL type, and JSON structure used by the application.
- One shared database client and pool lifecycle, with Drizzle wrapping the existing `pg` pool.
- Controllers that handle HTTP concerns only.
- Explicit authorization policies and Zod validation at request boundaries.
- Named domain services that own business workflows.
- Repositories that own all database access.
- Atomic transactions for every multi-record workflow.
- Database constraints as the final safety net for critical invariants.
- Idempotent and concurrency-safe commands.
- Real PostgreSQL integration and race-condition tests.
- Observable query latency, pool health, transaction failures, and database errors without leaking sensitive data.
- A staged deployment and rollback procedure that can be executed without resetting or losing production data.

Adopting Drizzle alone does not make Fixly production-grade. This plan treats the ORM as one part of a larger correctness boundary comprising domain services, transactions, constraints, validation, tests, monitoring, and operational runbooks.

## 2. Current Baseline

The current backend has:

- 18 PostgreSQL tables across marketplace, identity, AI-agent, notification, and rate-limit domains.
- Five numbered SQL migrations and a checksum-aware migration runner protected by a PostgreSQL advisory lock.
- 171 direct `pool.query` or `client.query` calls in production source.
- Direct database access from routes, agents, agent tools, middleware, and services.
- Only one application transaction, in registration, despite several multi-write workflows.
- Real PostgreSQL integration-test infrastructure, but characterization and concurrency coverage exists for only a small part of the marketplace.
- Node.js 22, CommonJS runtime source, and TypeScript configured in transitional `allowJs` mode.
- Neon-aware connection-pool sizing for serverless deployment.

The highest-risk correctness gaps are:

1. Accepting a proposal updates the selected proposal, competing proposals, the job, and a notification without a transaction or job-row lock.
2. Proposal submission and invitation acceptance perform read-then-write state transitions that can race.
3. Payment creation and job-state transition are not atomic.
4. Review creation, job-state transition, rating aggregation, and notification creation are not atomic.
5. Agent confirmations can be repeated or concurrently confirmed, and selected entities are not fully constrained to the stored recommendations.
6. Several workflows can commit their main record and then fail while creating related records or notifications.
7. Query result shapes are implicit and untyped.
8. `SELECT *` can expose newly added sensitive fields accidentally.

## 3. Architecture Decisions

These decisions must be recorded in an ADR before implementation begins.

### 3.1 ORM and version policy

- Use `drizzle-orm` with the `node-postgres` adapter.
- Reuse one existing `pg.Pool`; do not create an ORM pool beside the existing pool.
- Initially pin the latest reviewed stable Drizzle 0.45.x and compatible Drizzle Kit 0.31.x releases exactly in the lockfile.
- Do not use a Drizzle 1.0 release candidate in production. Re-evaluate after 1.0 general availability and a staging qualification run.
- Dependabot or Renovate may propose upgrades, but ORM and migration-tool upgrades require migration, integration, and concurrency tests before merge.

### 3.2 Migration ownership

- Keep `backend/src/db/migrations/*.sql` and the current `schema_migrations` ledger as the only production migration history during this project.
- Never use `drizzle-kit push` against shared, staging, or production databases.
- Do not introduce a second `__drizzle_migrations__` ledger.
- Use Drizzle Kit to introspect a disposable database created from the existing migrations. Review and normalize the generated TypeScript schema manually.
- Every future schema pull request must update both the numbered SQL migration and the Drizzle schema in the same change.
- Add CI drift detection so the database built from numbered migrations matches the checked-in Drizzle schema.
- Production changes are forward-only. Rollback means application rollback plus a corrective forward migration when schema correction is required.

### 3.3 Module boundary

The target request path is:

```text
Express controller
  -> validated command/query DTO
  -> authorization policy
  -> domain service
  -> repository through Drizzle or an explicit transaction
  -> PostgreSQL
```

Target backend structure:

```text
backend/src/
  config/
    env.ts
  db/
    client.ts
    schema/
      identity.ts
      marketplace.ts
      engagement.ts
      agents.ts
      operations.ts
      relations.ts
    transaction.ts
    errors.ts
    health.ts
  modules/
    auth/
    users/
    workers/
    jobs/
    proposals/
    invitations/
    payments/
    reviews/
    notifications/
    reports/
    administration/
    agents/
    rate-limits/
```

Each module may contain `schema.ts`, `repository.ts`, `service.ts`, `policy.ts`, `controller.ts`, and focused tests as needed. Table definitions remain under `db/schema`; request schemas belong to modules.

### 3.4 Raw SQL policy

- Drizzle query APIs are the default.
- Raw SQL remains allowed for PostgreSQL features or queries that are clearer and more efficient in SQL.
- Raw SQL must use Drizzle's parameterized `sql` template and live inside a repository or database infrastructure module.
- Dynamic identifiers and sort expressions must come from an explicit allowlist; user input must never become SQL syntax.
- Direct imports of `pg`, `Pool`, or the raw pool are forbidden outside the database infrastructure, migrations, and isolated test support.
- Routes, controllers, middleware, domain services, agent orchestration, and agent tools must not call `pool.query` or `db.execute` directly.

### 3.5 Data representation

- UUIDs remain strings and are validated at request boundaries.
- PostgreSQL `NUMERIC` values remain decimal strings at the persistence boundary unless a documented column has a proven safe integer representation.
- Monetary arithmetic must not use binary floating-point. Use a reviewed decimal library or integer minor units at the domain boundary.
- Timestamps are `Date` values internally and ISO-8601 UTC strings at API boundaries.
- JSONB columns receive Zod schemas and inferred TypeScript types; arbitrary `unknown` JSON cannot cross into domain logic.
- Database enums/check constraints and TypeScript/Zod enums must be generated from, or verified against, one shared definition.
- API response mappers must explicitly select public fields. Persistence records are not returned directly from controllers.

## 4. Non-Negotiable Domain Invariants

These invariants must be enforced in services and, where possible, in PostgreSQL.

### Jobs and proposals

- A job has at most one accepted proposal.
- A job can have at most one proposal from a given worker.
- Only the job owner may accept or decline a proposal.
- Only the proposal owner may withdraw it.
- A proposal is accepted only from `pending` while the job is accepting proposals.
- Proposal acceptance atomically accepts one proposal, declines competing pending proposals, assigns the worker, transitions the job, and inserts its notification.
- Job status transitions use guarded updates against the expected previous status and verify the affected-row count.
- Concurrent acceptance requests cannot assign two workers.

### Invitations

- A worker can have at most one invitation per job.
- Invitation acceptance is idempotent.
- Accepting an invitation and creating or locating its proposal is one atomic workflow.
- An invitation cannot revive a closed, assigned, cancelled, or completed job.

### Payments

- A job has at most one payment record under the current offline-payment model.
- Payment recording and transition to `payment_recorded` are atomic.
- Amounts are positive, use exact decimal semantics, and become immutable after recording except through a separately authorized correction workflow with an audit trail.
- Confirmation and dispute states cannot conflict.
- Repeat requests have defined idempotent responses.

Before this slice, replace or formally constrain the current independent `worker_confirmed` and `disputed` booleans. Prefer an explicit payment status model such as `recorded`, `confirmed`, `disputed`, and `resolved`, subject to a product ADR.

### Reviews and ratings

- A job has at most one review.
- Only the job customer can review the assigned worker.
- Review creation, job transition, rating aggregate update, and notification insertion are atomic.
- Rating and completed-job aggregates can be rebuilt deterministically from source rows.
- Concurrent review attempts cannot double-count aggregates.

### Agent actions

- Only one active matching run per customer/job and one active proposal run per worker is allowed, enforced by partial unique indexes where appropriate.
- Confirmation locks the run and changes it from `awaiting_confirmation` exactly once.
- Every selected entity must belong to that run's recommendations and expected entity type.
- Agent routes reuse invitation and proposal domain services; they do not duplicate marketplace writes.
- No database transaction is held open during a Gemini/network call.
- Repeated confirmation returns the previously committed outcome or a stable conflict; it never repeats side effects.
- Partial-success semantics for a multi-selection confirmation must be decided and tested. The recommended default is one atomic confirmation for all valid selections, with validation completed before writes.

### Identity, administration, and notifications

- Email identity remains case-insensitively unique.
- Token hashes, never raw verification or reset tokens, are persisted.
- Suspended users cannot perform authenticated marketplace writes.
- Administrative mutations are authorization-checked, audited, and idempotent where appropriate.
- Notifications required by a domain transaction are inserted using the same transaction context.
- External delivery, if added later, uses an outbox worker and occurs after commit; network I/O is never performed inside a database transaction.

## 5. Execution Phases

Every phase ends with a merge/deployment gate. A later phase cannot compensate for a failed earlier gate.

### Phase 0 — ADR, dependency qualification, and baseline

Deliverables:

- ADR documenting Drizzle selection, stable-version pinning, migration ownership, raw-SQL policy, money representation, and rollback policy.
- A disposable PostgreSQL environment built only from numbered migrations.
- Baseline results for typecheck, lint, build, unit tests, integration tests, migration status, and dependency audit.
- Inventory mapping all 171 direct query calls to an owning domain and migration phase.
- Endpoint/API behavior inventory, including response shapes and current error status codes.

Gate:

- Baseline is reproducible in CI and locally.
- No ORM code has changed application behavior.
- Existing unrelated working-tree changes remain untouched.

### Phase 1 — Characterization and concurrency safety net

Before replacing queries, add real-PostgreSQL tests for:

- Full customer job -> worker proposal -> acceptance -> work -> payment -> review flow.
- Authorization matrix for owner, unrelated customer, assigned worker, unrelated worker, admin, suspended user, and unauthenticated caller.
- Duplicate proposal, invite, payment, and review behavior.
- Two workers proposing concurrently to the same posted job.
- Two acceptance requests racing for different proposals.
- Payment creation racing with a repeat request.
- Review creation racing with a repeat request.
- Invitation acceptance racing with a direct proposal submission.
- Agent confirm/confirm and confirm/cancel races.
- Transaction rollback after an injected failure at each multi-write step.

Add data-audit queries for orphaned references, invalid states, duplicate accepted proposals, conflicting payment flags, duplicate skills/categories, null required relationships, and aggregate drift.

Gate:

- Existing behavior is characterized.
- Tests expose known unsafe races before the corresponding implementation phase and become passing requirements during that phase.
- Tests can only use a guarded `TEST_DATABASE_URL`.

### Phase 2 — Drizzle and TypeScript database foundation

Deliverables:

- Add exact stable Drizzle dependencies and lock them.
- Convert database bootstrap to TypeScript.
- Wrap the current configured `pg.Pool` with Drizzle.
- Add validated environment configuration for runtime URL, migration URL, pool limits, connect timeout, statement timeout, transaction timeout, and SSL mode.
- Add pool startup, readiness, metrics, graceful shutdown, and idle-client error handling.
- Add a typed `withTransaction` boundary with optional isolation configuration and retry policy limited to explicitly retryable transaction errors.
- Map PostgreSQL SQLSTATE codes into stable application errors without exposing driver details.
- Introspect the disposable migrated database and create reviewed schema modules and relations for all 18 tables.
- Add compile-time and runtime tests for UUID, numeric, timestamp, JSONB, and nullable-column mappings.
- Add CI schema-drift verification.

Gate:

- Application health/readiness works through the new database module.
- Existing `pg` consumers can temporarily coexist through the same pool.
- Empty-database migration plus Drizzle schema verification passes.
- No second connection pool or migration ledger exists.

### Phase 3 — Jobs and proposals vertical slice

Deliverables:

- Jobs and proposal request schemas, repositories, services, policies, controllers, response mappers, and integration tests.
- Transaction-safe proposal submission, acceptance, decline, and withdrawal.
- Transaction-safe guarded job transitions.
- `FOR UPDATE` locking or an equivalent guarded-write design for contested job/proposal rows.
- A partial unique index allowing at most one accepted proposal per job.
- Required relationship, status, timestamp, and deletion-policy hardening migrations after auditing existing rows.
- Notification creation through the same transaction.
- Agent proposal submission redirected to the same proposal service.

Gate:

- All job/proposal characterization and race tests pass repeatedly.
- No direct job/proposal SQL remains in routes or agent tools.
- A failure at any step leaves no partial state.
- API contracts remain compatible or have a documented, versioned change.

### Phase 4 — Payments and reviews vertical slice

Deliverables:

- Payment state ADR and schema migration.
- Exact monetary domain type and serialization tests.
- Transaction-safe record, confirm, dispute, and any required resolution commands.
- Review service that atomically inserts the review, transitions the job, updates aggregates, and creates a notification.
- Aggregate rebuild command and drift check.
- Idempotency and concurrency coverage.
- Repository queries for worker earnings with database-side aggregation and explicit numeric handling.

Gate:

- No payment/review partial writes are possible under injected failures.
- Conflicting payment states are rejected by PostgreSQL.
- Duplicate and concurrent requests have deterministic results.
- Earnings and rating results match the pre-migration contract on fixture data.

### Phase 5 — Invitations and agent confirmations

Deliverables:

- Invitation service shared by HTTP controllers and the match agent.
- Proposal service shared by HTTP controllers and the proposal agent.
- Active-run partial unique indexes and recommendation uniqueness constraints.
- Transaction-safe, ownership-checked, recommendation-bound agent confirmations.
- Deterministic confirm/cancel behavior under concurrency.
- Separate short transactions for run/step persistence; no long transaction spans AI calls.
- Sanitized persistence of agent errors and structured step data.

Gate:

- Direct marketplace-write SQL is removed from agent orchestration and tools.
- Agent race and replay tests pass repeatedly.
- A failed Gemini request cannot leave an apparently active run indefinitely; recovery rules are documented and tested.

### Phase 6 — Identity, profiles, users, and discovery

Deliverables:

- Authentication and profile repositories/services in TypeScript.
- Transaction-safe registration retained under Drizzle.
- Token lifecycle and case-insensitive email uniqueness constraints reviewed and hardened.
- Worker/customer profile read models with explicit public-field selection.
- Worker and job search repositories with validated filters, capped pagination, allowlisted sorting, and no N+1 queries.
- Portfolio and photo metadata writes made atomic where multiple rows are inserted or deleted.

Gate:

- Authentication integration and negative authorization tests pass.
- Sensitive authentication/NIC fields cannot appear in public response mappers.
- Search query plans meet the performance gate in Phase 9.

### Phase 7 — Notifications, reports, administration, and rate limits

Deliverables:

- Notification repository that accepts an optional transaction context.
- Ownership-guarded read and read-all commands.
- Report and administration services with audit records for moderation mutations.
- Category mutations with case-insensitive uniqueness and safe deactivation rules.
- Rate-limit repository retaining the current atomic upsert behavior.
- Cleanup changed from probabilistic request work to a documented scheduled task or bounded maintenance process.

Gate:

- All remaining route and middleware SQL is removed.
- Admin and report authorization matrices pass.
- Rate limiting remains atomic under concurrent requests.

### Phase 8 — Agent reads, history, and memory

Deliverables:

- Agent-run, step, recommendation, and memory repositories.
- Typed JSON schemas for plan, factors, inputs, outputs, and memory values.
- Repository-owned optimized read models for job/worker recommendations and history.
- Retention and deletion policy for agent prompts, steps, memory, and errors.
- PII minimization rules for AI context and logs.

Gate:

- No raw pool access remains in agents.
- Agent read results retain contract compatibility.
- Retention behavior is tested and documented.

### Phase 9 — Query and operational hardening

Deliverables:

- Query inventory with expected cardinality, pagination, and supporting indexes.
- `EXPLAIN (ANALYZE, BUFFERS)` evidence on staging-scale data for job feed, worker search, proposals, notifications, earnings, admin filters, and agent candidate queries.
- Removal of N+1 patterns and unbounded list queries.
- Cursor pagination for feeds that can grow materially; strict maximum page sizes everywhere else.
- Slow-query logging with redacted bind values, request ID, operation name, and duration.
- Metrics for pool waiting/active/idle counts, query duration, transaction retries, deadlocks, serialization failures, and readiness failures.
- Runtime and migration database roles separated by least privilege.
- Verified TLS behavior and separate pooled runtime/direct migration URLs where the provider requires them.
- Capacity calculation connecting serverless instance concurrency, local pool maximum, provider limits, and deployment scaling.
- Backup/PITR configuration and a timed restore rehearsal.

Initial service-level objectives must be agreed using measured staging data. At minimum, no migrated hot query may regress its baseline p95 latency by more than 10% without an explicit reviewed tradeoff, and no endpoint may issue an unbounded query.

Gate:

- Query plans are reviewed and stored with the release evidence.
- Pool exhaustion and database unavailability fail predictably and are observable.
- Restore rehearsal meets the agreed recovery point and recovery time objectives.

### Phase 10 — Remove transitional access and complete TypeScript conversion

Deliverables:

- Remove direct raw-pool compatibility exports.
- Add lint restrictions preventing database imports outside repositories/infrastructure.
- Convert all backend production persistence paths to strict TypeScript.
- Remove `allowJs` only when all backend runtime files are converted.
- Delete duplicated legacy query implementations after parity is proven.
- Produce a registry of intentional raw SQL repository queries with owners and tests.

Gate:

- `rg` and lint find no `pool.query`/`client.query` in application source outside approved migration/test infrastructure.
- No controller, policy, service, middleware, route, agent, or agent tool imports the database driver directly.
- Strict typecheck, lint, build, all tests, schema drift, migration smoke tests, and dependency audit pass in CI.

### Phase 11 — Staging qualification and production rollout

Deliverables:

- Production-like staging database restored from sanitized representative data.
- Backward-compatible expand/migrate/contract sequence for every schema change.
- Release runbook with migration status check, backup verification, deploy order, smoke tests, canary metrics, rollback triggers, and ownership.
- Application rollback tested while additive migrations remain applied.
- Corrective migration procedure tested in staging.
- Post-deployment reconciliation queries for workflow and aggregate invariants.

Rollout order:

1. Verify backup/PITR and migration connection.
2. Apply additive migrations with the guarded migration runner.
3. Verify migration ledger/checksums and readiness.
4. Deploy the application to a canary or limited traffic segment.
5. Run authenticated smoke tests for each migrated domain.
6. Compare error rate, p95/p99 latency, pool pressure, deadlocks, and invariant checks with baseline.
7. Increase traffic only while gates remain green.
8. Roll back application traffic immediately on a trigger; use a corrective forward migration only when necessary.

Gate:

- Staging qualification is signed off.
- Rollback and restore procedures have been executed, not merely documented.
- Production reconciliation returns no invariant violations.

## 6. Pull Request Sequence

Keep each change independently reviewable and deployable:

1. ADR, query inventory, baseline, and characterization-test harness.
2. Marketplace workflow and concurrency characterization tests.
3. Drizzle/TypeScript database foundation and full schema mapping.
4. Jobs/proposals repository and transaction-safe services.
5. Job/proposal correctness constraints.
6. Payments/reviews repository, state model, and transaction-safe services.
7. Invitations and agent-confirmation service reuse.
8. Auth/profile/users migration.
9. Worker/customer discovery migration.
10. Notifications/reports/admin/rate-limit migration.
11. Agent persistence and read-model migration.
12. Performance, observability, least-privilege roles, and operational runbooks.
13. Remove compatibility layer and enforce architectural boundaries.
14. Staging qualification and production release evidence.

Do not mix unrelated frontend redesigns or product features into these pull requests.

## 7. Test Matrix

Every migrated command must include:

- Successful behavior.
- Invalid input.
- Missing record.
- Incorrect role.
- Correct role but wrong ownership.
- Invalid state transition.
- Duplicate/replayed request.
- Concurrent competing request where relevant.
- Database constraint violation mapping.
- Injected mid-transaction failure and rollback verification.
- Stable API response/error contract.

Database and migration tests must include:

- Migrate a new empty PostgreSQL database to current.
- Baseline a guarded legacy schema.
- Reject changed or missing applied migration files.
- Upgrade from the previous production schema with representative data.
- Detect Drizzle/schema migration drift.
- Validate all foreign keys, unique/partial indexes, checks, defaults, and deletion policies.
- Rebuild and compare rating/completion aggregates.
- Run rollback-compatible older application code against additive new schema during staging qualification.

Do not mock repositories in end-to-end workflow tests. Unit tests may mock external email, storage, and Gemini boundaries, but PostgreSQL behavior must be tested against PostgreSQL.

## 8. Observability and Error Policy

- Assign a request ID to every request and propagate an operation name into repository logs.
- Log query duration and failure metadata, never password hashes, tokens, NIC paths, email bodies, proposal messages, or arbitrary SQL bind values.
- Translate expected SQLSTATE errors into stable domain errors: unique violation, foreign-key violation, check violation, serialization failure, deadlock, statement timeout, and connection failure.
- Return generic 500 responses in production; log internal causes with correlation IDs.
- Alert on migration failure, readiness failure, pool saturation, sustained slow-query rate, deadlock/serialization spikes, and invariant-reconciliation failures.
- Define dashboards and alert owners before production rollout.

## 9. Security Controls

- Separate migration-owner and runtime application database credentials.
- Runtime role receives only required DML and sequence privileges; no schema-owner privileges.
- Enforce TLS certificate verification according to the provider's supported connection mode.
- Keep database URLs and generated schema artifacts free of credentials.
- Parameterize every value and allowlist every dynamic SQL identifier.
- Select public columns explicitly and map responses; never expose database rows directly.
- Include dependency review, lockfile review, `npm audit`, and secret scanning in CI.
- Define retention and deletion behavior for user, NIC, job, report, notification, and AI data before calling the persistence layer production-ready.

## 10. Rollback and Data-Safety Rules

- Never reset, force-push, or destructively synchronize a production schema.
- Never edit an applied migration.
- Take or verify a recoverable backup/PITR point before material migrations.
- Use expand/migrate/contract changes so the previous application remains compatible during rollout.
- Defer destructive column/table removal to a later release after usage telemetry and rollback windows expire.
- Every data backfill must be resumable, bounded, observable, and safe to run more than once.
- Every corrective migration needs a preflight audit query and post-migration reconciliation query.
- A production release cannot proceed without named owners for application rollback, database remediation, and incident communication.

## 11. Definition of Done

This project is complete only when all of the following are true:

- All 18 current tables are represented accurately in reviewed Drizzle schemas.
- All 171 current direct query sites have been removed or replaced by a documented, repository-owned equivalent.
- Routes, middleware, services, and agent orchestration contain no direct database queries.
- Every mutating endpoint uses a named service and explicit authorization policy.
- All multi-write workflows are atomic, with documented lock/isolation strategy.
- Critical invariants are backed by PostgreSQL constraints where feasible.
- All replay and concurrency tests pass repeatedly on real PostgreSQL.
- No migration tool other than the guarded numbered-SQL runner changes production schema.
- No unbounded production list query exists.
- Numeric, timestamp, JSONB, and API serialization behavior is tested.
- Logs and errors do not expose secrets or sensitive user data.
- Query and pool metrics, dashboards, alerts, reconciliation checks, and runbooks exist.
- Least-privilege runtime and migration roles are deployed.
- Backup restore and application rollback have been rehearsed successfully.
- Typecheck, lint, build, unit tests, integration tests, migration tests, drift checks, and security audit pass in CI.
- Staging qualification and production canary evidence are recorded.
- Architecture and operational documentation match the deployed implementation.

Passing this definition means the persistence and marketplace workflow layer is production-grade. It does not waive separate production readiness requirements for authentication policy, infrastructure, storage, email delivery, AI safety, frontend security, privacy, legal compliance, or incident response outside this project's scope.

## 12. Decisions Required Before the First Implementation PR

The implementation can begin after these items are confirmed in ADRs:

1. Exact stable Drizzle and Drizzle Kit versions after a Node 22/TypeScript compatibility spike.
2. Exact money representation in domain code: decimal library or integer minor units.
3. Payment status and correction/dispute workflow.
4. Whether multi-selection agent confirmation is all-or-nothing or explicitly partial.
5. Data retention periods for notifications, reports, rate-limit buckets, and agent traces/memory.
6. Production RPO/RTO and the database provider's backup/PITR capabilities.
7. Initial latency/error/pool SLOs based on staging measurements.

Recommended defaults are: stable pinned Drizzle 0.45.x, exact decimal strings plus a decimal arithmetic library, explicit payment status, atomic agent confirmation, scheduled retention jobs, and SLOs derived from a staging baseline rather than arbitrary targets.

## 13. Reference Documentation

- Drizzle with an existing PostgreSQL project: <https://orm.drizzle.team/docs/get-started/postgresql-existing>
- Drizzle with `node-postgres`: <https://orm.drizzle.team/docs/get-started-postgresql>
- Drizzle transactions: <https://orm.drizzle.team/docs/transactions>
- Drizzle Kit introspection: <https://orm.drizzle.team/docs/drizzle-kit-pull>
- Existing Fixly modernization plan: `FIXLY_IMPLEMENTATION_PLAN.md`

## Appendix A — Current Query Migration Coverage

The 171 direct production query calls are assigned to a migration owner below. Counts are a baseline guardrail, not a measure of implementation effort; one current query may become multiple repository operations inside a transaction, while several duplicate queries may collapse into one read model.

| Migration owner | Current source groups | Direct calls | Planned phases |
| --- | --- | ---: | --- |
| Identity, profiles, and discovery | Auth (15), profile (15), workers (6), customers (6), auth middleware (1), upload ownership (1) | 44 | 2 and 6 |
| Marketplace workflows | Jobs (16), proposal actions (8), proposals (5), invitations (3), invitation actions (8), payments (8), reviews (3) | 51 | 3–5 |
| Engagement and operations | Admin (21), notifications (3), reports (2), notification dispatch (1), rating aggregate (1), rate limiter (2), readiness (1) | 31 | 4, 7, and 9 |
| AI-agent persistence and tools | Proposal agent (12), match agent (10), agent routes (7), memory (3), submit-proposal tool (5), create-invite tool (3), job/worker lookup tools (5) | 45 | 3, 5, and 8 |
| **Total** |  | **171** |  |

Coverage is complete only when each call is either removed or entered in the intentional raw-SQL registry with a repository owner, operation name, parameterization review, integration test, and query-plan evidence where performance-sensitive.

## Appendix B — Table Ownership

| Domain | Tables | Primary phase |
| --- | --- | ---: |
| Identity and profiles | `users`, `worker_profiles`, `worker_skills`, `worker_portfolio_photos` | 6 |
| Marketplace catalog and work | `categories`, `jobs`, `job_photos` | 3 and 6 |
| Marketplace offers | `proposals`, `invites` | 3 and 5 |
| Completion and trust | `payments`, `reviews`, `reports` | 4 and 7 |
| Engagement | `notifications` | 7 |
| AI agents | `agent_runs`, `agent_run_steps`, `agent_memories`, `agent_recommendations` | 5 and 8 |
| Operations | `rate_limit_buckets`, `schema_migrations` | 2, 7, and migration infrastructure |

`schema_migrations` is infrastructure-owned and is not mapped as a Drizzle application entity unless required for typed readiness/status queries. It remains controlled by the migration runner.
