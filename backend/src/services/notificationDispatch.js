const pool = require('../db');

const createNotification = async (userId, type, title, body, meta = {}) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, meta) VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, JSON.stringify(meta)]
    );
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

module.exports = { createNotification };
