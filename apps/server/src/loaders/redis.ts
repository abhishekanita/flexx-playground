import { Redis } from 'ioredis';
import IORedis from 'ioredis';
import { config } from '@/config';

const redis = new Redis(config.redis.url, {
    ...(config.redis.url?.includes('aws') ? { tls: {} } : {}),
});

export const redisLoader = async (): Promise<Redis> => {
    return redis;
};

export const redisConnection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    ...(config.redis.url?.includes('aws') ? { tls: {} } : {}),
});
