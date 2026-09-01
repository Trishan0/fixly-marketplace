#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--check') return { apply: false };
  if (argv.length === 1 && argv[0] === '--apply') return { apply: true };
  throw new Error('Usage: node scripts/rebuild-worker-aggregates.js [--check|--apply]');
}

const DRIFT_QUERY = `
  SELECT wp.user_id, wp.avg_rating, wp.total_jobs_done,
         COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = wp.user_id), 0) AS expected_avg_rating,
         (SELECT COUNT(*)::int FROM jobs j
          WHERE j.assigned_worker_id = wp.user_id
            AND j.status IN ('completed', 'payment_recorded', 'reviewed')) AS expected_total_jobs_done
  FROM worker_profiles wp
  WHERE wp.avg_rating IS DISTINCT FROM COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = wp.user_id), 0)
     OR wp.total_jobs_done IS DISTINCT FROM (SELECT COUNT(*)::int FROM jobs j
       WHERE j.assigned_worker_id = wp.user_id
         AND j.status IN ('completed', 'payment_recorded', 'reviewed'))
`;

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (apply) {
      await pool.query('BEGIN');
      try {
        await pool.query(`
          UPDATE worker_profiles wp
          SET avg_rating = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.worker_id = wp.user_id), 0),
              total_jobs_done = (SELECT COUNT(*)::int FROM jobs j
                                 WHERE j.assigned_worker_id = wp.user_id
                                   AND j.status IN ('completed', 'payment_recorded', 'reviewed'))
        `);
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    const drift = await pool.query(DRIFT_QUERY);
    if (drift.rowCount > 0) {
      for (const row of drift.rows) console.error(JSON.stringify(row));
      throw new Error(`Worker aggregate drift detected: ${drift.rowCount} profile(s)`);
    }
    console.info(apply ? 'Worker aggregates rebuilt and verified' : 'Worker aggregates match source data');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Worker aggregate maintenance failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { DRIFT_QUERY, parseArgs };
