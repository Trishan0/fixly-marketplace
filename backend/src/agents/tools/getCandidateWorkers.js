const repository = require('../../modules/agents/repository');
async function getCandidateWorkers({ categoryId: _categoryId, district, limit = 50 } = {}) {
  return repository.candidateWorkers(district || null, Math.min(100, Math.max(1, Number(limit) || 50)));
}
module.exports = { getCandidateWorkers };
