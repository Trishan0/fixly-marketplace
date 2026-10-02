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
 *
 * On serverless hosts (Vercel) there is no long-lived process, so the
 * interval loop never starts. There, the route that queues a run (and the
 * status poll, as a safety net) calls processNextRun() and hands it to
 * waitUntil, so the same function keeps working after the response is sent.
 */

'use strict';

const repository = require('../modules/agents/repository');
const { executeMatchRun } = require('./matchAgent');
const { executeProposalRun } = require('./proposalAgent');
const { AgentRunCancelledError } = require('./gemini');
const { waitUntil } = require('@vercel/functions');

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
    // The user stopped it; the run is already 'cancelled'.
    if (err instanceof AgentRunCancelledError) {
      console.info(`[agent/worker] run ${run.id} (${run.agent_type}) stopped by the user`);
      return;
    }
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

/**
 * Claim and fully execute one pending run, resolving when it's done (or
 * when there was nothing to claim). The same claim as the loop, so it's
 * safe to call from several requests at once.
 * @returns {Promise<string | null>} the run id processed, if any
 */
async function processNextRun() {
  try {
    await repository.reclaimOrphanedRuns(STALE_MINUTES);
  } catch (err) {
    console.error('[agent/worker] failed to reclaim orphaned runs:', err.message);
  }
  let run;
  try {
    run = await repository.claimPendingRun(GLOBAL_CONCURRENT_RUN_CAP);
  } catch (err) {
    console.error('[agent/worker] failed to claim a pending run:', err.message);
    return null;
  }
  if (!run) return null;
  inFlight++;
  await executeRun(run);
  return run.id;
}

const isServerless = () => Boolean(process.env.VERCEL);

/**
 * Serverless only: process the next pending run in the background of the
 * current request. A no-op where the interval loop runs.
 */
function processInBackground() {
  if (!isServerless()) return;
  const work = processNextRun().catch(err => console.error('[agent/worker] background run failed:', err.message));
  try {
    waitUntil(work);
  } catch (err) {
    console.error('[agent/worker] waitUntil unavailable:', err.message);
  }
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

module.exports = { startAgentWorker, stopAgentWorker, tick, processNextRun, processInBackground };
