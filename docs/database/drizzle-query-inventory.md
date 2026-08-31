# Drizzle Migration Query Inventory

- Status: Phase 0 baseline
- Captured: 2026-08-31
- Source: `backend/src/**/*.js`
- Detection: `pool.query` or `client.query`

## Totals

| Measure | Count |
| --- | ---: |
| Direct query calls | 171 |
| Production source files with direct queries | 29 |
| Application tables | 18 |
| Registered route handlers | 70 |

The canonical migration assignments are in [the production migration plan](../DRIZZLE_PRODUCTION_MIGRATION_PLAN.md#appendix-a--current-query-migration-coverage). The transaction and side-effect classification is in [the transaction inventory](../domain/transaction-inventory.md).

## File-level ownership

| Domain | Source file | Calls | Target phase |
| --- | --- | ---: | ---: |
| Identity/profile | `routes/auth.js` | 15 | 6 |
| Identity/profile | `routes/profile.js` | 15 | 6 |
| Identity/profile | `routes/workers.js` | 6 | 6 |
| Identity/profile | `routes/customers.js` | 6 | 6 |
| Identity/profile | `middleware/auth.js` | 1 | 6 |
| Identity/profile | `routes/uploads.js` | 1 | 6 |
| Marketplace | `routes/jobs.js` | 16 | 3 |
| Marketplace | `routes/proposalActions.js` | 8 | 3 |
| Marketplace | `routes/proposals.js` | 5 | 3 |
| Marketplace | `routes/payments.js` | 8 | 4 |
| Marketplace | `routes/reviews.js` | 3 | 4 |
| Marketplace | `routes/invites.js` | 3 | 5 |
| Marketplace | `routes/inviteActions.js` | 8 | 5 |
| Engagement/operations | `routes/admin.js` | 21 | 7 |
| Engagement/operations | `routes/notifications.js` | 3 | 7 |
| Engagement/operations | `routes/reports.js` | 2 | 7 |
| Engagement/operations | `services/notificationDispatch.js` | 1 | 7 |
| Engagement/operations | `services/ratingRecalc.js` | 1 | 4 |
| Engagement/operations | `middleware/rateLimit.js` | 2 | 7 |
| Engagement/operations | `app.js` | 1 | 2 |
| Agents | `agents/proposalAgent.js` | 12 | 8 |
| Agents | `agents/matchAgent.js` | 10 | 8 |
| Agents | `routes/agent.js` | 7 | 8 |
| Agents | `agents/memory.js` | 3 | 8 |
| Agents | `agents/tools/submitProposal.js` | 5 | 3 |
| Agents | `agents/tools/createInvite.js` | 3 | 5 |
| Agents | `agents/tools/getOpenJobs.js` | 2 | 8 |
| Agents | `agents/tools/getCandidateWorkers.js` | 2 | 8 |
| Agents | `agents/tools/getJobDetails.js` | 1 | 8 |
| **Total** |  | **171** |  |

## Query conversion rules

1. A query may move only to the assigned repository/service phase unless an ADR changes ownership.
2. Multi-write commands are converted before their read-only companion queries.
3. Agent write tools are deleted in favor of their shared marketplace service; they are not independently converted.
4. A source file is not considered migrated merely because it imports Drizzle. It is migrated only when no direct `pg` query remains in its runtime path.
5. Every intentional raw SQL statement gets an operation name, repository owner, parameterization review, integration test, and query-plan evidence when performance-sensitive.
