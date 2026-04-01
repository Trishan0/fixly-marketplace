const crypto = require('crypto');

const TOKEN_BYTES = 32;

function createRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function expiresInHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = {
  createRawToken,
  hashToken,
  expiresInHours,
};
