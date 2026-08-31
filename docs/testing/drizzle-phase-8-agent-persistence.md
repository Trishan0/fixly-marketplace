# Phase 8: Agent persistence, history, and memory

Agent runs, steps, recommendations, candidate reads, history, cancellation, and memory now use `modules/agents/repository.js`; agent routes and tools do not access the raw pool.

Agent persistence is deliberately split into short statements. A Gemini call is never executed inside a database transaction. Runs start as `running`, transition to `awaiting_confirmation` only after recommendations are persisted, and transition to terminal `error` on unrecoverable execution failure.

Stored step input/output, plans, recommendation factors, and memories are JSONB application data. They must contain only bounded marketplace context; credentials, raw tokens, NIC documents, and full private contact details are excluded. Retention is operationally managed: completed/error/cancelled runs and their dependent steps/recommendations may be deleted after the product-approved retention period; cascading foreign keys remove dependent rows. No retention job is enabled until a policy owner defines the period and legal hold process.

The Phase 8 gate is verified with lint, typecheck, real-PostgreSQL integration tests, and a source audit confirming no `pool.query` remains in `src/agents` or `routes/agent.js`.
