import { describe, it, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import authRoutes from '../../routes/auth.js';
import User from '../../models/User.js';
import config from '../../config/config.js';

const ORIGINAL_FIND_BY_ID = User.findById;
const TEST_SECRET = 'JBSWY3DPEHPK3PXP';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function buildTempToken() {
  return jwt.sign({ userId: 'user-123', requires2FA: true }, config.jwtSecret, {
    expiresIn: '10m'
  });
}

describe('POST /api/auth/verify-2fa-login', function () {
  afterEach(function () {
    User.findById = ORIGINAL_FIND_BY_ID;
  });

  it('returns Invalid 2FA code instead of a server error for bad TOTP input', async function () {
    User.findById = async () => ({
      _id: 'user-123',
      twoFactorEnabled: true,
      twoFactorSecret: TEST_SECRET,
      twoFactorBackupCodes: []
    });

    const res = await request(buildApp())
      .post('/api/auth/verify-2fa-login')
      .send({ tempToken: buildTempToken(), token: 'not-a-code' });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid 2FA code');
  });

  it('handles users missing a backup code array without crashing', async function () {
    User.findById = async () => ({
      _id: 'user-123',
      twoFactorEnabled: true,
      twoFactorSecret: TEST_SECRET,
      twoFactorBackupCodes: undefined
    });

    const res = await request(buildApp())
      .post('/api/auth/verify-2fa-login')
      .send({ tempToken: buildTempToken(), token: 'not-a-code' });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid 2FA code');
  });
});