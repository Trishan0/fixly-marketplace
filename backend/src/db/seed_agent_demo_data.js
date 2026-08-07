/**
 * seed_agent_demo_data.js — Populates rich demo data for testing Match Agent & Proposal Agent.
 *
 * Adds:
 *  - 8 diverse workers with worker profiles & skills across Colombo, Gampaha, Kandy, Galle
 *  - 8 open jobs in various categories, urgencies, and districts for customer@demo.lk and others
 */

const pool = require('../db');
const bcrypt = require('bcryptjs');

async function seedDemoData() {
  console.log('🌱 Seeding rich AI Agent demo data...');
  const PASSWORD_HASH = await bcrypt.hash('password123', 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch category map
    const catRes = await client.query('SELECT id, name FROM categories');
    const catMap = {};
    for (const row of catRes.rows) {
      catMap[row.name.toLowerCase()] = row.id;
    }

    // 2. Fetch demo customer (customer@demo.lk)
    const custRes = await client.query("SELECT id FROM users WHERE email = 'customer@demo.lk'");
    let customerId;
    if (custRes.rows.length > 0) {
      customerId = custRes.rows[0].id;
    } else {
      const newCust = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, district, is_email_verified, force_verified)
        VALUES ('customer@demo.lk', $1, 'Saman Perera', 'customer', 'Colombo', true, true)
        RETURNING id
      `, [PASSWORD_HASH]);
      customerId = newCust.rows[0].id;
    }

    // Additional customer for job diversity
    const extraCust = await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, district, is_email_verified, force_verified)
      VALUES ('anura@demo.lk', $1, 'Anura Kumara', 'customer', 'Kandy', true, true)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    `, [PASSWORD_HASH]);
    const extraCustomerId = extraCust.rows[0].id;

    // 3. Workers to insert
    const workersData = [
      {
        email: 'kamal.plumber@demo.lk',
        name: 'Kamal Silva',
        district: 'Colombo',
        area: 'Nugegoda',
        nic_verified: true,
        skill: 'Plumbing',
        catKey: 'plumbing',
        bio: 'Master Plumber with 12 years of experience. Leak detection, pipe installation, and bathroom fitting specialist.',
        startingPrice: 'LKR 2,500',
        jobsDone: 34,
        rating: 4.90,
      },
      {
        email: 'nimal.electrician@demo.lk',
        name: 'Nimal Jayasinghe',
        district: 'Colombo',
        area: 'Maharagama',
        nic_verified: true,
        skill: 'Electrical',
        catKey: 'electrical',
        bio: 'Certified electrician specializing in home rewiring, DB board upgrades, and LED fixture installations.',
        startingPrice: 'LKR 3,000',
        jobsDone: 28,
        rating: 4.85,
      },
      {
        email: 'sunil.carpenter@demo.lk',
        name: 'Sunil Fernando',
        district: 'Gampaha',
        area: 'Kelaniya',
        nic_verified: false,
        skill: 'Carpentry',
        catKey: 'carpentry',
        bio: 'Custom furniture, door fixing, wooden roof repairs, and pantry cupboard craftsman.',
        startingPrice: 'LKR 4,000',
        jobsDone: 19,
        rating: 4.70,
      },
      {
        email: 'ruwan.painter@demo.lk',
        name: 'Ruwan Abeysekara',
        district: 'Colombo',
        area: 'Dehiwala',
        nic_verified: true,
        skill: 'Painting',
        catKey: 'painting',
        bio: 'Interior & exterior house painter. Waterproofing, weather seal treatment, and decorative wall finishes.',
        startingPrice: 'LKR 2,000',
        jobsDone: 15,
        rating: 4.65,
      },
      {
        email: 'chaminda.ac@demo.lk',
        name: 'Chaminda Rathnayake',
        district: 'Colombo',
        area: 'Kottawa',
        nic_verified: true,
        skill: 'AC Repair',
        catKey: 'ac repair',
        bio: 'HVAC & Inverter AC specialist. Full servicing, gas refilling, and PCB board troubleshooting.',
        startingPrice: 'LKR 3,500',
        jobsDone: 42,
        rating: 4.95,
      },
      {
        email: 'dinesh.tiler@demo.lk',
        name: 'Dinesh Wickramasinghe',
        district: 'Gampaha',
        area: 'Negombo',
        nic_verified: false,
        skill: 'Tiling',
        catKey: 'tiling',
        bio: 'Precision ceramic & granite tile laying for bathrooms, kitchens, and living room floors.',
        startingPrice: 'LKR 4,500',
        jobsDone: 11,
        rating: 4.50,
      },
      {
        email: 'malik.cleaner@demo.lk',
        name: 'Malik Perera',
        district: 'Kandy',
        area: 'Peradeniya',
        nic_verified: true,
        skill: 'Cleaning',
        catKey: 'cleaning',
        bio: 'Deep home cleaning, carpet shampooing, sofa cleaning, and post-renovation cleanup service.',
        startingPrice: 'LKR 5,000',
        jobsDone: 22,
        rating: 4.80,
      },
      {
        email: 'asanka.welder@demo.lk',
        name: 'Asanka Cooray',
        district: 'Galle',
        area: 'Unawatuna',
        nic_verified: true,
        skill: 'Welding',
        catKey: 'welding',
        bio: 'Iron gate fabrication, stainless steel handrails, and structural steel welding repairs.',
        startingPrice: 'LKR 3,000',
        jobsDone: 16,
        rating: 4.75,
      },
    ];

    for (const w of workersData) {
      // Create user
      const userRes = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, district, area, is_email_verified, is_nic_verified, force_verified)
        VALUES ($1, $2, $3, 'worker', $4, $5, true, $6, true)
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          district = EXCLUDED.district,
          area = EXCLUDED.area,
          is_nic_verified = EXCLUDED.is_nic_verified
        RETURNING id
      `, [w.email, PASSWORD_HASH, w.name, w.district, w.area, w.nic_verified]);
      const userId = userRes.rows[0].id;

      // Create worker profile
      const profRes = await client.query(`
        INSERT INTO worker_profiles (user_id, bio, starting_price, primary_skill, total_jobs_done, avg_rating)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          bio = EXCLUDED.bio,
          starting_price = EXCLUDED.starting_price,
          primary_skill = EXCLUDED.primary_skill,
          total_jobs_done = EXCLUDED.total_jobs_done,
          avg_rating = EXCLUDED.avg_rating
        RETURNING id
      `, [userId, w.bio, w.startingPrice, w.skill, w.jobsDone, w.rating]);
      const profileId = profRes.rows[0].id;

      // Link skill category
      const catId = catMap[w.catKey];
      if (catId) {
        await client.query(`
          INSERT INTO worker_skills (worker_id, category_id, is_primary)
          VALUES ($1, $2, true)
          ON CONFLICT DO NOTHING
        `, [profileId, catId]);
      }
    }

    // 4. Open Jobs to insert (for Match Agent on Customer side & Proposal Agent on Worker side)
    const openJobsData = [
      {
        customer_id: customerId,
        title: 'Emergency Bathroom Pipe Leak & Tap Replacement',
        description: 'Water leaking heavily under the main bathroom sink in Nugegoda. Need an experienced plumber urgently today to fix the leak and replace 2 corroded brass taps.',
        catKey: 'plumbing',
        district: 'Colombo',
        town: 'Nugegoda',
        address: 'No. 45, Chapel Road, Nugegoda',
        urgency: 'today',
        pricing_mode: 'fixed',
        fixed_budget: 4500.00,
        status: 'posted',
      },
      {
        customer_id: customerId,
        title: 'Complete Living Room Wall Painting & Touch-up',
        description: 'Looking for a reliable painter to repaint a 20x15 ft living room walls with Dulux WeatherShield. Paint provided by me.',
        catKey: 'painting',
        district: 'Colombo',
        town: 'Maharagama',
        address: 'High Level Road, Maharagama',
        urgency: 'this_week',
        pricing_mode: 'fixed',
        fixed_budget: 12000.00,
        status: 'posted',
      },
      {
        customer_id: customerId,
        title: 'Inverter AC Servicing and Freon Gas Refill',
        description: 'Panasonic 12,000 BTU Inverter AC unit is blowing warm air in Master Bedroom. Needs chemical cleaning and gas pressure check.',
        catKey: 'ac repair',
        district: 'Colombo',
        town: 'Kottawa',
        address: 'Pannipitiya Road, Kottawa',
        urgency: 'tomorrow',
        pricing_mode: 'fixed',
        fixed_budget: 6500.00,
        status: 'proposals_received',
      },
      {
        customer_id: customerId,
        title: 'Short Circuit Repair & Main DB Box Circuit Inspection',
        description: 'Circuit breaker trips constantly when microwave or iron is turned on. Need a certified electrician to check wire load and fix.',
        catKey: 'electrical',
        district: 'Colombo',
        town: 'Dehiwala',
        address: 'Galle Road, Dehiwala',
        urgency: 'today',
        pricing_mode: 'ask_quotes',
        fixed_budget: null,
        status: 'posted',
      },
      {
        customer_id: extraCustomerId,
        title: 'Custom Teak Wood Pantry Cupboard Door Repair',
        description: 'Hinges on 4 kitchen pantry doors are loose and sagging. Need a skilled carpenter to re-align doors and replace soft-close hinges.',
        catKey: 'carpentry',
        district: 'Gampaha',
        town: 'Kelaniya',
        address: 'Biyagama Road, Kelaniya',
        urgency: 'this_week',
        pricing_mode: 'fixed',
        fixed_budget: 8500.00,
        status: 'posted',
      },
      {
        customer_id: extraCustomerId,
        title: 'Full House Deep Cleaning & Sofa Shampooing',
        description: 'Post-renovation cleanup needed for a 3-bedroom house in Kandy. Dust removal, floor scrubbing, and fabric sofa steam clean.',
        catKey: 'cleaning',
        district: 'Kandy',
        town: 'Peradeniya',
        address: 'Peradeniya Road, Kandy',
        urgency: 'tomorrow',
        pricing_mode: 'fixed',
        fixed_budget: 15000.00,
        status: 'posted',
      },
      {
        customer_id: extraCustomerId,
        title: 'Main Entrance Steel Gate Hinge Welding & Lock Repair',
        description: 'Bottom hinge on heavy wrought iron gate snapped off. Needs portable arc welding machine on-site to repair and reinforce.',
        catKey: 'welding',
        district: 'Galle',
        town: 'Unawatuna',
        address: 'Matara Road, Unawatuna',
        urgency: 'today',
        pricing_mode: 'fixed',
        fixed_budget: 7000.00,
        status: 'posted',
      },
      {
        customer_id: customerId,
        title: 'Bathroom Floor Tile Replacement (10x8 ft)',
        description: 'Old bathroom tiles removed; need new non-slip ceramic floor tiles laid with waterproof grout in Colombo house.',
        catKey: 'tiling',
        district: 'Colombo',
        town: 'Boralesgamuwa',
        address: '1st Lane, Boralesgamuwa',
        urgency: 'flexible',
        pricing_mode: 'fixed',
        fixed_budget: 18000.00,
        status: 'posted',
      },
    ];

    for (const j of openJobsData) {
      const catId = catMap[j.catKey];
      await client.query(`
        INSERT INTO jobs (customer_id, title, description, category_id, district, town, address, urgency, pricing_mode, fixed_budget, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [j.customer_id, j.title, j.description, catId, j.district, j.town, j.address, j.urgency, j.pricing_mode, j.fixed_budget, j.status]);
    }

    await client.query('COMMIT');
    console.log('✅ Demo data successfully seeded!');
    console.log('   - Added 8 workers across Colombo, Gampaha, Kandy, Galle with ratings & skills');
    console.log('   - Added 8 open jobs for testing Match Agent & Proposal Agent');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding demo data:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDemoData().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seedDemoData };
