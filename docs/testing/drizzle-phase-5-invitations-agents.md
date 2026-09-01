# Phase 5: Invitations and agent confirmations

## Transaction and replay contract

- Invitation creation, invitation acceptance, and invitation decline run at serializable isolation with bounded retry for PostgreSQL serialization failures and deadlocks.
- Accepting an invitation locks the invitation and job, changes a pending invitation to `accepted`, creates or locates the worker proposal, advances a posted job to `proposals_received`, and creates the customer notification in one transaction.
- Repeating an accepted invitation request returns a stable success without creating another proposal or notification. Repeating a decline is also idempotent; an opposing terminal action is rejected.
- Match and proposal confirmations lock their awaiting run. Every requested entity is validated against that run's stored recommendations before any invite, proposal, notification, recommendation action, or run state is written. Multi-selection confirmation is all-or-nothing.
- A replayed confirmation receives a stable state conflict, so completed effects are never repeated. A confirmation that races cancellation has one terminal result: either the run completes with its writes, or cancellation wins and no confirmation writes occur.

## Database constraints

Migration `008_invitations_agent_confirmation_integrity.sql` adds:

- one active match run per customer and job;
- one active proposal run per worker;
- one recommendation per `(run_id, entity_type, entity_id)`.

Active means `pending`, `running`, or `awaiting_confirmation`. The existing `(job_id, worker_id)` invitation uniqueness constraint remains the boundary for one invitation per worker/job.

## Agent failure recovery

Agent execution persists its `running` row before any Gemini call but does not hold a database transaction across network work. Gemini failures fall back to deterministic scoring. Any unrecoverable execution failure changes the run to terminal `error`; it therefore ceases to block a future active run. The integration suite covers a failed proposal-agent startup and verifies this state transition.

## Verification evidence

Run from `backend/` with the guarded disposable database URL:

```sh
TEST_DATABASE_URL=... npm run test:integration
TEST_DATABASE_URL=... npm run db:schema:verify
DATABASE_URL=... npm run db:audit:marketplace
```

The Phase 5 suite includes invitation acceptance replay, injected notification failure rollback, recommendation-bound all-or-nothing confirmations, active-run/recommendation index violations, confirmation/cancellation races, and failed-run recovery.
