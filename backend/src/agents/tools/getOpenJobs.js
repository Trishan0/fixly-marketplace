/** Proposal-agent read adapter backed by the marketplace repository. */

const repository = require('../../modules/marketplace/repository');

function normalizedLimit(value, fallback = 30) {
  return Math.min(100, Math.max(1, Number.parseInt(value, 10) || fallback));
}

function getOpenJobs({ district, categoryId, limit = 30 } = {}) {
  return repository.listAgentOpenJobs({
    district: district || null,
    categoryId: categoryId || null,
    limit: normalizedLimit(limit),
  });
}

function getOpenJobsForWorker(workerId, { limit = 30 } = {}) {
  return repository.listAgentOpenJobsForWorker(workerId, normalizedLimit(limit));
}

module.exports = { getOpenJobs, getOpenJobsForWorker };
