/**
 * BullMQ Job Queue Infrastructure
 *
 * Queues:
 *   - email          — transactional email delivery (signup, alerts, notifications)
 *   - image-process  — sharp image resizing/conversion (WebP, AVIF, EXIF strip)
 *   - push-notify    — Firebase/web-push notification delivery
 *
 * Requires Redis. Falls back gracefully if Redis is not configured.
 *
 * Usage:
 *   import { getQueue } from './queues/index.js';
 *   await getQueue('email').add('send', { to, subject, html });
 *
 * Workers are started in server.js via startWorkers().
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import logger from '../utils/logger.js';

const QUEUE_NAMES = {
  EMAIL: 'email',
  IMAGE: 'image-process',
  PUSH: 'push-notify',
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

let connection = null;
const queues = new Map();
const workers = new Map();

/**
 * Build the ioredis-compatible connection config from environment.
 */
function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (url) return { url };

  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  if (host) return { host, port, password: process.env.REDIS_PASSWORD || undefined };

  return null;
}

/**
 * Initialise all queues. Call once on server startup (after Redis is confirmed available).
 * Returns false if Redis is not configured.
 */
export function initQueues() {
  connection = getRedisConnection();

  if (!connection) {
    logger.warn('[Queue] Redis not configured — job queues disabled');
    return false;
  }

  for (const name of Object.values(QUEUE_NAMES)) {
    queues.set(name, new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }));
  }

  logger.info('[Queue] BullMQ queues initialised', { queues: [...queues.keys()] });
  return true;
}

/**
 * Get a queue by name. Returns a no-op stub if queues are not initialised.
 */
export function getQueue(name) {
  const q = queues.get(name);
  if (!q) {
    return {
      add: async (jobName, data) => {
        logger.warn(`[Queue] Queue "${name}" not available — job "${jobName}" skipped`, data);
      },
    };
  }
  return q;
}

export { QUEUE_NAMES };

// ── Worker processors ───────────────────────────────────────────────────────

async function processEmailJob(job) {
  const { to, subject, html, text, template } = job.data;
  logger.info(`[Queue:email] Processing job ${job.id}`, { to, subject });

  // Import dynamically to avoid circular dependencies
  const { sendRawEmail } = await import('../services/emailService.js').catch(() => ({ sendRawEmail: null }));
  if (!sendRawEmail) {
    // Fall back to the utils email service
    const { sendEmail } = await import('../utils/emailService.js');
    await sendEmail({ to, subject, html, text });
  } else {
    await sendRawEmail({ to, subject, html, text });
  }
}

async function processImageJob(job) {
  const { inputPath, outputPath, options = {} } = job.data;
  logger.info(`[Queue:image] Processing job ${job.id}`, { inputPath });

  const sharp = (await import('sharp')).default;
  const { width = 1200, format = 'webp', quality = 80 } = options;

  await sharp(inputPath)
    .resize({ width, withoutEnlargement: true })
    .toFormat(format, { quality })
    .toFile(outputPath);
}

async function processPushJob(job) {
  const { userId, title, body, data } = job.data;
  logger.info(`[Queue:push] Processing job ${job.id}`, { userId });

  const { sendPushNotification } = await import('../routes/pushNotifications.js');
  await sendPushNotification(userId, { title, body, data });
}

const PROCESSORS = {
  [QUEUE_NAMES.EMAIL]: processEmailJob,
  [QUEUE_NAMES.IMAGE]: processImageJob,
  [QUEUE_NAMES.PUSH]: processPushJob,
};

/**
 * Start all workers. Call after initQueues() succeeds.
 */
export function startWorkers() {
  if (!connection) return;

  for (const [name, processor] of Object.entries(PROCESSORS)) {
    const worker = new Worker(name, processor, {
      connection,
      concurrency: name === QUEUE_NAMES.IMAGE ? 2 : 5,
    });

    worker.on('completed', (job) => {
      logger.info(`[Queue:${name}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`[Queue:${name}] Job ${job?.id} failed`, { error: err.message });
    });

    workers.set(name, worker);
  }

  logger.info('[Queue] Workers started', { workers: [...workers.keys()] });
}

/**
 * Graceful shutdown — close all workers and queues.
 */
export async function shutdownQueues() {
  for (const worker of workers.values()) {
    await worker.close();
  }
  for (const queue of queues.values()) {
    await queue.close();
  }
  logger.info('[Queue] All queues and workers shut down');
}
