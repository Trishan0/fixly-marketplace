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

const paymentInput = z.object({
  amount: decimal.optional().nullable(),
  method: z.enum(['cash', 'bank_transfer', 'other']),
  note: optionalText,
});
const reviewInput = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  feedback: optionalText,
});
const invitationInput = z.object({
  worker_id: z.string().uuid(),
  message: optionalText,
});
const inviteSelections = z.array(z.string().uuid()).min(1).superRefine((selections, context) => {
  if (new Set(selections).size !== selections.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Worker selections must be unique' });
  }
});
const proposalSelections = z.array(z.object({
  job_id: z.string().uuid(),
  proposed_price: decimal.optional().nullable(),
  inspection_needed: z.boolean().optional().default(false),
  availability: z.string().trim().max(255).optional().nullable(),
  message: optionalText,
})).min(1).superRefine((selections, context) => {
  const jobIds = selections.map(selection => selection.job_id);
  if (new Set(jobIds).size !== jobIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Job selections must be unique' });
  }
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

async function createInviteInTransaction({ jobId, customerId, workerId, message }, tx) {
  const job = await repository.findJobForUpdate(jobId, tx);
  if (!job || job.customer_id !== customerId) throw notFound('Job not found');
  if (!job.is_active || !['posted', 'proposals_received'].includes(job.status)) {
    throw conflict('Job is not accepting invites');
  }

  const worker = await repository.findWorker(workerId, tx);
  if (!worker) throw notFound('Worker not found');
  const invite = await repository.insertInvite({ jobId, customerId, workerId, message }, tx);
  if (!invite) {
    const existing = await repository.findInviteByJobAndWorker(jobId, workerId, tx);
    if (!existing) throw conflict('Unable to create invite');
    return { invite: existing, alreadyExists: true };
  }
  await repository.insertNotification({
    userId: workerId,
    type: 'new_invite',
    title: 'New Job Invite',
    body: `You have been invited to a job: ${job.title}`,
    meta: { job_id: jobId, customer_id: customerId },
  }, tx);
  return { invite, alreadyExists: false };
}

async function createInvitation({ jobId, customerId, input }) {
  const data = parse(invitationInput, input);
  try {
    return await withTransaction(
      ({ tx }) => createInviteInTransaction({
        jobId,
        customerId,
        workerId: data.worker_id,
        message: data.message,
      }, tx),
      { isolationLevel: 'serializable', maxRetries: 2 }
    );
  } catch (error) {
    translate(error);
  }
}

async function acceptInvitation({ inviteId, worker }) {
  try {
    return await withTransaction(async ({ tx }) => {
      const invite = await repository.findInviteForUpdate(inviteId, tx);
      if (!invite || invite.worker_id !== worker.id) throw notFound('Invite not found');
      if (invite.status === 'accepted') return { alreadyAccepted: true, proposal: null };
      if (invite.status !== 'pending') throw conflict('Invite already responded to');
      if (!invite.job_is_active || !['posted', 'proposals_received'].includes(invite.job_status)) {
        throw conflict('Job is not accepting proposals');
      }
      const accepted = await repository.updateInviteStatus(inviteId, 'pending', 'accepted', tx);
      if (!accepted) throw conflict('Invite already responded to');

      let proposal = await repository.findProposalByJobAndWorker(invite.job_id, worker.id, tx);
      if (!proposal) {
        proposal = await repository.insertProposal({
          jobId: invite.job_id,
          workerId: worker.id,
          proposedPrice: null,
          inspectionNeeded: false,
          availability: null,
          message: 'Accepted via invite',
        }, tx);
        if (!proposal) proposal = await repository.findProposalByJobAndWorker(invite.job_id, worker.id, tx);
        if (!proposal) throw conflict('Unable to create proposal from invite');
        await repository.markJobHasProposals(invite.job_id, tx);
      }
      await repository.insertNotification({
        userId: invite.customer_id,
        type: 'invite_accepted',
        title: 'Invite Accepted',
        body: `A worker accepted your invite for: ${invite.job_title}`,
        meta: { job_id: invite.job_id, worker_id: worker.id },
      }, tx);
      return { alreadyAccepted: false, proposal };
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function declineInvitation({ inviteId, workerId }) {
  try {
    return await withTransaction(async ({ tx }) => {
      const invite = await repository.findInviteForUpdate(inviteId, tx);
      if (!invite || invite.worker_id !== workerId) throw notFound('Invite not found');
      if (invite.status === 'declined') return invite;
      if (invite.status !== 'pending') throw conflict('Invite already responded to');
      const declined = await repository.updateInviteStatus(inviteId, 'pending', 'declined', tx);
      if (!declined) throw conflict('Invite already responded to');
      return declined;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function confirmMatchAgent({ runId, customerId, selections }) {
  const workerIds = parse(inviteSelections, selections);
  try {
    return await withTransaction(async ({ tx }) => {
      const run = await repository.findAgentRunForUpdate(runId, customerId, 'match', tx);
      if (!run) throw notFound('Agent run not found');
      if (run.status !== 'awaiting_confirmation') throw conflict('Run is not awaiting confirmation');
      const job = await repository.findJobForUpdate(run.job_id, tx);
      if (!job || job.customer_id !== customerId) throw notFound('Job not found');
      for (const workerId of workerIds) {
        const recommendation = await repository.findRecommendation(runId, 'worker', workerId, tx);
        if (!recommendation) throw badRequest('Selected worker was not recommended by this run');
      }
      const results = [];
      for (const workerId of workerIds) {
        const { invite, alreadyExists } = await createInviteInTransaction({
          jobId: run.job_id, customerId, workerId, message: null,
        }, tx);
        await repository.markRecommendationAction(runId, 'worker', workerId, 'invited', tx);
        results.push({ workerId, status: alreadyExists ? 'already_invited' : 'invited', inviteId: invite.id });
      }
      const completed = await repository.completeAgentRun(runId, tx);
      if (!completed) throw conflict('Run is not awaiting confirmation');
      return { run_id: runId, status: 'completed', results };
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function confirmProposalAgent({ runId, worker, selections }) {
  const proposals = parse(proposalSelections, selections);
  try {
    return await withTransaction(async ({ tx }) => {
      const run = await repository.findAgentRunForUpdate(runId, worker.id, 'proposal', tx);
      if (!run) throw notFound('Agent run not found');
      if (run.status !== 'awaiting_confirmation') throw conflict('Run is not awaiting confirmation');
      const persistedWorker = await repository.findWorker(worker.id, tx);
      if (!persistedWorker) throw forbidden('Only workers can confirm proposals');
      for (const proposal of proposals) {
        const recommendation = await repository.findRecommendation(runId, 'job', proposal.job_id, tx);
        if (!recommendation) throw badRequest('Selected job was not recommended by this run');
      }
      const results = [];
      for (const proposal of proposals) {
        const job = await repository.findJobForUpdate(proposal.job_id, tx);
        if (!job) throw notFound('Job not found');
        if (!job.is_active || !['posted', 'proposals_received'].includes(job.status)) {
          throw conflict('Job is not accepting proposals');
        }
        const inserted = await repository.insertProposal({
          jobId: proposal.job_id,
          workerId: worker.id,
          proposedPrice: proposal.proposed_price || null,
          inspectionNeeded: proposal.inspection_needed,
          availability: proposal.availability || null,
          message: proposal.message,
        }, tx);
        const persistedProposal = inserted || await repository.findProposalByJobAndWorker(proposal.job_id, worker.id, tx);
        if (!persistedProposal) throw conflict('Unable to submit proposal');
        if (inserted) {
          await repository.markJobHasProposals(proposal.job_id, tx);
          await repository.insertNotification({
            userId: job.customer_id,
            type: 'new_proposal',
            title: 'New Proposal Received',
            body: `${worker.full_name || persistedWorker.full_name || 'A worker'} sent a proposal for: ${job.title}`,
            meta: { job_id: proposal.job_id, worker_id: worker.id },
          }, tx);
        }
        await repository.markRecommendationAction(runId, 'job', proposal.job_id, 'proposal_submitted', tx);
        results.push({ job_id: proposal.job_id, status: inserted ? 'submitted' : 'already_proposed', proposalId: persistedProposal.id });
      }
      const completed = await repository.completeAgentRun(runId, tx);
      if (!completed) throw conflict('Run is not awaiting confirmation');
      return { run_id: runId, status: 'completed', results };
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

async function recordPayment({ jobId, customerId, input }) {
  const data = parse(paymentInput, input);
  try {
    return await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job || job.customer_id !== customerId) throw notFound('Job not found');
      if (job.status === 'payment_recorded' || job.status === 'reviewed') throw badRequest('Payment already recorded for this job');
      if (job.status !== 'completed') throw badRequest('Job must be completed first');
      const amount = data.amount || job.final_price;
      if (!amount) throw badRequest('Set the final price or enter an amount first');
      const payment = await repository.insertPayment({
        jobId,
        amount,
        method: data.method,
        note: data.note,
        recordedBy: customerId,
      }, tx);
      if (!payment) throw conflict('Payment already recorded for this job');
      const updated = await repository.updateJobStatus(jobId, 'completed', 'payment_recorded', tx);
      if (!updated) throw conflict('Job is no longer ready for payment');
      await repository.updateFinalPrice(jobId, amount, tx);
      await repository.insertNotification({
        userId: job.assigned_worker_id,
        type: 'payment_recorded',
        title: 'Payment Recorded',
        body: `Customer recorded a payment of LKR ${amount} for: ${job.title}`,
        meta: { job_id: job.id, payment_id: payment.id },
      }, tx);
      return payment;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function changePaymentState({ paymentId, workerId, targetStatus }) {
  try {
    return await withTransaction(async ({ tx }) => {
      const payment = await repository.findPaymentForUpdate(paymentId, tx);
      if (!payment) throw notFound('Payment not found');
      if (payment.assigned_worker_id !== workerId) throw forbidden('Not your payment');
      if (payment.status === targetStatus) return payment;
      if (payment.status !== 'recorded') throw conflict(`Payment is already ${payment.status}`);
      const updated = await repository.updatePaymentStatus(paymentId, targetStatus, tx);
      if (!updated) throw conflict('Payment state could not be changed');
      await repository.insertNotification({
        userId: payment.customer_id,
        type: targetStatus === 'confirmed' ? 'payment_confirmed' : 'payment_disputed',
        title: targetStatus === 'confirmed' ? 'Payment Confirmed' : 'Payment Disputed',
        body: targetStatus === 'confirmed'
          ? `Worker confirmed payment for: ${payment.job_title}`
          : `Worker has disputed the payment for: ${payment.job_title}`,
        meta: { job_id: payment.job_id, payment_id: payment.id },
      }, tx);
      return updated;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

async function createReview({ jobId, customerId, input }) {
  const data = parse(reviewInput, input);
  try {
    return await withTransaction(async ({ tx }) => {
      const job = await repository.findJobForUpdate(jobId, tx);
      if (!job || job.customer_id !== customerId) throw notFound('Job not found');
      if (job.status === 'reviewed') throw badRequest('Already reviewed this job');
      if (!['completed', 'payment_recorded'].includes(job.status)) throw badRequest('Job must be completed before reviewing');
      if (!job.assigned_worker_id) throw badRequest('No worker assigned');
      const review = await repository.insertReview({
        jobId,
        customerId,
        workerId: job.assigned_worker_id,
        rating: data.rating,
        feedback: data.feedback,
      }, tx);
      const updated = await repository.updateJobStatus(jobId, job.status, 'reviewed', tx);
      if (!updated) throw conflict('Job is no longer ready for review');
      await repository.rebuildWorkerAggregate(job.assigned_worker_id, tx);
      await repository.insertNotification({
        userId: job.assigned_worker_id,
        type: 'review_received',
        title: 'New Review',
        body: `You received a ${data.rating}-star review for: ${job.title}`,
        meta: { job_id: job.id, rating: data.rating },
      }, tx);
      return review;
    }, { isolationLevel: 'serializable', maxRetries: 2 });
  } catch (error) {
    translate(error);
  }
}

module.exports = {
  acceptProposal,
  acceptInvitation,
  cancelJob,
  confirmMatchAgent,
  confirmProposalAgent,
  createJob,
  createInvitation,
  createReview,
  declineInvitation,
  declineProposal,
  setFinalPrice,
  recordPayment,
  changePaymentState,
  submitProposal,
  updateJobWorkflowStatus,
  withdrawProposal,
};
