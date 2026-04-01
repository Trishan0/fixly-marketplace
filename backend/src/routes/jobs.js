const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { requireEmailVerified } = require("../middleware/verified");
const { createNotification } = require("../services/notificationDispatch");
const upload = require("../middleware/upload");

const VALID_TRANSITIONS = {
  posted: ["proposals_received", "cancelled"],
  proposals_received: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: ["payment_recorded"],
  payment_recorded: ["reviewed"],
};

async function canWorkerAccessJob(jobId, workerId) {
  const relation = await pool.query(
    `SELECT
        EXISTS(
          SELECT 1 FROM jobs
          WHERE id = $1
            AND is_active = true
            AND status IN ('posted', 'proposals_received')
        ) AS is_public_job,
        EXISTS(
          SELECT 1 FROM proposals
          WHERE job_id = $1 AND worker_id = $2
        ) AS has_proposal,
        EXISTS(
          SELECT 1 FROM invites
          WHERE job_id = $1 AND worker_id = $2
        ) AS has_invite`,
    [jobId, workerId]
  );

  const row = relation.rows[0];
  return row?.is_public_job || row?.has_proposal || row?.has_invite;
}

// GET /api/jobs/categories
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories WHERE is_active = true ORDER BY name",
    );
    res.json(result.rows);
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
    const {
      title,
      description,
      category_id,
      subcategory_id,
      district,
      town,
      address,
      urgency,
      pricing_mode,
      fixed_budget,
    } = req.body;
    const normalizedSubcategoryId = subcategory_id || null;
    const normalizedDistrict = district || null;
    const normalizedTown = town || null;
    const normalizedAddress = address || null;
    const normalizedUrgency = urgency || null;
    const normalizedPricingMode = pricing_mode || null;
    const normalizedFixedBudget = fixed_budget || null;

    if (!title || !category_id) {
      return res.status(400).json({ error: "Title and category required" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO jobs (customer_id, title, description, category_id, subcategory_id,
        district, town, address, urgency, pricing_mode, fixed_budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          req.user.id,
          title,
          description,
          category_id,
          normalizedSubcategoryId,
          normalizedDistrict,
          normalizedTown,
          normalizedAddress,
          normalizedUrgency,
          normalizedPricingMode,
          normalizedFixedBudget,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create job" });
    }
  },
);

// GET /api/jobs/feed - worker open jobs
router.get("/feed", verifyToken, requireRole("worker"), async (req, res) => {
  const { category, district, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [
    "j.status IN ('posted','proposals_received')",
    "j.is_active = true",
  ];
  let params = [];
  let idx = 2;

  if (category) {
    conditions.push(`c.name ILIKE $${idx}`);
    params.push(`%${category}%`);
    idx++;
  }
  if (district) {
    conditions.push(`j.district ILIKE $${idx}`);
    params.push(`%${district}%`);
    idx++;
  }

  const where = "WHERE " + conditions.join(" AND ");

  try {
    const result = await pool.query(
      `SELECT j.*, c.name as category_name, c.icon as category_icon,
              u.full_name as customer_name,
              (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) as proposal_count,
              EXISTS(
                SELECT 1 FROM proposals myp
                WHERE myp.job_id = j.id AND myp.worker_id = $1
              ) as has_my_proposal,
              (
                SELECT myp.status
                FROM proposals myp
                WHERE myp.job_id = j.id AND myp.worker_id = $1
                ORDER BY myp.created_at DESC
                LIMIT 1
              ) as my_proposal_status
       FROM jobs j
       LEFT JOIN categories c ON c.id = j.category_id
       LEFT JOIN users u ON u.id = j.customer_id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [req.user.id, ...params, parseInt(limit), offset],
    );

    res.json(result.rows);
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
    const { final_price } = req.body;

    if (!final_price || Number(final_price) <= 0) {
      return res.status(400).json({ error: "Valid final price required" });
    }

    try {
      const jobResult = await pool.query(
        "SELECT * FROM jobs WHERE id = $1 AND customer_id = $2",
        [req.params.id, req.user.id],
      );
      const job = jobResult.rows[0];
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.assigned_worker_id)
        return res.status(400).json({ error: "Assign a worker first" });
      if (job.status === "cancelled")
        return res.status(400).json({ error: "Cannot update a cancelled job" });

      await pool.query(
        "UPDATE jobs SET final_price = $1, updated_at = NOW() WHERE id = $2",
        [final_price, req.params.id],
      );

      await createNotification(
        job.assigned_worker_id,
        "payment_recorded",
        "Agreed Price Updated",
        `Customer updated the agreed price for: ${job.title}`,
        { job_id: job.id, final_price: Number(final_price) },
      );

      res.json({ message: "Final price updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed" });
    }
  },
);

// GET /api/jobs/my - customer jobs
router.get("/my", verifyToken, requireRole("customer"), async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let params = [req.user.id];
  let idx = 2;
  let statusFilter = "";

  if (status) {
    statusFilter = `AND j.status = $${idx}`;
    params.push(status);
    idx++;
  }

  try {
    const result = await pool.query(
      `SELECT j.*, c.name as category_name, c.icon as category_icon,
              u.full_name as assigned_worker_name, u.profile_photo as assigned_worker_photo,
              (SELECT COUNT(*) FROM proposals p WHERE p.job_id = j.id) as proposal_count
       FROM jobs j
       LEFT JOIN categories c ON c.id = j.category_id
       LEFT JOIN users u ON u.id = j.assigned_worker_id
       WHERE j.customer_id = $1 ${statusFilter}
       ORDER BY j.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset],
    );
    res.json(result.rows);
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
      const result = await pool.query(
        `SELECT j.*, c.name as category_name, c.icon as category_icon,
              u.full_name as customer_name
       FROM jobs j
       LEFT JOIN categories c ON c.id = j.category_id
       LEFT JOIN users u ON u.id = j.customer_id
       WHERE j.assigned_worker_id = $1 AND j.status IN ('assigned','in_progress','completed','payment_recorded','reviewed')
       ORDER BY j.updated_at DESC`,
        [req.user.id],
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed" });
    }
  },
);

// GET /api/jobs/:id
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, c.name as category_name, c.icon as category_icon,
              u.full_name as customer_name, u.phone as customer_phone,
              u.profile_photo as customer_photo,
              aw.full_name as assigned_worker_name, aw.phone as assigned_worker_phone,
              aw.profile_photo as assigned_worker_photo,
              p.id as payment_id, p.amount as payment_amount, p.method as payment_method,
              p.worker_confirmed as payment_worker_confirmed, p.disputed as payment_disputed
       FROM jobs j
       LEFT JOIN categories c ON c.id = j.category_id
       LEFT JOIN users u ON u.id = j.customer_id
       LEFT JOIN users aw ON aw.id = j.assigned_worker_id
       LEFT JOIN payments p ON p.job_id = j.id
       WHERE j.id = $1`,
      [req.params.id],
    );

    if (!result.rows[0])
      return res.status(404).json({ error: "Job not found" });

    const job = result.rows[0];

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
    const photos = await pool.query(
      "SELECT * FROM job_photos WHERE job_id = $1 ORDER BY order_idx",
      [req.params.id],
    );
    job.photos = photos.rows;

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
    const jobResult = await pool.query("SELECT * FROM jobs WHERE id = $1", [
      req.params.id,
    ]);
    const job = jobResult.rows[0];
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Workers can mark in_progress or completed
    if (req.user.role === "worker") {
      if (job.assigned_worker_id !== req.user.id) {
        return res.status(403).json({ error: "Not assigned to this job" });
      }
      if (!["in_progress", "completed"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Workers can only set in_progress or completed" });
      }
    }

    // Customers can cancel
    if (req.user.role === "customer") {
      if (job.customer_id !== req.user.id) {
        return res.status(403).json({ error: "Not your job" });
      }
      if (status !== "cancelled") {
        return res
          .status(400)
          .json({ error: "Customers can only cancel jobs" });
      }
      if (
        ["in_progress", "completed", "payment_recorded", "reviewed"].includes(
          job.status,
        )
      ) {
        return res
          .status(400)
          .json({ error: "Cannot cancel job in current state" });
      }
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[job.status] || [];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ error: `Invalid transition from ${job.status} to ${status}` });
    }

    await pool.query(
      "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id],
    );

    // Notifications
    if (status === "in_progress") {
      await createNotification(
        job.customer_id,
        "job_started",
        "Job Started",
        `Worker has started working on: ${job.title}`,
        { job_id: job.id },
      );
    } else if (status === "completed") {
      await createNotification(
        job.customer_id,
        "job_completed",
        "Job Completed",
        `Worker has completed: ${job.title}`,
        { job_id: job.id },
      );
    }

    res.json({ message: "Status updated", status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/jobs/:id
router.delete(
  "/:id",
  verifyToken,
  requireRole("customer"),
  async (req, res) => {
    try {
      const jobResult = await pool.query(
        "SELECT * FROM jobs WHERE id = $1 AND customer_id = $2",
        [req.params.id, req.user.id],
      );
      if (!jobResult.rows[0])
        return res.status(404).json({ error: "Job not found" });

      const job = jobResult.rows[0];
      if (
        ["in_progress", "completed", "payment_recorded", "reviewed"].includes(
          job.status,
        )
      ) {
        return res
          .status(400)
          .json({ error: "Cannot delete job in current state" });
      }

      await pool.query(
        "UPDATE jobs SET status = $1, is_active = false WHERE id = $2",
        ["cancelled", req.params.id],
      );
      res.json({ message: "Job cancelled" });
    } catch (err) {
      res.status(500).json({ error: "Failed" });
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
    const jobResult = await pool.query(
      "SELECT * FROM jobs WHERE id = $1 AND customer_id = $2",
      [req.params.id, req.user.id],
    );
    if (!jobResult.rows[0])
      return res.status(404).json({ error: "Job not found" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const inserted = [];
    for (let i = 0; i < req.files.length; i++) {
      const path = `/uploads/${req.files[i].filename}`;
      const r = await pool.query(
        "INSERT INTO job_photos (job_id, path, order_idx) VALUES ($1, $2, $3) RETURNING *",
        [req.params.id, path, i],
      );
      inserted.push(r.rows[0]);
    }
    res.json(inserted);
  },
);

module.exports = router;
