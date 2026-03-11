import { describe, it, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import authRoutes from '../../routes/auth.js';
import User from '../../models/User.js';
import config from '../../config/config.js';

const ORIGINAL_FIND_BY_ID = User.findById;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function buildPushTempToken(payload = {}) {
  return jwt.sign({ userId: 'user-123', requiresApproval: true, ...payload }, config.jwtSecret, {
    expiresIn: '5m'
  });
}

describe('POST /api/auth/verify-push-login', function () {
  afterEach(function () {
    User.findById = ORIGINAL_FIND_BY_ID;
  });

  it('requires a temporary token', async function () {
    const res = await request(buildApp())
      .post('/api/auth/verify-push-login')
      .send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Temporary token is required');
  });

  it('rejects invalid or expired temporary tokens', async function () {
    const res = await request(buildApp())
      .post('/api/auth/verify-push-login')
      .send({ tempToken: 'not-a-valid-token' });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid or expired temporary token');
  });

  it('rejects temporary tokens without the push approval marker', async function () {
    const invalidTypeToken = jwt.sign({ userId: 'user-123' }, config.jwtSecret, {
      expiresIn: '5m'
    });

    const res = await request(buildApp())
      .post('/api/auth/verify-push-login')
      .send({ tempToken: invalidTypeToken });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid token type');
  });

  it('returns not found when the approved user no longer exists', async function () {
    User.findById = async () => null;

    const res = await request(buildApp())
      .post('/api/auth/verify-push-login')
      .send({ tempToken: buildPushTempToken() });

    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'User not found');
  });
});