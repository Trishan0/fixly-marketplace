require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const { isBlobStorage } = require('./services/storage');

if (process.env.NODE_ENV === 'production') {
  const requiredVariables = ['CLIENT_URL', 'JWT_SECRET'];
  const missing = requiredVariables.filter(name => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  if (isBlobStorage()) {
    const publicCredentials = process.env.BLOB_READ_WRITE_TOKEN || process.env.PUBLIC_BLOB_STORE_ID;
    const privateCredentials = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || process.env.PRIVATE_BLOB_STORE_ID;
    if (!publicCredentials || !privateCredentials) {
      throw new Error('Both public and private Blob stores must be configured with store IDs or read-write tokens');
    }
    const webhookPublicKey = process.env.BLOB_WEBHOOK_PUBLIC_KEY
      || process.env.PUBLIC_BLOB_WEBHOOK_PUBLIC_KEY
      || process.env.PRIVATE_BLOB_WEBHOOK_PUBLIC_KEY;
    if (!webhookPublicKey) throw new Error('A Blob webhook public key is required for presigned uploads');
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change_in_production')) {
    throw new Error('JWT_SECRET must be a strong production secret of at least 32 characters');
  }
}

const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const localOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const productionOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(','),
].map(origin => origin?.trim()).filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === 'production' ? productionOrigins : localOrigins;

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (!isBlobStorage()) {
  app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/customers', require('./routes/customers'));

const jobsRouter = require('./routes/jobs');
const proposalsRouter = require('./routes/proposals');
const invitesRouter = require('./routes/invites');
jobsRouter.use('/:jobId/proposals', proposalsRouter);
jobsRouter.use('/:jobId/invites', invitesRouter);
app.use('/api/jobs', jobsRouter);

app.use('/api/proposals', require('./routes/proposalActions'));
app.use('/api/invites', require('./routes/inviteActions'));

const paymentsRouter = require('./routes/payments');
app.use('/api', paymentsRouter);
app.use('/api/payments', paymentsRouter);

const reviewsRouter = require('./routes/reviews');
app.use('/api', reviewsRouter);

app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/agent', require('./routes/agent'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/ready', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT to_regclass('public.rate_limit_buckets') IS NOT NULL AS schema_current"
    );
    if (!result.rows[0]?.schema_current) throw new Error('Database migrations are not current');
    res.json({ status: 'ready', database: 'connected', migrations: 'current', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Readiness check failed:', error.message);
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 5MB)' });
  }
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  const basePort = Number(process.env.PORT) || 4000;

  const startServer = (port, retriesLeft = 10) => {
    const server = app.listen(port, () => {
      console.log(`Fixly API running on port ${port}`);
      console.log('Uploads served at /uploads');
      console.log(`CORS allowed: ${process.env.CLIENT_URL}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
        console.warn(`Port ${port} is in use, trying ${port + 1}...`);
        startServer(port + 1, retriesLeft - 1);
        return;
      }

      throw err;
    });
  };

  startServer(basePort);
}

module.exports = app;
