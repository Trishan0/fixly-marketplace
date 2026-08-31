const { insertNotification } = require('../modules/operations/repository');

const createNotification = async (userId, type, title, body, meta = {}) => {
  try {
    await insertNotification({ userId, type, title, body, meta });
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

module.exports = { createNotification };
