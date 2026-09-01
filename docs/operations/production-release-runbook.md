# Production database release runbook

This runbook is a deployment gate, not an automated substitute for production operations.

1. Confirm a current encrypted backup/PITR recovery point and record its timestamp, RPO/RTO, provider ticket/link, and the named database-remediation owner.
2. Use the schema-owner `DATABASE_MIGRATION_URL` only for `npm run db:migrate`; runtime uses the least-privilege `DATABASE_URL` role. Run `npm run db:release:preflight` with the production environment before a migration; it validates the two credential paths without printing credentials, checks the guarded migration ledger through the migration role, and verifies the runtime role can read the application schema.
3. Require `DATABASE_SSL_MODE=verify-full` in production and verify the provider certificate chain.
4. Run migration status, `db:schema:verify` against a disposable migrated database, invariant and aggregate audits, lint, typecheck, build, unit/integration suites, and `npm audit --omit=dev --audit-level=high`. Save each command's output with the release identifier.
5. Run and retain staging-scale `EXPLAIN (ANALYZE, BUFFERS)` evidence for the listed hot queries in database observability documentation.
6. Deploy additively, validate readiness and pool/query metrics, then perform a bounded canary with the previous application rollback artifact available.
7. A schema correction is forward-only: roll back application code if required and create a reviewed corrective migration; never edit an applied migration or reset production data.
8. Before declaring service production-ready, perform and time a restore rehearsal, deploy the previous application artifact against the newly migrated staging database, test the corrective-forward-migration procedure, name incident/rollback owners, define retention/hold periods, and configure dashboards/alerts for readiness, pool saturation, errors, slow queries, deadlocks, and serialization failures.

## Evidence record required for sign-off

Record the following in the release ticket or change-management system; do not substitute a source-control commit for this evidence.

| Gate | Required evidence | Owner |
| --- | --- | --- |
| Restore | Timestamped restore rehearsal, duration, recovered data window, and RPO/RTO result. | Database owner |
| Roles/TLS | Runtime-role grants, migration-role grants, and certificate-verification evidence. | Database owner |
| Migration | Guarded-runner output, migration ledger/checksum output, and schema-drift output. | Release owner |
| Compatibility | Previous application artifact runs its smoke suite against the additive migrated staging schema. | Application owner |
| Reconciliation | `db:audit:marketplace` and `db:ratings:check` return no violations after staging deploy and after production canary. | Domain owner |
| Performance | p95/p99, error rate, pool waiters, deadlocks/serialization failures, slow-query rate, and retained plans for registry items. | Observability owner |
| Rollback | Canary rollback trigger, decision owner, execution timestamp, and corrective-forward-migration outcome if used. | Incident owner |

Copy [release-evidence.example.json](release-evidence.example.json), replace every placeholder with the recorded external evidence, and run `npm run db:release:evidence -- --file path/to/evidence.json`. The template intentionally fails verification until every placeholder is replaced. The verifier rejects missing, negative, placeholder, or malformed sign-off fields; it does not create evidence or contact the deployment provider.

The repository can verify local and disposable-database controls. Provider-role grants, backup/PITR configuration, alerts, staging scale, and restore rehearsal require the deployment owner’s cloud account and cannot be asserted by source code alone.
