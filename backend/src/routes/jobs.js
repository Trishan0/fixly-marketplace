const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const { requireEmailVerified } = require("../middleware/verified");
const upload = require("../middleware/upload");
const { isBlobStorage, validateBlobReference } = require("../services/storage");
const repository = require('../modules/marketplace/repository');
const { MarketplaceError } = require('../modules/marketplace/errors');
const {
  cancelJob,
  createJob,
  setFinalPrice,
  updateJobWorkflowStatus,
} = require('../modules/marketplace/service');

async function canWorkerAccessJob(jobId, workerId) {
  const row = await repository.canWorkerAccessJob(jobId, workerId);
  return row?.is_public_job || row?.has_proposal || row?.has_invite;
}

function sendError(error, res) {
  if (error instanceof MarketplaceError) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(error);
  return res.status(500).json({ error: 'Failed' });
}

// GET /api/jobs/categories
router.get("/categories", async (req, res) => {
  try {
    res.json(await repository.listCategories());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// POST /api/jobs
router.post(
  "/",
  verifyToken,
  requireRole("customer"),
  requireEmailVerified,
  async (req, res) => {
    try {
      res.status(201).json(await createJob(req.user.id, req.body));
    } catch (err) {
      sendError(err, res);
    }
  },
);

// GET /api/jobs/feed - worker open jobs
router.get("/feed", verifyToken, requireRole("worker"), async (req, res) => {
  const { category, district } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  try {
    res.json(await repository.listJobFeed(req.user.id, { category, district, page, limit }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// PUT /api/jobs/:id/final-price
router.put(
  "/:id/final-price",
  verifyToken,
  requireRole("customer"),
  async (req, res) => {
    try {
      await setFinalPrice({ jobId: req.params.id, customerId: req.user.id, finalPrice: req.body.final_price });
      res.json({ message: "Final price updated" });
    } catch (err) {
      sendError(err, res);
    }
  },
);

// GET /api/jobs/my - customer jobs
router.get("/my", verifyToken, requireRole("customer"), async (req, res) => {
  const status = req.query.status || null;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  try {
    res.json(await repository.listCustomerJobs(req.user.id, { status, page, limit }));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/jobs/assigned - worker assigned jobs
router.get(
  "/assigned",
  verifyToken,
  requireRole("worker"),
  async (req, res) => {
    try {
      res.json(await repository.listAssignedJobs(req.user.id));
    } catch (err) {
      res.status(500).json({ error: "Failed" });
    }
  },
);

// GET /api/jobs/:id
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const job = await repository.findJobDetail(req.params.id);
    if (!job)
      return res.status(404).json({ error: "Job not found" });

    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.role === 'customer' && job.customer_id === req.user.id;
    const isAssignedWorker = req.user.role === 'worker' && job.assigned_worker_id === req.user.id;
    const isAllowedWorker =
      req.user.role === 'worker' &&
      (isAssignedWorker || await canWorkerAccessJob(job.id, req.user.id));

    if (!isAdmin && !isOwner && !isAllowedWorker) {
      return res.status(403).json({ error: 'You do not have access to this job' });
    }

    // Phone masking
    const { maskPhone, canRevealPhone } = require("../services/contactReveal");
    const reveal = canRevealPhone(job, req.user.id);
    if (!reveal) {
      job.customer_phone = maskPhone(job.customer_phone);
      job.assigned_worker_phone = maskPhone(job.assigned_worker_phone);
    }

    // Photos
    job.photos = await repository.listJobPhotos(req.params.id);

    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// PUT /api/jobs/:id/status
router.put("/:id/status", verifyToken, async (req, res) => {
  const { status } = req.body;

  try {
    await updateJobWorkflowStatus({ jobId: req.params.id, actor: req.user, status });
    res.json({ message: "Status updated", status });
  } catch (err) {
    sendError(err, res);
  }
});

// DELETE /api/jobs/:id
router.delete(
  "/:id",
  verifyToken,
  requireRole("customer"),
  async (req, res) => {
    try {
      await cancelJob({ jobId: req.params.id, customerId: req.user.id });
      res.json({ message: "Job cancelled" });
    } catch (err) {
      sendError(err, res);
    }
  },
);

// POST /api/jobs/:id/photos
router.post(
  "/:id/photos",
  verifyToken,
  requireRole("customer"),
  upload.array("photos", 6),
  async (req, res) => {
    const job = await repository.findJobById(req.params.id);
    if (!job || job.customer_id !== req.user.id)
      return res.status(404).json({ error: "Job not found" });

    let photoPaths;
    try {
      photoPaths = isBlobStorage()
        ? (req.body.photos || []).map(photo => validateBlobReference({ url: photo.url, kind: 'job', userId: req.user.id }))
        : (req.files || []).map(file => `/uploads/${file.filename}`);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    if (photoPaths.length === 0 || photoPaths.length > 6)
      return res.status(400).json({ error: "No files uploaded" });

    const inserted = [];
    for (let i = 0; i < photoPaths.length; i++) {
      inserted.push(await repository.insertJobPhoto(req.params.id, photoPaths[i], i));
    }
    res.json(inserted);
  },
);

module.exports = router;
