#!/usr/bin/env node
'use strict';

/**
 * report-agent-health.js — prints a summary of the agent layer's recent
 * health: how often Gemini actually ran vs. fell back to the deterministic
 * engine, average cost/latency for the runs that did use Gemini, and any
 * runs stuck beyond what the worker's own orphan-reclaim should allow.
 *
 * Not wired to a real alert channel (Slack/email/PagerDuty is a separate
 * decision) - this exists so the fallback-rate and cost risk are an actual
 * runnable number instead of invisible, and can be piped into whatever
 * alerting gets set up later. Exits 1 only when it finds currently-stuck
 * runs (a concrete problem to look at); a high fallback rate or cost is
 * reported, not treated as a hard failure, since "how much is too much" is
 * a business call, not an invariant this script can judge.
 *
 * Usage: node scripts/report-agent-health.js [--window-hours=24]
 */

const { Pool } = require('pg');

function parseArgs(argv) {
  const windowArg = argv.find(arg => arg.startsWith('--window-hours='));
  const windowHours = windowArg ? Number.parseInt(windowArg.split('=')[1], 10) : 24;
  if (!Number.isInteger(windowHours) || windowHours <= 0) {
    throw new Error('--window-hours must be a positive integer');
  }
  return { windowHours };
}

async function main() {
  const { windowHours } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const engineMix = await pool.query(
      `SELECT
         COUNT(*)::int AS total_runs,
         COUNT(*) FILTER (WHERE engine = 'gemini')::int AS gemini_runs,
         COUNT(*) FILTER (WHERE engine = 'deterministic')::int AS deterministic_runs
       FROM agent_runs
       WHERE created_at > NOW() - make_interval(hours => $1)
         AND status NOT IN ('pending', 'running')`,
      [windowHours]
    );
    const { total_runs: totalRuns, gemini_runs: geminiRuns, deterministic_runs: deterministicRuns } = engineMix.rows[0];
    const fallbackRate = totalRuns > 0 ? deterministicRuns / totalRuns : 0;

    const geminiCost = await pool.query(
      `SELECT
         ROUND(AVG(latency_ms))::int AS avg_latency_ms,
         ROUND(AVG(total_tokens))::int AS avg_total_tokens,
         ROUND(AVG(iteration_count), 1) AS avg_iterations
       FROM agent_runs
       WHERE engine = 'gemini' AND created_at > NOW() - make_interval(hours => $1)`,
      [windowHours]
    );

    const stuckRuns = await pool.query(
      `SELECT id, agent_type, status, created_at, claimed_at
       FROM agent_runs
       WHERE (status = 'running' AND claimed_at < NOW() - INTERVAL '10 minutes')
          OR (status = 'pending' AND created_at < NOW() - INTERVAL '2 minutes')
       ORDER BY created_at
       LIMIT 20`
    );

    console.log(`Agent health report — last ${windowHours}h`);
    console.log('---');
    console.log(`Total runs:          ${totalRuns}`);
    console.log(`Gemini:              ${geminiRuns}`);
    console.log(`Deterministic:       ${deterministicRuns}`);
    console.log(`Fallback rate:       ${(fallbackRate * 100).toFixed(1)}%`);
    console.log('---');
    console.log(`Gemini avg latency:  ${geminiCost.rows[0].avg_latency_ms ?? 'n/a'} ms`);
    console.log(`Gemini avg tokens:   ${geminiCost.rows[0].avg_total_tokens ?? 'n/a'}`);
    console.log(`Gemini avg rounds:   ${geminiCost.rows[0].avg_iterations ?? 'n/a'}`);
    console.log('---');
    if (stuckRuns.rowCount === 0) {
      console.log('Stuck runs:          none');
    } else {
      console.error(`Stuck runs:          ${stuckRuns.rowCount} (past the worker's own reclaim window - investigate)`);
      for (const row of stuckRuns.rows) console.error(JSON.stringify(row));
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Agent health report failed: ${error.message}`);
  process.exitCode = 1;
});
