import { Redis } from "@upstash/redis";
import { env } from "~/env";

// Initialize Redis client from validated environment variables
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Cache for tournament statistics
 * Uses Upstash Redis in production, falls back to in-memory Map in development
 */
const memoryCache = new Map<string, unknown>();

export const statisticsCache = {
  /**
   * Get a cached value
   */
  get: async <T>(key: string): Promise<T | null> => {
    if (redis) {
      return await redis.get<T>(key);
    }
    // Fallback to in-memory cache for development
    return (memoryCache.get(key) as T) ?? null;
  },

  /**
   * Set a cached value (no expiration for immutable data)
   */
  set: async <T>(key: string, value: T): Promise<void> => {
    if (redis) {
      // No expiration for immutable tournament data
      await redis.set(key, value);
    } else {
      // Fallback to in-memory cache for development
      memoryCache.set(key, value);
    }
  },

  /**
   * Delete a cached value
   */
  del: async (key: string): Promise<void> => {
    if (redis) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
  },

  /**
   * Clear all cached values
   */
  clear: async (): Promise<void> => {
    if (redis) {
      // Use pattern matching to clear only our keys
      const keys = await redis.keys("stats:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      memoryCache.clear();
    }
  },

  /**
   * Check if Redis is available
   */
  isRedisAvailable: (): boolean => {
    return redis !== null;
  },
};
