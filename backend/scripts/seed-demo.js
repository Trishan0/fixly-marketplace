#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const WORKERS = [
  ['worker@demo.lk', 'Kasun Silva', 'Colombo', 'Nugegoda', true, 'Plumbing', 'Experienced plumber focused on repairs and bathroom installations.', 'LKR 2,000', 18, 4.8],
  ['kamal.plumber@demo.lk', 'Kamal Silva', 'Colombo', 'Nugegoda', true, 'Plumbing', 'Master plumber with 12 years of leak detection and installation experience.', 'LKR 2,500', 34, 4.9],
  ['nimal.electrician@demo.lk', 'Nimal Jayasinghe', 'Colombo', 'Maharagama', true, 'Electrical', 'Certified electrician for rewiring, DB boards and fixture installations.', 'LKR 3,000', 28, 4.85],
  ['sunil.carpenter@demo.lk', 'Sunil Fernando', 'Gampaha', 'Kelaniya', false, 'Carpentry', 'Custom furniture, door repairs and pantry cupboard craftsman.', 'LKR 4,000', 19, 4.7],
  ['ruwan.painter@demo.lk', 'Ruwan Abeysekara', 'Colombo', 'Dehiwala', true, 'Painting', 'Interior and exterior painting and waterproofing specialist.', 'LKR 2,000', 15, 4.65],
  ['chaminda.ac@demo.lk', 'Chaminda Rathnayake', 'Colombo', 'Kottawa', true, 'AC Repair', 'Inverter AC servicing, gas refilling and troubleshooting specialist.', 'LKR 3,500', 42, 4.95],
  ['dinesh.tiler@demo.lk', 'Dinesh Wickramasinghe', 'Gampaha', 'Negombo', false, 'Tiling', 'Precision ceramic and granite tile laying specialist.', 'LKR 4,500', 11, 4.5],
  ['malik.cleaner@demo.lk', 'Malik Perera', 'Kandy', 'Peradeniya', true, 'Cleaning', 'Deep cleaning, carpet shampooing and post-renovation cleanup.', 'LKR 5,000', 22, 4.8],
  ['asanka.welder@demo.lk', 'Asanka Cooray', 'Galle', 'Unawatuna', true, 'Welding', 'Gate fabrication, handrails and structural welding repairs.', 'LKR 3,000', 16, 4.75],
];

const JOBS = [
  ['Emergency Bathroom Pipe Leak & Tap Replacement', 'Water leaking heavily under the main bathroom sink. Replace two corroded taps.', 'Plumbing', 'Colombo', 'Nugegoda', 'today', 'fixed', 4500, 'posted'],
  ['Complete Living Room Wall Painting & Touch-up', 'Repaint a 20x15 ft living room. Paint will be provided.', 'Painting', 'Colombo', 'Maharagama', 'this_week', 'fixed', 12000, 'posted'],
  ['Inverter AC Servicing and Freon Gas Refill', 'Inverter AC is blowing warm air and needs cleaning and a gas-pressure check.', 'AC Repair', 'Colombo', 'Kottawa', 'tomorrow', 'fixed', 6500, 'proposals_received'],
  ['Short Circuit Repair & Main DB Box Inspection', 'Circuit breaker trips under load. Inspect wiring and repair the fault.', 'Electrical', 'Colombo', 'Dehiwala', 'today', 'ask_quotes', null, 'posted'],
  ['Custom Pantry Cupboard Door Repair', 'Realign four pantry doors and replace soft-close hinges.', 'Carpentry', 'Gampaha', 'Kelaniya', 'this_week', 'fixed', 8500, 'posted'],
  ['Full House Deep Cleaning & Sofa Shampooing', 'Post-renovation cleanup for a three-bedroom house.', 'Cleaning', 'Kandy', 'Peradeniya', 'tomorrow', 'fixed', 15000, 'posted'],
  ['Main Entrance Gate Welding & Lock Repair', 'Repair and reinforce a broken bottom gate hinge.', 'Welding', 'Galle', 'Unawatuna', 'today', 'fixed', 7000, 'posted'],
  ['Bathroom Floor Tile Replacement', 'Lay non-slip ceramic floor tiles with waterproof grout.', 'Tiling', 'Colombo', 'Boralesgamuwa', 'flexible', 'fixed', 18000, 'posted'],
  ['Install Two Ceiling Fans', 'Install and balance two ceiling fans in upstairs bedrooms.', 'Electrical', 'Colombo', 'Rajagiriya', 'tomorrow', 'fixed', 5500, 'assigned'],
  ['Repair Built-in Wardrobe Doors', 'Replace runners and realign three sliding wardrobe doors.', 'Carpentry', 'Colombo', 'Battaramulla', 'this_week', 'fixed', 9500, 'in_progress'],
  ['Clear Blocked Kitchen Drain', 'Kitchen drain was cleared and the waste pipe was resealed.', 'Plumbing', 'Colombo', 'Nawala', 'today', 'fixed', 4000, 'completed'],
  ['Repaint Front Boundary Wall', 'Cleaned, primed and repainted the front boundary wall.', 'Painting', 'Colombo', 'Mount Lavinia', 'this_week', 'fixed', 14000, 'payment_recorded'],
  ['Deep Clean Apartment Before Move-in', 'Full move-in clean for a two-bedroom apartment.', 'Cleaning', 'Colombo', 'Wellawatte', 'flexible', 'fixed', 11000, 'reviewed'],
];

