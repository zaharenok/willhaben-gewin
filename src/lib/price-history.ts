/**
 * Last-seen price per immobilien listing (storage-agnostic, injected like
 * cache.ts): lets the detail badge show "seit <date>: −€63" after the price
 * changed between visits. Best effort — storage failures never break the badge.
 */
export interface PriceHistoryStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const PRICE_HISTORY_PREFIX = "whg7p:";
/** Seen prices older than 30 days are forgotten (rents move slowly). */
export const PRICE_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Seen {
  eur: number;
  ts: number;
}

export interface PriceDelta {
  /** current − last seen; negative = price dropped. */
  deltaEur: number;
  /** When the previous price was seen. */
  seenTs: number;
}

/**
 * Difference to the previously seen price. Null on first view, unchanged
 * price, expired entry (or >1 min in the future — clock skew) or any
 * storage/parse failure.
 */
export async function getPriceDelta(
  storage: PriceHistoryStorage,
  id: string,
  currentEur: number | null,
  now: number = Date.now(),
): Promise<PriceDelta | null> {
  if (currentEur === null) return null;
  try {
    const raw = await storage.get(PRICE_HISTORY_PREFIX + id);
    if (raw === null || raw === undefined || typeof raw !== "object") return null;
    const { eur, ts } = raw as Partial<Seen>;
    if (typeof eur !== "number" || typeof ts !== "number") return null;
    if (now - ts > PRICE_HISTORY_TTL_MS || ts - now > 60_000) return null;
    if (eur === currentEur) return null;
    return { deltaEur: Math.round((currentEur - eur) * 100) / 100, seenTs: ts };
  } catch {
    return null;
  }
}

/** Record the current price — overwrite-last-wins, no locking needed. */
export async function rememberPrice(
  storage: PriceHistoryStorage,
  id: string,
  eur: number | null,
  now: number = Date.now(),
): Promise<void> {
  if (eur === null) return;
  try {
    await storage.set(PRICE_HISTORY_PREFIX + id, { eur, ts: now } satisfies Seen);
  } catch {
    // best effort
  }
}
