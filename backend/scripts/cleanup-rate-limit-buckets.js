'use strict';
const { cleanupRateLimitBuckets } = require('../src/modules/operations/repository');
cleanupRateLimitBuckets().then(rows => console.info(`Deleted ${rows.length} expired rate-limit bucket(s)`)).catch(error => { console.error(`Rate-limit cleanup failed: ${error.message}`); process.exitCode = 1; });
