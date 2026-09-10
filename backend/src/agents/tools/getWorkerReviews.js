const repository = require('../../modules/agents/repository');

function normalizedLimit(value, fallback = 25) {
  return Math.min(50, Math.max(1, Number.parseInt(value, 10) || fallback));
}

function getWorkerReviews(workerId, limit = 25) {
  return repository.workerReviews(workerId, normalizedLimit(limit));
}

module.exports = { getWorkerReviews, normalizedLimit };
