const { z } = require('zod');
const { classifyDatabaseError } = require('../../db/errors');
const { withTransaction } = require('../../db/transaction');
const repository = require('./repository');
const { MarketplaceError, badRequest, conflict, forbidden, notFound } = require('./errors');

const optionalText = z.string().trim().max(10_000).optional().nullable().transform(value => value || null);
const decimal = z.union([z.string(), z.number()]).transform(value => String(value)).refine(
  value => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0,
  'must be a positive decimal amount'
);

const jobInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: optionalText,
  category_id: z.string().uuid(),
  subcategory_id: z.string().uuid().optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
  town: z.string().trim().max(100).optional().nullable(),
  address: optionalText,
  urgency: z.enum(['today', 'tomorrow', 'this_week', 'flexible']).optional().nullable(),
  pricing_mode: z.enum(['fixed', 'ask_quotes', 'inspection']).optional().nullable(),
  fixed_budget: decimal.optional().nullable(),
});

const proposalInput = z.object({
  proposed_price: decimal.optional().nullable(),
  inspection_needed: z.boolean().optional().default(false),
  availability: z.string().trim().max(255).optional().nullable(),
  message: optionalText,
});

const jobStatus = z.enum(['proposals_received', 'assigned', 'in_progress', 'completed', 'payment_recorded', 'reviewed', 'cancelled']);
const transitions = {
  posted: ['proposals_received', 'cancelled'],
  proposals_received: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: ['payment_recorded'],
  payment_recorded: ['reviewed'],
};

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(result.error.issues[0].message);
  return result.data;
}

function translate(error) {
  if (error instanceof MarketplaceError) throw error;
  const databaseError = classifyDatabaseError(error);
  if (databaseError.code === 'CONFLICT') throw conflict('A conflicting marketplace record already exists');
  if (databaseError.code === 'TRANSACTION_RETRYABLE') throw new MarketplaceError('Please retry the request', { status: 503, code: databaseError.code, cause: error });
  throw error;
}

async function createJob(customerId, input) {
  const data = parse(jobInput, input);
  try {
    return await repository.createJob({
      customerId,
      title: data.title,
      description: data.description,
      categoryId: data.category_id,
      subcategoryId: data.subcategory_id || null,
      district: data.district || null,
      town: data.town || null,
      address: data.address,
      urgency: data.urgency || null,
      pricingMode: data.pricing_mode || null,
      fixedBudget: data.fixed_budget || null,
    });
  } catch (error) {
    translate(error);
  }
}

