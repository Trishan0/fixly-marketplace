'use strict';

const { withTransaction } = require('../../db/transaction');
const repository = require('./repository');
const { badRequest, forbidden, notFound } = require('../marketplace/errors');

const MAX_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a (job, worker) thread and checks the user may see it.
 * Customers name the worker; workers can only ever open their own thread.
 */
async function loadThread(user, jobId, workerId) {
  if (user.role !== 'customer' && user.role !== 'worker') throw forbidden('Only customers and workers can message');
  if (!UUID.test(jobId) || !UUID.test(workerId)) throw notFound('Conversation not found');
  if (user.role === 'worker' && workerId !== user.id) throw notFound('Conversation not found');

  const context = await repository.threadContext(jobId, workerId);
  if (!context) throw notFound('Conversation not found');
  if (user.role === 'customer' && context.customer_id !== user.id) throw notFound('Conversation not found');

  const connected = context.has_proposal || context.has_invite || context.assigned_worker_id === workerId;
  if (!connected) throw forbidden('You can message a worker once they have applied, been invited, or been hired');
  return context;
}

/** Why a thread is read-only, or null when messages can be sent. */
function blockedReason(context) {
  if (context.job_status === 'cancelled') return 'This job was cancelled, so the conversation is closed.';
  if (!context.job_is_active) return 'This job was taken down by Fixly, so the conversation is closed.';
  if (context.assigned_worker_id && context.assigned_worker_id !== context.worker_id) {
    return 'This job was given to another worker, so the conversation is closed.';
  }
  return null;
}

function describeThread(context, user) {
  const reason = blockedReason(context);
  return {
    job: { id: context.job_id, title: context.job_title, status: context.job_status },
    customer: { id: context.customer_id, full_name: context.customer_name, profile_photo: context.customer_photo },
    worker: { id: context.worker_id, full_name: context.worker_name, profile_photo: context.worker_photo },
    viewer_role: user.role,
    can_send: !reason,
    blocked_reason: reason,
  };
}

async function getThread(user, jobId, workerId) {
  const context = await loadThread(user, jobId, workerId);
  await repository.markThreadRead(jobId, workerId, user.id);
  const messages = await repository.listThreadMessages(jobId, workerId);
  return { thread: describeThread(context, user), messages };
}

async function sendMessage(user, jobId, workerId, input) {
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!body) throw badRequest('Write a message before sending');
  if (body.length > MAX_LENGTH) throw badRequest(`Messages can be up to ${MAX_LENGTH} characters`);

  const context = await loadThread(user, jobId, workerId);
  const reason = blockedReason(context);
  if (reason) throw forbidden(reason);

  const recipientId = user.role === 'customer' ? context.worker_id : context.customer_id;
  const senderName = user.role === 'customer' ? context.customer_name : context.worker_name;

  return withTransaction(async ({ tx }) => {
    const message = await repository.insertMessage({ jobId, workerId, senderId: user.id, body }, tx);
    // One notification per batch: only when the recipient had nothing unread
    // from this conversation yet.
    const unread = await repository.countUnreadForRecipient(jobId, workerId, recipientId, message.id, tx);
    if (unread.count === 0) {
      await repository.insertNotification({
        userId: recipientId,
        type: 'new_message',
        title: `New message from ${senderName}`,
        body: `${context.job_title}: ${body.length > 120 ? `${body.slice(0, 117)}…` : body}`,
        meta: { job_id: jobId, worker_id: workerId },
      }, tx);
    }
    return message;
  });
}

function listConversations(user) {
  if (user.role !== 'customer' && user.role !== 'worker') return [];
  return repository.listConversations(user.id, user.role);
}

async function unreadCount(user) {
  if (user.role !== 'customer' && user.role !== 'worker') return 0;
  return (await repository.unreadCount(user.id, user.role)).count;
}

module.exports = { getThread, listConversations, sendMessage, unreadCount };
