class MarketplaceError extends Error {
  constructor(message, { status = 500, code = 'MARKETPLACE_FAILURE', cause } = {}) {
    super(message, { cause });
    this.name = 'MarketplaceError';
    this.status = status;
    this.code = code;
  }
}

const badRequest = message => new MarketplaceError(message, { status: 400, code: 'VALIDATION_FAILED' });
const conflict = message => new MarketplaceError(message, { status: 409, code: 'STATE_CONFLICT' });
const forbidden = message => new MarketplaceError(message, { status: 403, code: 'FORBIDDEN' });
const notFound = message => new MarketplaceError(message, { status: 404, code: 'NOT_FOUND' });

module.exports = { MarketplaceError, badRequest, conflict, forbidden, notFound };