async function submitProposal({ jobId, worker, input }) {
  const data = parse(proposalInput, input);
  try {
    return await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job) throw notFound('Job not found');
      if (!job.is_active || !['posted', 'proposals_received'].includes(job.status)) {
        throw conflict('Job is not accepting proposals');
      }

      const proposal = await repository.insertProposal({
        jobId,
        workerId: worker.id,
        proposedPrice: data.proposed_price || null,
        inspectionNeeded: data.inspection_needed,
        availability: data.availability || null,
        message: data.message,
      }, tx);
      if (!proposal) {
        const existing = await repository.findProposalByJobAndWorker(jobId, worker.id, tx);
        throw conflict(existing ? 'Already submitted a proposal for this job' : 'Unable to submit proposal');
      }

      await repository.markJobHasProposals(jobId, tx);
      await repository.insertNotification({
        userId: job.customer_id,
        type: 'new_proposal',
        title: 'New Proposal Received',
        body: `${worker.full_name || 'A worker'} sent a proposal for: ${job.title}`,
        meta: { job_id: jobId, worker_id: worker.id },
      }, tx);
      return proposal;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function acceptProposal({ proposalId, customerId }) {
  try {
    await withTransaction(async ({ tx }) => {
      const proposal = await repository.findProposalForUpdate(proposalId, tx);
      if (!proposal) throw notFound('Proposal not found');
      if (proposal.customer_id !== customerId) throw forbidden('Not your job');
      if (!proposal.job_is_active || !['posted', 'proposals_received'].includes(proposal.job_status)) {
        throw conflict('Job is not accepting proposals');
      }
      if (proposal.status !== 'pending') throw conflict('Proposal is not pending');

      const accepted = await repository.acceptProposal(proposalId, tx);
      if (!accepted) throw conflict('Proposal is not pending');
      await repository.declinePendingProposals(proposal.job_id, proposalId, tx);
      const job = await repository.assignJob(proposal.job_id, proposal.worker_id, tx);
      if (!job) throw conflict('Job is no longer accepting proposals');
      await repository.insertNotification({
        userId: proposal.worker_id,
        type: 'proposal_accepted',
        title: 'Proposal Accepted!',
        body: `Your proposal for "${proposal.job_title}" was accepted!`,
        meta: { job_id: proposal.job_id },
      }, tx);
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function declineProposal({ proposalId, customerId }) {
  try {
    await withTransaction(async ({ tx }) => {
      const proposal = await repository.findProposalForUpdate(proposalId, tx);
      if (!proposal) throw notFound('Proposal not found');
      if (proposal.customer_id !== customerId) throw forbidden('Not your job');
      if (proposal.status !== 'pending') throw conflict('Proposal is not pending');
      const declined = await repository.setProposalStatus(proposalId, 'pending', 'declined', tx);
      if (!declined) throw conflict('Proposal is not pending');
      await repository.insertNotification({
        userId: proposal.worker_id,
        type: 'proposal_declined',
        title: 'Proposal Declined',
        body: `Your proposal for "${proposal.job_title}" was declined.`,
        meta: { job_id: proposal.job_id },
      }, tx);
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function withdrawProposal({ proposalId, workerId }) {
  try {
    await withTransaction(async ({ tx }) => {
      const proposal = await repository.findProposalForUpdate(proposalId, tx);
      if (!proposal || proposal.worker_id !== workerId) throw notFound('Proposal not found');
      if (proposal.status !== 'pending') throw conflict('Only pending proposals can be withdrawn');
      const withdrawn = await repository.setProposalStatus(proposalId, 'pending', 'withdrawn', tx);
      if (!withdrawn) throw conflict('Only pending proposals can be withdrawn');
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function updateJobWorkflowStatus({ jobId, actor, status }) {
  const nextStatus = parse(jobStatus, status);
  try {
    return await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job) throw notFound('Job not found');

      if (actor.role === 'worker') {
        if (job.assigned_worker_id !== actor.id) throw forbidden('Not assigned to this job');
        if (!['in_progress', 'completed'].includes(nextStatus)) throw badRequest('Workers can only set in_progress or completed');
      } else if (actor.role === 'customer') {
        if (job.customer_id !== actor.id) throw forbidden('Not your job');
        if (nextStatus !== 'cancelled') throw badRequest('Customers can only cancel jobs');
        if (['in_progress', 'completed', 'payment_recorded', 'reviewed'].includes(job.status)) {
          throw conflict('Cannot cancel job in current state');
        }
      } else {
        throw forbidden('Insufficient permissions');
      }

      if (!transitions[job.status]?.includes(nextStatus)) {
        throw conflict(`Invalid transition from ${job.status} to ${nextStatus}`);
      }
      const updated = await repository.updateJobStatus(jobId, job.status, nextStatus, tx);
      if (!updated) throw conflict(`Invalid transition from ${job.status} to ${nextStatus}`);

      if (nextStatus === 'in_progress' || nextStatus === 'completed') {
        await repository.insertNotification({
          userId: job.customer_id,
          type: nextStatus === 'in_progress' ? 'job_started' : 'job_completed',
          title: nextStatus === 'in_progress' ? 'Job Started' : 'Job Completed',
          body: nextStatus === 'in_progress'
            ? `Worker has started working on: ${job.title}`
            : `Worker has completed: ${job.title}`,
          meta: { job_id: job.id },
        }, tx);
      }
      return updated;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function setFinalPrice({ jobId, customerId, finalPrice }) {
  const amount = parse(decimal, finalPrice);
  try {
    await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job || job.customer_id !== customerId) throw notFound('Job not found');
      if (!job.assigned_worker_id) throw badRequest('Assign a worker first');
      if (job.status === 'cancelled') throw conflict('Cannot update a cancelled job');
      await repository.updateFinalPrice(jobId, amount, tx);
      await repository.insertNotification({
        userId: job.assigned_worker_id,
        type: 'payment_recorded',
        title: 'Agreed Price Updated',
        body: `Customer updated the agreed price for: ${job.title}`,
        meta: { job_id: job.id, final_price: amount },
      }, tx);
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function cancelJob({ jobId, customerId }) {
  try {
    await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job || job.customer_id !== customerId) throw notFound('Job not found');
      if (['in_progress', 'completed', 'payment_recorded', 'reviewed'].includes(job.status)) {
        throw conflict('Cannot delete job in current state');
      }
      await repository.cancelJob(jobId, tx);
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

module.exports = {
  acceptProposal,
  cancelJob,
  createJob,
  declineProposal,
  setFinalPrice,
  submitProposal,
  updateJobWorkflowStatus,
  withdrawProposal,
};
