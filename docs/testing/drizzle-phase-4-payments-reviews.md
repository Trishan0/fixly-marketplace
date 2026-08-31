# Drizzle Phase 4 Payments and Reviews Evidence

Migration `007_payments_reviews_integrity.sql` adds an explicit, trigger-enforced `payments.status` (`recorded`, `confirmed`, `disputed`). The existing confirmation/dispute booleans are synchronized compatibility fields, not independent state. The trigger rejects conflicting transitions and any amount mutation. Monetary values remain PostgreSQL `NUMERIC` decimal strings; worker earnings aggregates in PostgreSQL and returns strings rather than JavaScript floating-point totals.

Payment recording, confirmation, dispute, and review creation use the marketplace transaction service. The review command inserts the review, moves the job to `reviewed`, rebuilds the worker aggregate, and inserts its notification atomically. `db:ratings:check` detects aggregate drift; `db:ratings:rebuild` is an explicit maintenance command that rebuilds and then verifies it.

PostgreSQL tests cover duplicate payment concurrency, exact decimal persistence, direct database state/immutability enforcement, review aggregates, and injected notification failures that roll payment/review commands back.
