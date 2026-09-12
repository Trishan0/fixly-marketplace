#!/usr/bin/env node
'use strict';

/**
 * report-agent-health.js — prints a summary of the agent layer's recent
 * health: how often Gemini actually completed a run vs. degraded to a
 * plain rating-based list vs. failed outright, an approximate dollar cost
 * for the Gemini calls, and any runs stuck beyond what the worker's own
 * orphan-reclaim should allow.
 *
 * Not wired to a real alert channel (Slack/email/PagerDuty is a separate
 * decision) - this exists so failure rate and cost are actual runnable
 * numbers instead of invisible, and can be piped into whatever alerting
 * gets set up later. Exits 1 when it finds currently-stuck runs, or (only
 * if you asked it to care, via --daily-budget-usd) when estimated spend
 * for the window exceeds the pro-rated budget. A high degraded/error rate
 * on its own is reported, not treated as a hard failure, since "how much
 * is too much" is a business call, not an invariant this script can judge.
 *
 * Usage: node scripts/report-agent-health.js [--window-hours=24] [--daily-budget-usd=5]
 */

const { Pool } = require('pg');

// Deliberately approximate, not a billing-accurate figure - a rough
// blended per-1k-token estimate for a "flash"-class model. Override with
// AGENT_COST_PER_1K_TOKENS_USD as real pricing is confirmed/changes,
// rather than editing this file.
const DEFAULT_PRICE_PER_1K_TOKENS_USD = 0.0002;

function pricePerThousandTokens() {
  const envPrice = Number.parseFloat(process.env.AGENT_COST_PER_1K_TOKENS_USD);
  return Number.isFinite(envPrice) && envPrice > 0 ? envPrice : DEFAULT_PRICE_PER_1K_TOKENS_USD;
}

function parseArgs(argv) {
  const windowArg = argv.find(arg => arg.startsWith('--window-hours='));
  const windowHours = windowArg ? Number.parseInt(windowArg.split('=')[1], 10) : 24;
  if (!Number.isInteger(windowHours) || windowHours <= 0) {
    throw new Error('--window-hours must be a positive integer');
  }

  const budgetArg = argv.find(arg => arg.startsWith('--daily-budget-usd='));
  const dailyBudgetUsd = budgetArg ? Number.parseFloat(budgetArg.split('=')[1]) : null;
  if (budgetArg && !(Number.isFinite(dailyBudgetUsd) && dailyBudgetUsd > 0)) {
    throw new Error('--daily-budget-usd must be a positive number');
  }

  return { windowHours, dailyBudgetUsd };
}

async function main() {
  const { windowHours, dailyBudgetUsd } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const summary = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('awaiting_confirmation','completed','cancelled','error'))::int AS concluded_runs,
         COUNT(*) FILTER (WHERE engine = 'gemini')::int AS gemini_runs,
         COUNT(*) FILTER (WHERE engine = 'degraded')::int AS degraded_runs,
         COUNT(*) FILTER (WHERE status = 'error')::int AS error_runs,
         COALESCE(SUM(total_tokens) FILTER (WHERE engine = 'gemini'), 0)::bigint AS total_tokens_used,
         ROUND(AVG(latency_ms) FILTER (WHERE engine = 'gemini'))::int AS avg_latency_ms,
         ROUND(AVG(iteration_count) FILTER (WHERE engine = 'gemini'), 1) AS avg_iterations
       FROM agent_runs
       WHERE created_at > NOW() - make_interval(hours => $1)`,
      [windowHours]
    );
    const row = summary.rows[0];
    const concludedRuns = row.concluded_runs;
    const degradedRate = concludedRuns > 0 ? row.degraded_runs / concludedRuns : 0;
    const errorRate = concludedRuns > 0 ? row.error_runs / concludedRuns : 0;
    const estimatedCostUsd = (Number(row.total_tokens_used) / 1000) * pricePerThousandTokens();

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
    console.log(`Concluded runs:      ${concludedRuns}`);
    console.log(`Gemini (succeeded):  ${row.gemini_runs}`);
    console.log(`Degraded (AI down):  ${row.degraded_runs}  (${(degradedRate * 100).toFixed(1)}%)`);
    console.log(`Error:               ${row.error_runs}  (${(errorRate * 100).toFixed(1)}%)`);
    console.log('---');
    console.log(`Gemini avg latency:  ${row.avg_latency_ms ?? 'n/a'} ms`);
    console.log(`Gemini avg rounds:   ${row.avg_iterations ?? 'n/a'}`);
    console.log(`Total tokens used:   ${row.total_tokens_used}`);
    console.log(`Est. cost (approx):  $${estimatedCostUsd.toFixed(4)} (@ $${pricePerThousandTokens()}/1k tokens — not billing-accurate)`);

    let overBudget = false;
    if (dailyBudgetUsd != null) {
      const proratedBudget = dailyBudgetUsd * (windowHours / 24);
      console.log(`Budget for window:   $${proratedBudget.toFixed(4)} (from --daily-budget-usd=${dailyBudgetUsd})`);
      if (estimatedCostUsd > proratedBudget) {
        overBudget = true;
        console.error(`OVER BUDGET: estimated cost $${estimatedCostUsd.toFixed(4)} exceeds the pro-rated budget.`);
      }
    }

    console.log('---');
    if (stuckRuns.rowCount === 0) {
      console.log('Stuck runs:          none');
    } else {
      console.error(`Stuck runs:          ${stuckRuns.rowCount} (past the worker's own reclaim window - investigate)`);
      for (const r of stuckRuns.rows) console.error(JSON.stringify(r));
    }

    if (stuckRuns.rowCount > 0 || overBudget) {
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
