# Database operational controls

The runtime pool has bounded connection, statement, and idle-transaction timeouts. It records query count, failures, average duration, and slow-query count; queries at or above `DATABASE_SLOW_QUERY_MS` emit structured duration-only logs, never SQL text or bind values.

`GET /api/ready` includes pool waiting/idle/total counts plus query failure and slow-query counters. Alerting systems should alert on readiness failures, non-zero sustained pool waiting, query failure spikes, and slow-query rate.

Every externally reachable list in migrated routes uses a bounded limit. Worker, worker-review, admin-user, admin-job, and agent-history endpoints validate pagination and cap their page sizes.

Before a production release, run `EXPLAIN (ANALYZE, BUFFERS)` against staging-scale, non-production data for worker search, job feed, proposals, notifications, earnings, administrative filters, and agent candidate reads. Store those plans with the deployment evidence; provider-level runtime/migration role separation, TLS verification, backup/PITR, and a restore rehearsal are deployment controls documented in the Phase 11 runbook.
