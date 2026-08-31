# Drizzle Migration Phase 1 Characterization

- Status: Complete
- Date: 2026-08-31
- Verified against: isolated PostgreSQL 18 container

## Added coverage

- Complete customer job -> worker proposal -> assignment -> work -> payment -> review workflow.
- Authentication, ownership, and duplicate-proposal behavior.
- Repeated payment/review behavior after job-state advancement.
- One accepted proposal database constraint requirement.
- Unsafe two-proposal acceptance interleaving requirement.
- Pending-only proposal withdrawal requirement.
- Mutually exclusive payment confirmation/dispute requirement.
- Agent confirmation recommendation-membership requirement.

The first three categories are ordinary passing tests. The final five are intentionally declared with Vitest `test.fails`: they document and continuously expose known missing production invariants until the owning vertical slice implements and converts them to normal passing tests.

## Read-only invariant audit

Run from `backend/` against an authorized target database:

```bash
npm run db:audit:marketplace
```

The command checks for multiple accepted proposals, assignment mismatches, missing workflow workers, conflicting payment flags, invalid amounts, rating aggregate drift, duplicate active agent runs, and missing critical relationships. It prints only IDs/counts and returns non-zero when violations are found.

## Phase gate result

The integration suite passed against PostgreSQL 18 with 7 normal passing tests and 5 visible expected failures. The expected failures are requirements for Phases 3 through 5; they are not permission to ship the current behavior.
