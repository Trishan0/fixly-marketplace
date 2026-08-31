const { drizzle } = require('drizzle-orm/node-postgres');
const pool = require('./index');

// This is intentionally the same Pool used by legacy pg queries during the
// incremental migration. Drizzle must never create a second application pool.
const db = drizzle({ client: pool });

module.exports = { db, pool };
