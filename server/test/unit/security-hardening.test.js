import express from 'express';
import { afterEach, describe, it } from 'mocha';
import request from 'supertest';
import { strict as assert } from 'assert';

import User from '../../models/User.js';
import ReflectionPrompt from '../../models/ReflectionPrompt.js';
import { generateAccessToken } from '../../utils/tokenUtils.js';

const originalUserFindById = User.findById;
const originalReflectionPromptFind = ReflectionPrompt.find;

afterEach(() => {
  User.findById = originalUserFindById;
  ReflectionPrompt.find = originalReflectionPromptFind;
});

describe('security hardening', function() {
  it('does not publicly expose the old cookie debug endpoint payload', async function() {
    const { app } = await import('../../server.js');
    const response = await request(app).get('/api/debug/cookies');

    assert.notStrictEqual(response.status, 200);
    assert.notStrictEqual(response.body?.message, 'Cookie debug info');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(response.body || {}, 'cookies'), false);
  });

  it('accepts canonical super_admin access for prompts admin routes', async function() {
    const { default: promptsRouter } = await import('../../routes/prompts.js');
    const app = express();
    app.use(express.json());
    app.use('/api/prompts', promptsRouter);

    User.findById = (id) => ({
      select: async (projection) => {
        if (projection === '-password') {
          return {
            _id: id,
            id,
            role: 'super_admin',
            isDeleted: false,
            isActive: true,
            isSystemAccount: false,
            activeSessions: []
          };
        }

        if (projection === 'role') {
          return { role: 'super_admin' };
        }

        throw new Error(`Unexpected projection: ${projection}`);
      }
    });

    ReflectionPrompt.find = () => ({
      sort: () => ({
        populate: async () => []
      })
    });

    const response = await request(app)
      .get('/api/prompts/all')
      .set('Authorization', `Bearer ${generateAccessToken('user-123')}`);

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, []);
  });
});