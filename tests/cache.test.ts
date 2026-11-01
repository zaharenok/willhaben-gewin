import { describe, expect, it } from "vitest";
import { cacheKey, getCached, setCached, TTL_OK_MS, type CacheStorage } from "../src/lib/cache";

function memoryStorage(): CacheStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value);
    },
  };
}

describe("cacheKey", () => {
  it("is deterministic and title-sensitive", () => {
    expect(cacheKey("iphone 13 128gb")).toBe(cacheKey("iphone 13 128gb"));
    expect(cacheKey("iphone 13 128gb")).not.toBe(cacheKey("iphone 14 128gb"));
    expect(cacheKey("iphone 13 128gb")).toMatch(/^whg:[a-z0-9]+$/);
  });
});

describe("TTL", () => {
  it("returns the value within TTL and null after expiry", async () => {
    const storage = memoryStorage();
    const t0 = 1_000_000;
    const key = cacheKey("iphone 13");
    await setCached(storage, key, { candidates: 3 }, TTL_OK_MS, t0);

    expect(await getCached(storage, key, t0 + TTL_OK_MS - 1)).toEqual({ candidates: 3 });
    expect(await getCached(storage, key, t0 + TTL_OK_MS)).toBeNull();
  });

  it("returns null for missing keys", async () => {
    expect(await getCached(memoryStorage(), cacheKey("nothing here"))).toBeNull();
  });

  it("round-trips arbitrary values", async () => {
    const storage = memoryStorage();
    const key = cacheKey("round trip");
    await setCached(storage, key, ["a", "b"], TTL_OK_MS);
    expect(await getCached<string[]>(storage, key)).toEqual(["a", "b"]);
  });
});
