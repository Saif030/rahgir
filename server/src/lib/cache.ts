// Cache with optional Redis. Falls back to in-memory Map when REDIS_URL is unset
// (local dev without Docker). API-compatible subset used by the app.
type Entry = { value: string; expiresAt: number };

const mem = new Map<string, Entry>();

let redis: {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, mode?: string, ttl?: number): Promise<void>;
  del(k: string): Promise<void>;
} | null = null;

async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;
  try {
    const mod = await import("redis").catch(() => null);
    if (!mod) return;
    const client = mod.createClient({ url });
    client.on("error", () => {});
    await client.connect();
    redis = {
      get: (k) => client.get(k),
      set: async (k, v, _mode, ttl) => {
        if (ttl) await client.setEx(k, ttl, v);
        else await client.set(k, v);
      },
      del: async (k) => {
        await client.del(k);
      },
    };
    console.log("[cache] Redis connected");
  } catch {
    console.warn("[cache] Redis unavailable, using in-memory cache");
  }
}

void initRedis();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (redis) {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const e = mem.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      mem.delete(key);
      return null;
    }
    return JSON.parse(e.value) as T;
  },
  async set(key: string, value: unknown, ttlSec = 300): Promise<void> {
    if (redis) {
      await redis.set(key, JSON.stringify(value), "EX", ttlSec);
      return;
    }
    mem.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSec * 1000 });
  },
  async del(key: string): Promise<void> {
    if (redis) await redis.del(key);
    mem.delete(key);
  },
  async delPrefix(prefix: string): Promise<void> {
    if (redis) return; // keep simple; TTL expiry handles it
    for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k);
  },
};
