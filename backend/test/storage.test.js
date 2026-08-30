'use strict';

const { validateBlobReference } = require('../src/services/storage');

describe('Blob upload reference validation', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  test('accepts a public image owned by the authenticated user', () => {
    const url = `https://store.public.blob.vercel-storage.com/fixly/profile/${userId}/avatar-abc.jpg`;
    expect(validateBlobReference({ url, kind: 'profile', userId })).toBe(url);
  });

  test('rejects another user path', () => {
    const url = 'https://store.public.blob.vercel-storage.com/fixly/profile/another-user/avatar.jpg';
    expect(() => validateBlobReference({ url, kind: 'profile', userId })).toThrow(/does not belong/);
  });

  test('requires private storage for NIC images', () => {
    const url = `https://store.public.blob.vercel-storage.com/fixly/nic/${userId}/nic.jpg`;
    expect(() => validateBlobReference({ url, kind: 'nic', userId })).toThrow(/wrong storage access/);
  });

  test('rejects a same-type store that is not configured for the app', () => {
    const originalStoreId = process.env.PUBLIC_BLOB_STORE_ID;
    process.env.PUBLIC_BLOB_STORE_ID = 'fixly-store';
    const url = `https://other-store.public.blob.vercel-storage.com/fixly/profile/${userId}/avatar.jpg`;
    expect(() => validateBlobReference({ url, kind: 'profile', userId })).toThrow(/configured Blob store/);
    if (originalStoreId === undefined) delete process.env.PUBLIC_BLOB_STORE_ID;
    else process.env.PUBLIC_BLOB_STORE_ID = originalStoreId;
  });
});
