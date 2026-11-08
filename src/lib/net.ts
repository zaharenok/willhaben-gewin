/**
 * Transient network failure classifier for background fetches.
 * `TypeError: Failed to fetch` is what fetch() throws when the network is
 * unreachable — offline, right after OS sleep/wake, DNS down. Expected and
 * self-healing (the next lookup retries), so callers log it as a warning,
 * not an error that lands in chrome://extensions' Errors panel.
 */
export function isNetworkFetchError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    typeof error.message === "string" &&
    /failed to fetch/i.test(error.message)
  );
}
