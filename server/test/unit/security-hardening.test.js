import express from 'express';
import { afterEach, describe, it } from 'mocha';
import request from 'supertest';
import { strict as assert } from 'assert';

import User from '../../models/User.js';
import ReflectionPrompt from '../../models/ReflectionPrompt.js';
import { generateAccessToken } from '../../utils/tokenUtils.js';

const originalUserFindById = User.findById;
const originalUserFind = User.find;
const originalReflectionPromptFind = ReflectionPrompt.find;

function buildUserQuery(id, role = 'super_admin') {
  const user = {
    _id: id,
    id,
    username: 'security-admin',
    role,
    isDeleted: false,
    isActive: true,
    isSystemAccount: false,
    activeSessions: []
  };

  return {
    ...user,
    select: async (projection) => {
      if (projection === 'role') {
        return { role };
      }

      return user;
    }
  };
}

afterEach(() => {
  User.findById = originalUserFindById;
  User.find = originalUserFind;
  ReflectionPrompt.find = originalReflectionPromptFind;
});

describe('security hardening', function() {
  it('does not publicly expose the old cookie debug endpoint payload', async function() {
    const { default: adminDebugRouter } = await import('../../routes/adminDebug.js');
    const app = express();
    app.use(express.json());
    app.use('/api/admin/debug', adminDebugRouter);

    const response = await request(app).get('/api/debug/cookies');

    assert.strictEqual(response.status, 404);
    assert.notStrictEqual(response.body?.message, 'Cookie debug info');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(response.body || {}, 'cookies'), false);
  });

  it('accepts canonical super_admin access for prompts admin routes', async function() {
    const { default: promptsRouter } = await import('../../routes/prompts.js');
    const app = express();
    app.use(express.json());
    app.use('/api/prompts', promptsRouter);

    User.findById = (id) => buildUserQuery(id, 'super_admin');

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

  it('denies moderator access to prompts admin routes', async function() {
    const { default: promptsRouter } = await import('../../routes/prompts.js');
    const app = express();
    app.use(express.json());
    app.use('/api/prompts', promptsRouter);

    User.findById = (id) => buildUserQuery(id, 'moderator');

    const response = await request(app)
      .get('/api/prompts/all')
      .set('Authorization', `Bearer ${generateAccessToken('user-123')}`);

    assert.strictEqual(response.status, 403);
    assert.match(response.body?.message || '', /admin/i);
  });

  it('denies moderator access to system prompt admin routes', async function() {
    const { default: systemPromptsRouter } = await import('../../routes/systemPrompts.js');
    const app = express();
    app.use(express.json());
    app.use('/api/system-prompts', systemPromptsRouter);

    User.findById = (id) => buildUserQuery(id, 'moderator');

    const response = await request(app)
      .get('/api/system-prompts')
      .set('Authorization', `Bearer ${generateAccessToken('user-123')}`);

    assert.strictEqual(response.status, 403);
    assert.match(response.body?.message || '', /admin/i);
  });

  it('denies moderator access to admin post surfaces', async function() {
    const { default: adminPostsRouter } = await import('../../routes/adminPosts.js');
    const app = express();
    app.use(express.json());
    app.use('/api/admin/posts', adminPostsRouter);

    User.findById = (id) => buildUserQuery(id, 'moderator');

    const response = await request(app)
      .get('/api/admin/posts/system-accounts')
      .set('Authorization', `Bearer ${generateAccessToken('user-123')}`);

    assert.strictEqual(response.status, 403);
    assert.match(response.body?.message || '', /admin/i);
  });
});