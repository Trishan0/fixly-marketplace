require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.disable('x-powered-by');

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

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
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 5MB)' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Fixly API running on port ${PORT}`);
    console.log('Uploads served at /uploads');
    console.log(`CORS allowed: ${process.env.CLIENT_URL}`);
  });
}

module.exports = app;
