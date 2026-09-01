'use strict';

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const AUDITS = [
  {
    name: 'multiple_accepted_proposals',
    sql: `
      SELECT job_id, COUNT(*)::int AS count
      FROM proposals
      WHERE status = 'accepted'
      GROUP BY job_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: 'accepted_proposal_assignment_mismatch',
    sql: `
      SELECT p.id AS proposal_id, p.job_id, p.worker_id, j.assigned_worker_id
      FROM proposals p
      JOIN jobs j ON j.id = p.job_id
      WHERE p.status = 'accepted'
        AND j.assigned_worker_id IS DISTINCT FROM p.worker_id
    `,
  },
  {
    name: 'assigned_workflow_missing_worker',
    sql: `
      SELECT id AS job_id, status
      FROM jobs
      WHERE status IN ('assigned', 'in_progress', 'completed', 'payment_recorded', 'reviewed')
        AND assigned_worker_id IS NULL
    `,
  },
  {
    name: 'conflicting_payment_flags',
    sql: `
      SELECT id AS payment_id, job_id
      FROM payments
      WHERE worker_confirmed = true AND disputed = true
    `,
  },
  {
    name: 'non_positive_amounts',
    sql: `
      SELECT id AS payment_id, job_id, amount
      FROM payments
      WHERE amount <= 0
      UNION ALL
      SELECT id AS payment_id, job_id, proposed_price AS amount
      FROM proposals
      WHERE proposed_price IS NOT NULL AND proposed_price <= 0
    `,
  },
  {
    name: 'rating_aggregate_drift',
    sql: `
      SELECT wp.user_id,
             wp.avg_rating,
             wp.total_jobs_done,
             COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = wp.user_id), 0) AS expected_avg_rating,
             (SELECT COUNT(*)::int FROM jobs j
              WHERE j.assigned_worker_id = wp.user_id
                AND j.status IN ('completed', 'payment_recorded', 'reviewed')) AS expected_total_jobs_done
      FROM worker_profiles wp
      WHERE wp.avg_rating IS DISTINCT FROM COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = wp.user_id), 0)
         OR wp.total_jobs_done IS DISTINCT FROM (SELECT COUNT(*)::int FROM jobs j
             WHERE j.assigned_worker_id = wp.user_id
               AND j.status IN ('completed', 'payment_recorded', 'reviewed'))
    `,
  },
  {
    name: 'duplicate_active_agent_runs',
    sql: `
      SELECT user_id, agent_type, job_id, COUNT(*)::int AS count
      FROM agent_runs
      WHERE status IN ('pending', 'running', 'awaiting_confirmation')
      GROUP BY user_id, agent_type, job_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: 'duplicate_agent_recommendations',
    sql: `
      SELECT run_id, entity_type, entity_id, COUNT(*)::int AS count
      FROM agent_recommendations
      GROUP BY run_id, entity_type, entity_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    name: 'missing_critical_relationships',
    sql: `
      SELECT 'jobs.customer_id' AS relationship, id AS record_id FROM jobs WHERE customer_id IS NULL
      UNION ALL
      SELECT 'jobs.category_id', id FROM jobs WHERE category_id IS NULL
      UNION ALL
      SELECT 'proposals.job_id', id FROM proposals WHERE job_id IS NULL
      UNION ALL
      SELECT 'proposals.worker_id', id FROM proposals WHERE worker_id IS NULL
      UNION ALL
      SELECT 'invites.customer_id', id FROM invites WHERE customer_id IS NULL
      UNION ALL
      SELECT 'invites.worker_id', id FROM invites WHERE worker_id IS NULL
      UNION ALL
      SELECT 'notifications.user_id', id FROM notifications WHERE user_id IS NULL
    `,
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let violationCount = 0;

  try {
    for (const audit of AUDITS) {
      const result = await pool.query(audit.sql);
      if (result.rowCount === 0) {
        console.log(`PASS ${audit.name}`);
        continue;
      }

      violationCount += result.rowCount;
      console.error(`FAIL ${audit.name}: ${result.rowCount} violation(s)`);
      for (const row of result.rows) console.error(JSON.stringify(row));
    }
  } finally {
    await pool.end();
  }

  if (violationCount > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`Marketplace invariant audit failed: ${error.message}`);
  process.exitCode = 1;
});