function requireSeedPermission() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed production without ALLOW_DEMO_SEED=true');
  }
}

async function upsertUser(client, data) {
  const result = await client.query(
    `INSERT INTO users (
       email, password_hash, full_name, role, phone, district, area,
       is_email_verified, is_nic_verified, force_verified, dashboard_mode
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,true,$9)
     ON CONFLICT (email) DO UPDATE SET
       password_hash=EXCLUDED.password_hash, full_name=EXCLUDED.full_name,
       role=EXCLUDED.role, phone=EXCLUDED.phone, district=EXCLUDED.district,
       area=EXCLUDED.area, is_email_verified=true,
       is_nic_verified=EXCLUDED.is_nic_verified, force_verified=true,
       dashboard_mode=EXCLUDED.dashboard_mode, updated_at=NOW()
     RETURNING id`,
    [data.email, data.passwordHash, data.name, data.role, data.phone || null,
      data.district || null, data.area || null, Boolean(data.nicVerified), data.dashboardMode || 'standard']
  );
  return result.rows[0].id;
}

async function upsertWorkerProfile(client, userId, worker) {
  const result = await client.query(
    `INSERT INTO worker_profiles (user_id,bio,starting_price,primary_skill,total_jobs_done,avg_rating)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET bio=EXCLUDED.bio,
       starting_price=EXCLUDED.starting_price, primary_skill=EXCLUDED.primary_skill,
       total_jobs_done=EXCLUDED.total_jobs_done, avg_rating=EXCLUDED.avg_rating
     RETURNING id`,
    [userId, worker.bio, worker.startingPrice, worker.skill, worker.jobsDone, worker.rating]
  );
  return result.rows[0].id;
}

