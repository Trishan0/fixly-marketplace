'use strict';

// Compatibility entry point for the original agent demo seed command.
const { seedDemoDatabase } = require('../../scripts/seed-demo');

if (require.main === module) {
  seedDemoDatabase().catch(error => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { seedDemoData: seedDemoDatabase };
