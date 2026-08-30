'use strict';

const express = require('express');
const { Readable } = require('stream');
const { issueSignedToken } = require('@vercel/blob');
const { handleUploadPresigned } = require('@vercel/blob/client');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { blobCredentials, getPrivateFile, isBlobStorage } = require('../services/storage');

const router = express.Router();
const ALLOWED_KINDS = new Set(['profile', 'portfolio', 'job', 'nic']);
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function parseClientPayload(body) {
  const raw = body?.payload?.clientPayload;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid upload metadata');
  }
}

router.post('/token', verifyToken, async (req, res) => {
  if (!isBlobStorage()) return res.status(409).json({ error: 'Blob storage is not enabled' });

  try {
    const { kind, jobId } = parseClientPayload(req.body);
    if (!ALLOWED_KINDS.has(kind)) return res.status(400).json({ error: 'Invalid upload kind' });
    if (kind === 'portfolio' && req.user.role !== 'worker') {
      return res.status(403).json({ error: 'Worker access required' });
    }
    if (kind === 'job') {
      if (req.user.role !== 'customer' || !jobId) return res.status(403).json({ error: 'Customer job access required' });
      const job = await pool.query('SELECT id FROM jobs WHERE id=$1 AND customer_id=$2', [jobId, req.user.id]);
      if (!job.rows[0]) return res.status(404).json({ error: 'Job not found' });
    }

    const expectedPrefix = `fixly/${kind}/${req.user.id}/`;
    const maximumSizeInBytes = Number.parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;
    const webhookPublicKey = process.env.BLOB_WEBHOOK_PUBLIC_KEY
      || process.env.PUBLIC_BLOB_WEBHOOK_PUBLIC_KEY
      || process.env.PRIVATE_BLOB_WEBHOOK_PUBLIC_KEY;
    const response = await handleUploadPresigned({
      request: req,
      body: req.body,
      webhookPublicKey,
      getSignedToken: async pathname => {
        if (!pathname.startsWith(expectedPrefix)) throw new Error('Invalid upload pathname');
        const signedToken = await issueSignedToken({
          ...blobCredentials(kind),
          pathname,
          operations: ['put'],
          allowedContentTypes: IMAGE_TYPES,
          maximumSizeInBytes,
        });
        return {
          token: signedToken,
          urlOptions: {
            allowedContentTypes: IMAGE_TYPES,
            maximumSizeInBytes,
            addRandomSuffix: true,
          },
        };
      },
    });
    return res.json(response);
  } catch (error) {
    console.error('Blob upload token failed:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

router.get('/private', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await getPrivateFile(req.query.url);
    if (!result || result.statusCode !== 200) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', result.blob.contentType);
    res.setHeader('Content-Length', result.blob.size);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
