class MarketplaceError extends Error {
  /** @param {string} message @param {{ status?: number, code?: string, cause?: unknown }} [options] */
  constructor(message, { status = 500, code = 'MARKETPLACE_FAILURE', cause } = {}) {
    super(message, { cause });
    this.name = 'MarketplaceError';
    this.status = status;
    this.code = code;
  }
}

/** @param {string} message */
const badRequest = message => new MarketplaceError(message, { status: 400, code: 'VALIDATION_FAILED' });
/** @param {string} message */
const conflict = message => new MarketplaceError(message, { status: 409, code: 'STATE_CONFLICT' });
/** @param {string} message */
const forbidden = message => new MarketplaceError(message, { status: 403, code: 'FORBIDDEN' });
/** @param {string} message */
const notFound = message => new MarketplaceError(message, { status: 404, code: 'NOT_FOUND' });

module.exports = { MarketplaceError, badRequest, conflict, forbidden, notFound };
