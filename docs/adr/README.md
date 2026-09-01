# Architecture Decision Records

Architecture decision records (ADRs) capture decisions that affect more than one Fixly feature or milestone.

## Status meanings

- **Accepted**: implementation should follow the decision.
- **Proposed**: product or engineering confirmation is still required.
- **Superseded**: a later ADR replaces the decision.

## Records

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-express-domain-authority.md) | Express owns marketplace business logic | Accepted |
| [0002](0002-payment-recording-scope.md) | Fixly records offline payments; it does not process funds | Accepted |
| [0003](0003-marketplace-state-machine.md) | Canonical job, proposal, payment, and review transitions | Proposed |
| [0004](0004-web-api-topology.md) | Next.js and Express use a same-origin API topology | Accepted |
| [0005](0005-cookie-authentication-migration.md) | Migrate browser auth from localStorage bearer tokens to secure cookies | Accepted |
| [0006](0006-database-migrations-and-tests.md) | Numbered SQL migrations and real PostgreSQL integration tests | Accepted |
| [0007](0007-drizzle-persistence-architecture.md) | Drizzle repositories on the existing PostgreSQL pool | Accepted |

## Creating or changing an ADR

Add a new numbered record rather than rewriting the history of an accepted decision. Small clarifications may be appended with a date. A change in direction should supersede the earlier record and explain migration and rollback consequences.
