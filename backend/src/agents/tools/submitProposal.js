/**
 * Proposal-agent adapter. Marketplace writes belong to the same service used
 * by HTTP controllers so the workflow and its transaction cannot drift.
 */

const repository = require('../../modules/marketplace/repository');
const { MarketplaceError } = require('../../modules/marketplace/errors');
const { submitProposal: submitMarketplaceProposal } = require('../../modules/marketplace/service');

async function submitProposal(jobId, workerId, {
  message = '',
  proposed_price = null,
  inspection_needed = false,
  availability = '',
} = {}) {
  const existing = await repository.findProposalByJobAndWorker(jobId, workerId);
  if (existing) return { proposal: existing, alreadyExists: true };

  const worker = await repository.findUserSummary(workerId);
  if (!worker) throw new Error('Worker not found');

  try {
    const proposal = await submitMarketplaceProposal({
      jobId,
      worker,
      input: { message, proposed_price, inspection_needed, availability },
    });
    return { proposal, alreadyExists: false };
  } catch (error) {
    // A concurrent agent or direct request may have inserted the same proposal
    // after the initial read. Preserve the agent's idempotent response shape.
    if (error instanceof MarketplaceError && error.code === 'STATE_CONFLICT') {
      const concurrentProposal = await repository.findProposalByJobAndWorker(jobId, workerId);
      if (concurrentProposal) return { proposal: concurrentProposal, alreadyExists: true };
    }
    throw error;
  }
}

module.exports = { submitProposal };
