'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');

/** @typedef {{ requestId?: string, databaseOperation?: string }} RequestContext */
/** @type {AsyncLocalStorage<RequestContext>} */
const storage = new AsyncLocalStorage();
const requestIdPattern = /^[a-zA-Z0-9_-]{8,128}$/;

/** @returns {import('express').RequestHandler} */
function requestContext() {
  return (req, res, next) => {
    const suppliedId = req.get('x-request-id');
    const requestId = suppliedId && requestIdPattern.test(suppliedId) ? suppliedId : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    storage.run({ requestId }, next);
  };
}

/** @returns {RequestContext} */
function currentContext() {
  return storage.getStore() || {};
}

/** @template T @param {string} operation @param {() => T} work @returns {T} */
function withDatabaseOperation(operation, work) {
  if (typeof operation !== 'string' || !/^[a-z][a-z0-9_.-]{2,127}$/.test(operation)) {
    throw new TypeError('Database operation must be a lowercase dotted identifier');
  }
  if (typeof work !== 'function') throw new TypeError('withDatabaseOperation requires a callback');
  return storage.run({ ...currentContext(), databaseOperation: operation }, work);
}

/**
 * @param {string} owner
 * @param {Record<string, (...args: any[]) => any>} repository
 * @returns {Record<string, (...args: any[]) => any>}
 */
function instrumentRepository(owner, repository) {
  const normalizedOwner = owner.toLowerCase();
  return Object.fromEntries(Object.entries(repository).map(([name, operation]) => [name,
    /** @param {...any} args */ (...args) => withDatabaseOperation(
      `${normalizedOwner}.${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
      () => operation(...args),
    ),
  ]));
}

module.exports = { currentContext, instrumentRepository, requestContext, withDatabaseOperation };
