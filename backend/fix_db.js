const bcrypt = require('bcryptjs');
const pool = require('./src/db');

async function fix() {
  try {
    await pool.query('ALTER TABLE agent_runs ALTER COLUMN status TYPE VARCHAR(50)');
    console.log('✓ Altered agent_runs.status column to VARCHAR(50)');

    const hash = await bcrypt.hash('password123', 10);
    const res = await pool.query('UPDATE users SET password_hash = $1', [hash]);
    console.log(`✓ Updated password_hash for ${res.rowCount} users`);

    // Verify login logic
    const testUser = await pool.query('SELECT * FROM users WHERE email = $1', ['customer@demo.lk']);
    if (testUser.rows[0]) {
      const match = await bcrypt.compare('password123', testUser.rows[0].password_hash);
      console.log('✓ Test login comparison for customer@demo.lk:', match ? 'SUCCESS' : 'FAILED');
    }
  } catch (err) {
    console.error('Fix error:', err);
  } finally {
    process.exit(0);
  }
}

fix();
