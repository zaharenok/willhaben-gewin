import browser from "webextension-polyfill";
import { isGoogleBlockOrConsent, parseGoogleShopping } from "../lib/parse-google";
import type { GoogleParseResponse } from "../lib/protocol";

/**
 * Relay: injected on google.com/search pages so the background worker can
 * parse a real tab's DOM (its own fetch only gets a JS shell; headless gets
 * /sorry/). Idle otherwise — it only answers explicit
 * PARSE_GOOGLE_SHOPPING messages from the worker on the tab it opened.
 */
browser.runtime.onMessage.addListener((message: unknown): Promise<GoogleParseResponse> | undefined => {
  if (typeof message !== "object" || message === null || !("type" in message)) return undefined;
  if (message.type !== "PARSE_GOOGLE_SHOPPING") return undefined;
  if (isGoogleBlockOrConsent(document)) {
    console.warn("[whg:gg] search page is a block/consent page", location.href);
    return Promise.resolve({ type: "GOOGLE_RESULT", status: "blocked" });
  }
  const items = parseGoogleShopping(document);
  console.log("[whg:gg] relay parsed", items.length, "items", location.href);
  return Promise.resolve({ type: "GOOGLE_RESULT", status: "ok", items });
});

console.log("[whg:gg] relay loaded", location.href);
