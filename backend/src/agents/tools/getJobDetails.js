/**
 * getJobDetails.js — Tool: fetch full job context for the match agent.
 * Uses the marketplace repository rather than route handlers or the raw pool.
 */

const repository = require('../../modules/marketplace/repository');

function getJobDetails(jobId) {
  return repository.findAgentJobDetails(jobId);
}

module.exports = { getJobDetails };
