#!/usr/bin/env node
/**
 * Fixly Database Setup Script
 * Run: node setup-db.js
 */
require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function setup() {
  console.log('🔧 Setting up Fixly database...\n')

  try {
    // Run migration
    const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrations/001_initial.sql'), 'utf8')
    await pool.query(sql)
    console.log('✅ Schema created')

    // Seed admin user
    const hash = await bcrypt.hash('admin123', 10)
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, is_email_verified, force_verified)
      VALUES ('admin@fixly.lk', $1, 'Fixly Admin', 'admin', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [hash])
    console.log('✅ Admin user created (admin@fixly.lk / admin123)')

    // Seed demo customer
    const custHash = await bcrypt.hash('demo123', 10)
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, phone, district, is_email_verified, force_verified)
      VALUES ('customer@demo.lk', $1, 'Saman Perera', 'customer', '0771234567', 'Colombo', true, true)
      ON CONFLICT (email) DO NOTHING
    `, [custHash])
    console.log('✅ Demo customer (customer@demo.lk / demo123)')

    // Seed demo worker
    const workerHash = await bcrypt.hash('demo123', 10)
    const workerRes = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, phone, district, is_email_verified, force_verified, is_nic_verified)
      VALUES ('worker@demo.lk', $1, 'Kasun Silva', 'worker', '0779876543', 'Colombo', true, true, true)
      ON CONFLICT (email) DO NOTHING RETURNING id
    `, [workerHash])

    if (workerRes.rows[0]) {
      const workerId = workerRes.rows[0].id
      const wpRes = await pool.query(`
        INSERT INTO worker_profiles (user_id, bio, starting_price, primary_skill)
        VALUES ($1, 'Experienced plumber with 10+ years in Colombo. Specializing in pipe repairs and bathroom installations.', 'LKR 2,000', 'Plumbing')
        ON CONFLICT (user_id) DO NOTHING RETURNING id
      `, [workerId])

      if (wpRes.rows[0]) {
        const catRes = await pool.query(`SELECT id FROM categories WHERE name = 'Plumbing'`)
        if (catRes.rows[0]) {
          await pool.query(`
            INSERT INTO worker_skills (worker_id, category_id, is_primary) VALUES ($1, $2, true)
            ON CONFLICT DO NOTHING
          `, [wpRes.rows[0].id, catRes.rows[0].id])
        }
      }
    }
    console.log('✅ Demo worker (worker@demo.lk / demo123)')

    console.log('\n🎉 Database setup complete!')
    console.log('\n📋 Demo accounts:')
    console.log('   Admin:    admin@fixly.lk / admin123')
    console.log('   Customer: customer@demo.lk / demo123')
    console.log('   Worker:   worker@demo.lk / demo123')
  } catch (err) {
    console.error('❌ Setup failed:', err.message)
    if (err.detail) console.error('   Detail:', err.detail)
  } finally {
    await pool.end()
  }
}

setup()
