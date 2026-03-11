import express from 'express';
import { afterEach, describe, it } from 'mocha';
import request from 'supertest';
import { strict as assert } from 'assert';

import passkeyRouter from '../../routes/passkey.js';
import User from '../../models/User.js';

const originalFindOne = User.findOne;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set('redis', null);
  app.use('/api/passkey', passkeyRouter);
  return app;
}

afterEach(() => {
  User.findOne = originalFindOne;
});

describe('passkey login hardening', function() {
  it('requires an email before starting passkey login', async function() {
    const response = await request(buildApp())
      .post('/api/passkey/login-start')
      .send({});

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body?.code, 'EMAIL_REQUIRED');
    assert.match(response.body?.message || '', /email/i);
  });

  it('returns hasPasskeys false when the account is unknown', async function() {
    User.findOne = async () => null;

    const response = await request(buildApp())
      .post('/api/passkey/login-start')
      .send({ email: 'missing@example.com' });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { hasPasskeys: false });
  });
});