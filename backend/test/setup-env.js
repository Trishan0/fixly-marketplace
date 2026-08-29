'use strict';

const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'fixly-test-secret-not-for-production';
process.env.JWT_EXPIRES_IN = '15m';
process.env.CLIENT_URL = 'http://localhost.test';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'fixly-test-uploads');

if (process.env.TEST_DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    process.env.FIXLY_ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.DATABASE_URL = 'postgresql://fixly_test_unconfigured@127.0.0.1:1/fixly_test_unconfigured';
}
