require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/workers', require('./routes/workers'));

// Job routes with nested proposals/invites
const jobsRouter = require('./routes/jobs');
const proposalsRouter = require('./routes/proposals');
const invitesRouter = require('./routes/invites');
jobsRouter.use('/:jobId/proposals', proposalsRouter);
jobsRouter.use('/:jobId/invites', invitesRouter);
app.use('/api/jobs', jobsRouter);

// Proposal actions
app.use('/api/proposals', require('./routes/proposalActions'));

// Invite actions
app.use('/api/invites', require('./routes/inviteActions'));

// Payments
const paymentsRouter = require('./routes/payments');
app.use('/api', paymentsRouter);
app.use('/api/payments', paymentsRouter);

// Reviews
const reviewsRouter = require('./routes/reviews');
app.use('/api', reviewsRouter);

// Reports
app.use('/api/reports', require('./routes/reports'));

// Notifications
app.use('/api/notifications', require('./routes/notifications'));

// Admin
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 5MB)' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Fixly API running on port ${PORT}`);
  console.log(`📁 Uploads served at /uploads`);
  console.log(`🌍 CORS allowed: ${process.env.CLIENT_URL}`);
});

module.exports = app;
