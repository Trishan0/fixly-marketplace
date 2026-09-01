# 0008 — Explicit payment state and exact monetary values

**Status:** Accepted

Payments use PostgreSQL `NUMERIC(12,2)` and are represented as decimal strings at persistence and API boundaries. JavaScript floating-point arithmetic is forbidden for payment totals; aggregation remains in PostgreSQL and is serialized as decimal strings.

The legacy independent `worker_confirmed` and `disputed` booleans are retained temporarily for backwards-compatible reads, but they are derived from a new `payments.status` value. The supported states are `recorded`, `confirmed`, and `disputed`. A database trigger allows only `recorded -> confirmed` or `recorded -> disputed`, synchronizes the legacy flags, and rejects amount changes after insertion. A correction or dispute-resolution workflow requires a later product decision and a separate audited schema change; it is not silently implied by this migration.

Payment recording, confirmation, dispute, and review creation are transaction-owned commands. A review atomically inserts its row, transitions the job, recomputes the assigned worker aggregate, and creates its notification. Any failure rolls the whole command back.
