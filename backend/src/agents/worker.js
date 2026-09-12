/**
 * worker.js — in-process polling worker that executes agent runs off the
 * synchronous request path.
 *
 * routes/agent.js only creates a 'pending' agent_runs row and returns
 * immediately; this loop claims pending rows and does the actual
 * (potentially 30-iteration) Gemini work. No external queue or cron
 * service is used — the backend is a persistent Express process (see
 * app.js's app.listen), so a setInterval loop in the same process is
 * enough, and is safe under multiple instances via FOR UPDATE SKIP LOCKED.
 */

'use strict';

const repository = require('../modules/agents/repository');
const { executeMatchRun } = require('./matchAgent');
const { executeProposalRun } = require('./proposalAgent');

const POLL_INTERVAL_MS = 3000;
const STALE_MINUTES = 5;
// Caps how many runs *this process* executes concurrently, so a burst of
// pending work can't itself exhaust the (intentionally small) DB pool or
// spin up unbounded concurrent Gemini calls.
const MAX_CONCURRENT_RUNS = 3;
// Caps how many runs are 'running' *system-wide* - see claimPendingRun's
// own doc comment. Without this, horizontally scaling the app silently
// multiplies MAX_CONCURRENT_RUNS by however many instances are running.
const GLOBAL_CONCURRENT_RUN_CAP = 10;

let inFlight = 0;

async function executeRun(run) {
  try {
    if (run.agent_type === 'match') {
      await executeMatchRun(run);
    } else if (run.agent_type === 'proposal') {
      await executeProposalRun(run);
    } else {
      console.error(`[agent/worker] unknown agent_type "${run.agent_type}" for run ${run.id}`);
      await repository.failRun(run.id);
    }
  } catch (err) {
    // executeMatchRun/executeProposalRun already mark the run 'error' and
    // rethrow; log here so one bad run can't crash the poll loop.
    console.error(`[agent/worker] run ${run.id} (${run.agent_type}) failed:`, err.message);
  } finally {
    inFlight--;
  }
}

async function tick() {
  try {
    await repository.reclaimOrphanedRuns(STALE_MINUTES);
  } catch (err) {
    console.error('[agent/worker] failed to reclaim orphaned runs:', err.message);
  }

  if (inFlight >= MAX_CONCURRENT_RUNS) return;

  let run;
  try {
    run = await repository.claimPendingRun(GLOBAL_CONCURRENT_RUN_CAP);
  } catch (err) {
    console.error('[agent/worker] failed to claim a pending run:', err.message);
    return;
  }
  if (!run) return;

  inFlight++;
  // Intentionally not awaited: let tick() return so the interval keeps
  // claiming more work (up to MAX_CONCURRENT_RUNS) while this one executes.
  executeRun(run);
}

let intervalHandle = null;

/** @param {{ intervalMs?: number }} [opts] */
function startAgentWorker({ intervalMs = POLL_INTERVAL_MS } = {}) {
  if (intervalHandle) return intervalHandle;
  intervalHandle = setInterval(() => {
    tick().catch(err => console.error('[agent/worker] tick error:', err.message));
  }, intervalMs);
  intervalHandle.unref?.(); // don't keep the process alive on its own
  return intervalHandle;
}

function stopAgentWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startAgentWorker, stopAgentWorker, tick };
