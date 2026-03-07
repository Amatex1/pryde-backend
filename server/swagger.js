/**
 * OpenAPI 3.0 specification and Swagger UI setup.
 *
 * Served at:
 *   GET /api/docs        — interactive Swagger UI
 *   GET /api/docs.json   — raw OpenAPI JSON
 *
 * To add documentation to a route, add JSDoc with @openapi tags:
 *
 * @openapi
 * /posts:
 *   get:
 *     tags: [Posts]
 *     summary: Get feed posts
 *     ...
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pryde Social API',
      version: '1.0.0',
      description: 'REST API for the Pryde Social LGBTQ+ platform.',
      contact: { email: 'api@prydeapp.com' },
    },
    servers: [
      { url: 'https://api.prydeapp.com/api', description: 'Production' },
      { url: 'http://localhost:9000/api', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            username: { type: 'string' },
            displayName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            avatar: { type: 'string' },
            bio: { type: 'string' },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            author: { $ref: '#/components/schemas/User' },
            content: { type: 'string' },
            media: { type: 'array', items: { type: 'string' } },
            reactions: { type: 'object' },
            commentCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            type: { type: 'string', enum: ['like', 'comment', 'follow', 'mention', 'group'] },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and account management' },
      { name: 'Posts', description: 'Create, read, update, delete posts' },
      { name: 'Feed', description: 'Personalised and public feed' },
      { name: 'Users', description: 'User profiles and social graph' },
      { name: 'Notifications', description: 'In-app notification management' },
      { name: 'Comments', description: 'Post comments and replies' },
      { name: 'Groups', description: 'Community groups' },
      { name: 'Messages', description: 'Direct messaging' },
    ],
    // Inline path documentation for key routes
    paths: {
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in with email and password',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 12 },
                    captchaToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Login successful, returns access token and user' },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            429: { description: 'Too many login attempts' },
          },
        },
      },
      '/auth/signup': {
        post: {
          tags: ['Auth'],
          summary: 'Create a new account',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'email', 'password'],
                  properties: {
                    username: { type: 'string', minLength: 3 },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 12 },
                    captchaToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Account created successfully' },
            409: { description: 'Username or email already taken' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Log out and invalidate refresh token',
          responses: { 200: { description: 'Logged out' } },
        },
      },
      '/feed': {
        get: {
          tags: ['Feed'],
          summary: 'Get personalised feed',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
          ],
          responses: {
            200: {
              description: 'Array of posts',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
                },
              },
            },
          },
        },
      },
      '/posts': {
        post: {
          tags: ['Posts'],
          summary: 'Create a new post',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string', maxLength: 5000 },
                    media: { type: 'array', items: { type: 'string' } },
                    visibility: { type: 'string', enum: ['public', 'followers', 'private'] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Post created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } } },
          },
        },
      },
      '/posts/{id}': {
        get: {
          tags: ['Posts'],
          summary: 'Get a single post by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Post', content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } } },
            404: { description: 'Not found' },
          },
        },
        delete: {
          tags: ['Posts'],
          summary: 'Delete a post (author or admin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Post deleted' },
            403: { description: 'Forbidden' },
            404: { description: 'Not found' },
          },
        },
      },
      '/users/{username}': {
        get: {
          tags: ['Users'],
          summary: 'Get a user profile by username',
          parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            404: { description: 'User not found' },
          },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get notifications for the authenticated user',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            200: {
              description: 'Notifications list',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
                },
              },
            },
          },
        },
      },
    },
  },
  // Also pick up @openapi JSDoc tags from route files
  apis: ['./routes/*.js'],
};

const spec = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  // Only expose docs in non-production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER_DOCS !== 'true') {
    return;
  }
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: 'Pryde Social API Docs',
    swaggerOptions: { persistAuthorization: true },
  }));
  app.get('/api/docs.json', (req, res) => res.json(spec));
};
