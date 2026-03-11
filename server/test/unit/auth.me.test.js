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

function buildAccessToken() {
  return jwt.sign({ userId: 'user-123', type: 'access' }, config.jwtSecret, {
    expiresIn: '5m'
  });
}

describe('GET /api/auth/me', function () {
  afterEach(function () {
    User.findById = ORIGINAL_FIND_BY_ID;
  });

  it('returns login alert and push-login status fields needed by security settings', async function () {
    let findByIdCallCount = 0;

    User.findById = () => {
      findByIdCallCount += 1;

      if (findByIdCallCount === 1) {
        return {
          select: () => ({
            _id: 'user-123',
            username: 'alex',
            isSystemAccount: false,
            isDeleted: false,
            activeSessions: []
          })
        };
      }

      return {
        select: () => ({
          populate: () => ({
            lean: async () => ({
              _id: 'user-123',
              username: 'alex',
              email: 'alex@example.com',
              friends: [],
              badges: [],
              privacySettings: {},
              notificationPreferences: {},
              loginAlerts: {
                enabled: false,
                emailOnNewDevice: false,
                emailOnSuspiciousLogin: true
              },
              pushTwoFactorEnabled: true,
              preferPushTwoFactor: true,
              pushSubscription: {
                endpoint: 'https://push.example.test/subscription'
              },
              createdAt: '2024-01-01T00:00:00.000Z',
              lastActive: '2024-01-02T00:00:00.000Z'
            })
          })
        })
      };
    };

    const res = await request(buildApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${buildAccessToken()}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.loginAlerts, {
      enabled: false,
      emailOnNewDevice: false,
      emailOnSuspiciousLogin: true
    });
    assert.equal(res.body.pushTwoFactorEnabled, true);
    assert.equal(res.body.preferPushTwoFactor, true);
    assert.equal(res.body.hasPushSubscription, true);
  });
});