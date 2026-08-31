# Drizzle Phase 3 Jobs and Proposals Evidence

Jobs and proposals now use the shared Drizzle client through a marketplace repository and transaction-aware service. The proposal HTTP route and proposal-agent adapter use the same `submitProposal` service. Acceptance locks the proposal and owning job, accepts one proposal, declines the remaining pending proposals, assigns the job, and inserts the notification in one serializable transaction. Serialization/deadlock retries are bounded by the Phase 2 transaction policy.

Migration `006_jobs_proposals_integrity.sql` adds the partial unique index that permits at most one accepted proposal per job and validates required job/proposal relationships, a positive-price constraint, and the assigned-workflow worker requirement. The marketplace audit is the required preflight before deploying it to a shared environment.

The PostgreSQL suite proves accepted proposals cannot be withdrawn, the partial unique index rejects a second acceptance, competing acceptance requests yield exactly one success, and an injected notification failure rolls all acceptance writes back. The remaining two expected failures belong to later payment and agent-confirmation phases.
