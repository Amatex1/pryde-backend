export async function initRedis(config, logger) {
  const redisUrl = (process.env.REDIS_URL) || (config?.redis?.url) || (config?.redisURL) || null;
  if (!redisUrl) {
    if (logger && typeof logger.info === 'function') logger.info('Redis URL not configured; using fallback client');
    return {
      ping: async () => 'OK',
      disconnect: async () => {}
    };
  }
  try {
    // Try popular Redis clients in order
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(redisUrl);
      client.on?.('error', (err) => {
        if (logger && typeof logger.error === 'function') logger.error('Redis error', err);
      });
      return client;
    } catch (e1) {
      try {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        if (client.connect) {
          await client.connect();
        }
        return client;
      } catch (e2) {
        if (logger && typeof logger.warn === 'function') logger.warn('Redis client libraries not available; using fallback', e2);
        return {
          ping: async () => 'OK',
          disconnect: async () => {}
        };
      }
    }
  } catch (err) {
    if (logger && typeof logger.error === 'function') logger.error('Failed to initialize Redis', err);
    return {
      ping: async () => 'OK',
      disconnect: async () => {}
    };
  }
}
