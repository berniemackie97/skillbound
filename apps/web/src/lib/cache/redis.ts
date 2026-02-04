import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

const redisUrl = process.env['UPSTASH_REDIS_REST_URL'];
const redisToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

if (redisUrl && redisToken) {
  redisClient = new Redis({ url: redisUrl, token: redisToken });
}

export function getRedisClient(): Redis | null {
  return redisClient;
}
