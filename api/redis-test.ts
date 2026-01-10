import { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redisUrl = process.env.REDIS_URL;

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    redisUrlConfigured: !!redisUrl,
    redisHost: redisUrl ? new URL(redisUrl).hostname : null,
  };

  if (!redisUrl) {
    return res.json({
      status: 'error',
      message: 'REDIS_URL environment variable not set',
      diagnostics
    });
  }

  let redis: Redis | null = null;

  try {
    diagnostics.connectionAttempt = 'Starting...';

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: true,
    });

    const connectStart = Date.now();
    await redis.connect();
    const connectTime = Date.now() - connectStart;

    diagnostics.connectionAttempt = 'Success';
    diagnostics.connectionTimeMs = connectTime;

    // Test read/write
    const testKey = 'redis-test:health-check';
    const testValue = Date.now().toString();

    await redis.set(testKey, testValue, 'EX', 60);
    const retrieved = await redis.get(testKey);

    diagnostics.readWriteTest = retrieved === testValue ? 'Success' : 'Failed';

    return res.json({
      status: 'success',
      message: 'Redis is working correctly',
      diagnostics
    });

  } catch (error: any) {
    diagnostics.connectionAttempt = 'Failed';
    diagnostics.error = error.message;
    diagnostics.errorCode = error.code;
    diagnostics.errorStack = error.stack;

    return res.json({
      status: 'error',
      message: 'Redis connection failed',
      diagnostics
    });

  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }
}