async function upsertJob(client, customerId, categoryId, job) {
  const existing = await client.query(
    'SELECT id FROM jobs WHERE customer_id=$1 AND title=$2 LIMIT 1',
    [customerId, job.title]
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE jobs SET description=$1, category_id=$2, district=$3, town=$4,
       urgency=$5, pricing_mode=$6, fixed_budget=$7, status=$8,
       is_active=true, updated_at=NOW() WHERE id=$9`,
      [job.description, categoryId, job.district, job.town, job.urgency,
        job.pricingMode, job.budget, job.status, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const inserted = await client.query(
    `INSERT INTO jobs (customer_id,title,description,category_id,district,town,urgency,pricing_mode,fixed_budget,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [customerId, job.title, job.description, categoryId, job.district, job.town,
      job.urgency, job.pricingMode, job.budget, job.status]
  );
  return inserted.rows[0].id;
}

async function seedDemoDatabase({ connectionString } = {}) {
  requireSeedPermission();
  const databaseUrl = connectionString || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');

  const demoPassword = process.env.DEMO_PASSWORD || 'password123';
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD
    || (process.env.NODE_ENV === 'production' ? null : 'admin123');
  if (!adminPassword) throw new Error('DEMO_ADMIN_PASSWORD is required when seeding production');

  const [passwordHash, adminPasswordHash] = await Promise.all([
    bcrypt.hash(demoPassword, 10),
    bcrypt.hash(adminPassword, 12),
  ]);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await upsertUser(client, {
      email: 'admin@fixly.lk', passwordHash: adminPasswordHash, name: 'Fixly Admin', role: 'admin',
    });
    const customerId = await upsertUser(client, {
      email: 'customer@demo.lk', passwordHash, name: 'Saman Perera', role: 'customer',
      phone: '0771234567', district: 'Colombo',
    });
    const secondCustomerId = await upsertUser(client, {
      email: 'anura@demo.lk', passwordHash, name: 'Anura Kumara', role: 'customer', district: 'Kandy',
    });

    const categories = await client.query('SELECT id, LOWER(name) AS name FROM categories');
    const categoryIds = new Map(categories.rows.map(row => [row.name, row.id]));
    const workerIds = new Map();
    for (const [email, name, district, area, nicVerified, skill, bio, startingPrice, jobsDone, rating] of WORKERS) {
      const userId = await upsertUser(client, {
        email, passwordHash, name, role: 'worker', district, area, nicVerified,
      });
      workerIds.set(email, userId);
      const profileId = await upsertWorkerProfile(client, userId, {
        skill, bio, startingPrice, jobsDone, rating,
      });
      const categoryId = categoryIds.get(skill.toLowerCase());
      if (categoryId) {
        await client.query(
          `INSERT INTO worker_skills (worker_id,category_id,is_primary)
           VALUES ($1,$2,true)
           ON CONFLICT (worker_id,category_id) DO UPDATE SET is_primary=true`,
          [profileId, categoryId]
        );
      }
    }

    const jobIds = new Map();
    for (let index = 0; index < JOBS.length; index += 1) {
      const [title, description, category, district, town, urgency, pricingMode, budget, status] = JOBS[index];
      const ownerId = index >= 4 && index <= 6 ? secondCustomerId : customerId;
      const id = await upsertJob(client, ownerId, categoryIds.get(category.toLowerCase()), {
        title, description, district, town, urgency, pricingMode, budget, status,
      });
      jobIds.set(title, id);
    }

    await client.query(
      `INSERT INTO proposals (job_id,worker_id,proposed_price,availability,message,status)
       VALUES ($1,$2,6000,'Tomorrow morning','I can inspect, service and test the unit tomorrow.','pending')
       ON CONFLICT (job_id,worker_id) DO UPDATE SET proposed_price=EXCLUDED.proposed_price,
       availability=EXCLUDED.availability, message=EXCLUDED.message, status='pending', updated_at=NOW()`,
      [jobIds.get('Inverter AC Servicing and Freon Gas Refill'), workerIds.get('chaminda.ac@demo.lk')]
    );
    await client.query(
      `INSERT INTO invites (job_id,customer_id,worker_id,message,status)
       VALUES ($1,$2,$3,'Can you help with this urgent repair?','pending')
       ON CONFLICT (job_id,worker_id) DO UPDATE SET message=EXCLUDED.message,status='pending'`,
      [jobIds.get('Emergency Bathroom Pipe Leak & Tap Replacement'), customerId, workerIds.get('worker@demo.lk')]
    );

    const lifecycleJobs = [
      ['Install Two Ceiling Fans', 'nimal.electrician@demo.lk', 5500, 'assigned'],
      ['Repair Built-in Wardrobe Doors', 'sunil.carpenter@demo.lk', 9500, 'in_progress'],
      ['Clear Blocked Kitchen Drain', 'worker@demo.lk', 4000, 'completed'],
      ['Repaint Front Boundary Wall', 'ruwan.painter@demo.lk', 14000, 'payment_recorded'],
      ['Deep Clean Apartment Before Move-in', 'malik.cleaner@demo.lk', 11000, 'reviewed'],
    ];

    for (const [title, workerEmail, price, status] of lifecycleJobs) {
      const jobId = jobIds.get(title);
      const workerId = workerIds.get(workerEmail);
      await client.query(
        `UPDATE jobs SET assigned_worker_id=$1, final_price=$2, status=$3,
         is_active=true, updated_at=NOW() WHERE id=$4`,
        [workerId, price, status, jobId]
      );
      await client.query(
        `INSERT INTO proposals (job_id,worker_id,proposed_price,availability,message,status)
         VALUES ($1,$2,$3,'As scheduled','Demo proposal accepted by the customer.','accepted')
         ON CONFLICT (job_id,worker_id) DO UPDATE SET proposed_price=EXCLUDED.proposed_price,
         availability=EXCLUDED.availability,message=EXCLUDED.message,status='accepted',updated_at=NOW()`,
        [jobId, workerId, price]
      );
    }

    for (const title of ['Repaint Front Boundary Wall', 'Deep Clean Apartment Before Move-in']) {
      const jobId = jobIds.get(title);
      const lifecycle = lifecycleJobs.find(item => item[0] === title);
      await client.query(
        `INSERT INTO payments (job_id,amount,method,note,recorded_by,worker_confirmed)
         VALUES ($1,$2,'cash','Demo payment recorded after service completion.',$3,true)
         ON CONFLICT (job_id) DO UPDATE SET amount=EXCLUDED.amount,method=EXCLUDED.method,
         note=EXCLUDED.note,recorded_by=EXCLUDED.recorded_by,worker_confirmed=true`,
        [jobId, lifecycle[2], customerId]
      );
    }

    const reviewedJobId = jobIds.get('Deep Clean Apartment Before Move-in');
    const reviewedWorkerId = workerIds.get('malik.cleaner@demo.lk');
    await client.query(
      `INSERT INTO reviews (job_id,customer_id,worker_id,rating,feedback)
       VALUES ($1,$2,$3,5,'Excellent service, punctual and very thorough.')
       ON CONFLICT (job_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,
       worker_id=EXCLUDED.worker_id,rating=EXCLUDED.rating,feedback=EXCLUDED.feedback`,
      [reviewedJobId, customerId, reviewedWorkerId]
    );

    const disputedJobId = jobIds.get('Repaint Front Boundary Wall');
    const reportedWorkerId = workerIds.get('ruwan.painter@demo.lk');
    await client.query(
      `UPDATE reports SET description='Demo report for the admin moderation queue.',
       status='open',resolved_by=null,resolution_note=null,updated_at=NOW()
       WHERE reporter_id=$1 AND reported_user_id=$2 AND job_id=$3 AND report_type='price_dispute'`,
      [customerId, reportedWorkerId, disputedJobId]
    );
    await client.query(
      `INSERT INTO reports (reporter_id,reported_user_id,job_id,report_type,description,status)
       SELECT $1,$2,$3,'price_dispute','Demo report for the admin moderation queue.','open'
       WHERE NOT EXISTS (
         SELECT 1 FROM reports WHERE reporter_id=$1 AND reported_user_id=$2
           AND job_id=$3 AND report_type='price_dispute'
       )`,
      [customerId, reportedWorkerId, disputedJobId]
    );

    await client.query('COMMIT');
    console.log('Demo seed complete: admin, 2 customers, 9 workers, 13 jobs across the full lifecycle, proposals, payment, review, invite and report.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoDatabase().catch(error => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { seedDemoDatabase, requireSeedPermission };
