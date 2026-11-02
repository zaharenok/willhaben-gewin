/**
 * Storage-agnostic cache with TTL. The storage backend (chrome.storage.local
 * in the extension, in-memory in tests) is injected, so the TTL logic stays pure.
 */
export interface CacheStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const TTL_OK_MS = 24 * 60 * 60 * 1000; // 24 h for search results
export const TTL_BLOCKED_MS = 60 * 60 * 1000; // 1 h for blocked responses

/** djb2 hash of the normalized title → stable cache key. */
export function cacheKey(normTitle: string): string {
  let h = 5381;
  for (let i = 0; i < normTitle.length; i++) {
    h = ((h << 5) + h + normTitle.charCodeAt(i)) >>> 0;
  }
  return `whg4:${h.toString(36)}`;
}

interface Entry {
  v: unknown;
  exp: number;
}

/** Returns the cached value, or null when missing/expired. */
export async function getCached<T>(
  storage: CacheStorage,
  key: string,
  now: number = Date.now(),
): Promise<T | null> {
  const raw = (await storage.get(key)) as Entry | undefined;
  if (!raw || typeof raw.exp !== "number" || raw.exp <= now) return null;
  return raw.v as T;
}

export async function setCached<T>(
  storage: CacheStorage,
  key: string,
  value: T,
  ttlMs: number,
  now: number = Date.now(),
): Promise<void> {
  await storage.set(key, { v: value, exp: now + ttlMs } satisfies Entry);
}
