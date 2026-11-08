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

/**
 * Transient Chrome-UI classifier: `tabs.create` throws while the user is
 * dragging a tab in the strip ("Tabs cannot be edited right now"). The next
 * lookup creates the hidden tab just fine, so this is a warning-grade miss.
 */
export function isTabDragError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof error.message === "string" &&
    /tabs cannot be edited right now/i.test(error.message)
  );
}

/**
 * "Extension context invalidated." — the content script belongs to an
 * extension instance that was reloaded/updated/removed. Every API call from
 * it will keep failing; the only correct move is to stop logging and tear
 * the annotator down (a fresh script takes over after the page reloads).
 */
export function isContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof error.message === "string" &&
    /extension context invalidated/i.test(error.message)
  );
}
