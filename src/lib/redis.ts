import type Redis from "ioredis";

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

class EmbeddedRedisStore {
  private map = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const item = this.map.get(key);
    if (!item) return null;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<"OK"> {
    this.map.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.map.delete(key) ? 1 : 0;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const existing = await this.get(key);
    const next = existing ? Number.parseInt(existing, 10) + 1 : 1;
    const oldEntry = this.map.get(key);
    this.map.set(key, {
      value: String(next),
      expiresAt: oldEntry?.expiresAt ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : null),
    });
    return next;
  }
}

export interface CacheClient {
  mode: "redis" | "embedded";
  isConnected: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  getRawRedis(): Redis | null;
}

const globalForRedis = globalThis as unknown as {
  __klCacheClientPromise?: Promise<CacheClient>;
  __klMemoryStore?: EmbeddedRedisStore;
};

function getMemoryStore(): EmbeddedRedisStore {
  if (!globalForRedis.__klMemoryStore) {
    globalForRedis.__klMemoryStore = new EmbeddedRedisStore();
  }
  return globalForRedis.__klMemoryStore;
}

async function initCacheClient(): Promise<CacheClient> {
  const memory = getMemoryStore();
  const redisUrl = process.env.REDIS_URL;
  const shouldTryRedis = Boolean(
    redisUrl &&
      (process.env.USE_EXTERNAL_REDIS === "true" || process.env.USE_BULLMQ_REDIS === "true") &&
      process.env.DISABLE_EXTERNAL_REDIS !== "true" &&
      process.env.NODE_ENV !== "test"
  );

  if (shouldTryRedis && redisUrl) {
    try {
      const { default: RedisClient } = await import("ioredis");
      const client = new RedisClient(redisUrl, {
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
      });
      client.on("error", () => {
        // Ignore unhandled error events when probing Redis availability
      });
      await client.connect();
      await client.ping();

      return {
        mode: "redis",
        isConnected: true,
        async get(key: string) {
          return client.get(key);
        },
        async set(key: string, value: string, ttlSeconds?: number) {
          if (ttlSeconds && ttlSeconds > 0) {
            await client.set(key, value, "EX", ttlSeconds);
          } else {
            await client.set(key, value);
          }
        },
        async del(key: string) {
          await client.del(key);
        },
        async incr(key: string, ttlSeconds?: number) {
          const val = await client.incr(key);
          if (val === 1 && ttlSeconds && ttlSeconds > 0) {
            await client.expire(key, ttlSeconds);
          }
          return val;
        },
        getRawRedis() {
          return client;
        },
      };
    } catch {
      // Redis is not running locally; seamlessly fall back to embedded in-process store
    }
  }

  return {
    mode: "embedded",
    isConnected: true,
    async get(key: string) {
      return memory.get(key);
    },
    async set(key: string, value: string, ttlSeconds?: number) {
      await memory.set(key, value, ttlSeconds);
    },
    async del(key: string) {
      await memory.del(key);
    },
    async incr(key: string, ttlSeconds?: number) {
      return memory.incr(key, ttlSeconds);
    },
    getRawRedis() {
      return null;
    },
  };
}

export function getCacheClient(): Promise<CacheClient> {
  if (!globalForRedis.__klCacheClientPromise) {
    globalForRedis.__klCacheClientPromise = initCacheClient();
  }
  return globalForRedis.__klCacheClientPromise;
}
