'use strict';

const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');

describe('GET /api/health', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('returns the API health shape without starting a listener', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
    expect(response.headers['x-request-id']).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);
  });
});
