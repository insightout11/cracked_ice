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

    const writeStart = Date.now();
    await redis.set(testKey, testValue, 'EX', 60);
    const writeTime = Date.now() - writeStart;

    const readStart = Date.now();
    const retrieved = await redis.get(testKey);
    const readTime = Date.now() - readStart;

    diagnostics.readWriteTest = retrieved === testValue ? 'Success' : 'Failed';
    diagnostics.writeTimeMs = writeTime;
    diagnostics.readTimeMs = readTime;

    // Test actual user data key format
    const userTestKey = 'users:user-1767327042619-bbd0gch:roster';
    const userTestValue = JSON.stringify({ roster: [{ id: 'test', full_name: 'Test Player' }] });

    await redis.set(userTestKey, userTestValue, 'EX', 300);
    const userRetrieved = await redis.get(userTestKey);

    diagnostics.userKeyTest = userRetrieved === userTestValue ? 'Success' : 'Failed';

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
