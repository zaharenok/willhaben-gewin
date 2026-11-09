import { describe, expect, it } from "vitest";
import {
  getPriceDelta,
  PRICE_HISTORY_PREFIX,
  PRICE_HISTORY_TTL_MS,
  rememberPrice,
  type PriceHistoryStorage,
} from "../src/lib/price-history";

const DAY = 24 * 60 * 60 * 1000;

function memStorage(): PriceHistoryStorage & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    async get(key: string) {
      return map.get(key);
    },
    async set(key: string, value: unknown) {
      map.set(key, value);
    },
  };
}

describe("price history", () => {
  it("first view has no delta and remembers the price", async () => {
    const s = memStorage();
    expect(await getPriceDelta(s, "123", 2087, 1000)).toBeNull();
    await rememberPrice(s, "123", 2087, 1000);
    expect(s.map.get(PRICE_HISTORY_PREFIX + "123")).toEqual({ eur: 2087, ts: 1000 });
  });

  it("shows a negative delta after a price drop", async () => {
    const s = memStorage();
    await rememberPrice(s, "123", 2150, 5 * DAY);
    expect(await getPriceDelta(s, "123", 2087, 6 * DAY)).toEqual({
      deltaEur: -63,
      seenTs: 5 * DAY,
    });
  });

  it("shows no delta while the price is unchanged", async () => {
    const s = memStorage();
    await rememberPrice(s, "123", 2087, 5 * DAY);
    expect(await getPriceDelta(s, "123", 2087, 6 * DAY)).toBeNull();
  });

  it("forgets entries older than the TTL", async () => {
    const s = memStorage();
    await rememberPrice(s, "1", 100, 0);
    expect(await getPriceDelta(s, "1", 200, PRICE_HISTORY_TTL_MS + 1)).toBeNull();
  });

  it("ignores entries more than a minute in the future (clock skew)", async () => {
    const s = memStorage();
    await rememberPrice(s, "1", 100, 5 * DAY);
    expect(await getPriceDelta(s, "1", 200, 5 * DAY - 120_000)).toBeNull();
  });

  it("ignores garbage entries", async () => {
    const s = memStorage();
    s.map.set(PRICE_HISTORY_PREFIX + "1", "garbage");
    expect(await getPriceDelta(s, "1", 200, 0)).toBeNull();
  });

  it("never throws on storage failures", async () => {
    const bad: PriceHistoryStorage = {
      async get() {
        throw new Error("nope");
      },
      async set() {
        throw new Error("nope");
      },
    };
    await expect(getPriceDelta(bad, "1", 100, 0)).resolves.toBeNull();
    await expect(rememberPrice(bad, "1", 100, 0)).resolves.toBeUndefined();
  });

  it("skips lookups without a current price", async () => {
    const s = memStorage();
    await rememberPrice(s, "1", 100, 0);
    expect(await getPriceDelta(s, "1", null, 0)).toBeNull();
  });
});
