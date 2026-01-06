import { createClient } from 'redis';

export async function initRedis(config, logger) {
  if (!config || !config.redis) {
    logger?.info?.('Redis not configured; using in-memory rate limiting')
    return null
  }
  try {
    const client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port
      },
      password: config.redis.password,
      connectTimeout: config.redis.connectionTimeout
    })
    await client.connect()
    logger?.info?.('Redis connected for rate limiting')
    return client
  } catch (err) {
    logger?.error?.('Redis connection failed; using in-memory rate limiting', err)
    return null
  }
}
