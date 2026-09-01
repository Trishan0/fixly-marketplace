/**
 * createInvite.js — Tool: create an invite and send notification.
 * Shared marketplace command. This tool never performs persistence directly.
 */

const { createInvitation } = require('../../modules/marketplace/service');

/**
 * @param {string} jobId
 * @param {string} customerId  — the authenticated customer's user id
 * @param {string} workerId    — the target worker's user id
 * @param {string} message     — optional invite message
 * @returns {{ invite: Object, alreadyExists: boolean }}
 */
async function createInvite(jobId, customerId, workerId, message = '') {
  return createInvitation({
    jobId,
    customerId,
    input: { worker_id: workerId, message },
  });
}

module.exports = { createInvite };
