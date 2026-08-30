'use strict';

const { del, get } = require('@vercel/blob');

const KINDS = new Set(['profile', 'portfolio', 'job', 'nic']);

function storageDriver() {
  return process.env.STORAGE_DRIVER || (process.env.NODE_ENV === 'production' ? 'blob' : 'local');
}

function isBlobStorage() {
  return storageDriver() === 'blob';
}

function blobCredentials(kind) {
  const variable = kind === 'nic' ? 'PRIVATE_BLOB_READ_WRITE_TOKEN' : 'BLOB_READ_WRITE_TOKEN';
  const token = process.env[variable];
  if (token) return { token };

  const storeVariable = kind === 'nic' ? 'PRIVATE_BLOB_STORE_ID' : 'PUBLIC_BLOB_STORE_ID';
  const storeId = process.env[storeVariable];
  if (storeId) return { storeId };
  throw new Error(`${variable} or ${storeVariable} is required`);
}

function configuredStoreId(kind) {
  const storeVariable = kind === 'nic' ? 'PRIVATE_BLOB_STORE_ID' : 'PUBLIC_BLOB_STORE_ID';
  if (process.env[storeVariable]) return process.env[storeVariable];
  const tokenVariable = kind === 'nic' ? 'PRIVATE_BLOB_READ_WRITE_TOKEN' : 'BLOB_READ_WRITE_TOKEN';
  return process.env[tokenVariable]?.split('_')[3] || null;
}

function validateStoreHost(parsed, kind) {
  const access = kind === 'nic' ? 'private' : 'public';
  const expectedSuffix = `.${access}.blob.vercel-storage.com`;
  if (!parsed.hostname.endsWith(expectedSuffix)) throw new Error('Upload has the wrong storage access level');
  const storeId = configuredStoreId(kind);
  if (storeId && parsed.hostname !== `${storeId}${expectedSuffix}`) {
    throw new Error('Upload is not from the configured Blob store');
  }
}

function parseBlobReference(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid upload URL');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    throw new Error('Upload URL is not from Vercel Blob');
  }
  return parsed;
}

function validateBlobReference({ url, kind, userId }) {
  if (!KINDS.has(kind)) throw new Error('Invalid upload kind');
  const parsed = parseBlobReference(url);
  validateStoreHost(parsed, kind);
  if (!decodeURIComponent(parsed.pathname).startsWith(`/fixly/${kind}/${userId}/`)) {
    throw new Error('Upload path does not belong to this user');
  }
  return url;
}

function uploadedPath({ req, kind, userId }) {
  if (isBlobStorage()) {
    if (!req.body?.url) throw new Error('Completed Blob upload URL is required');
    return validateBlobReference({ url: req.body.url, kind, userId });
  }
  if (!req.file) throw new Error('No file uploaded');
  return `/uploads/${req.file.filename}`;
}

async function deleteStoredFile(url, kind) {
  if (!url || !url.includes('.blob.vercel-storage.com')) return;
  await del(url, blobCredentials(kind));
}

async function getPrivateFile(url) {
  const parsed = parseBlobReference(url);
  validateStoreHost(parsed, 'nic');
  if (!decodeURIComponent(parsed.pathname).startsWith('/fixly/nic/')) {
    throw new Error('Invalid private file');
  }
  return get(url, { access: 'private', ...blobCredentials('nic') });
}

module.exports = {
  blobCredentials,
  deleteStoredFile,
  getPrivateFile,
  isBlobStorage,
  storageDriver,
  uploadedPath,
  validateBlobReference,
};
