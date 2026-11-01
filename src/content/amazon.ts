import browser from "webextension-polyfill";
import { detectBlock, parseAmazonSearch } from "../lib/parse-amazon";
import type { TabParseResponse } from "../lib/protocol";

/**
 * Plan B relay: injected on amazon search pages so the background worker
 * (whose own fetch may be blocked) can parse a real tab's DOM. Idle
 * otherwise — it only answers explicit PARSE_SEARCH messages from the worker.
 */
browser.runtime.onMessage.addListener((message: unknown): Promise<TabParseResponse> | undefined => {
  if (typeof message !== "object" || message === null || !("type" in message)) return undefined;
  if (message.type !== "PARSE_SEARCH") return undefined;
  const html = document.documentElement.outerHTML;
  if (detectBlock(html)) {
    console.warn("[whg:amz] search page itself is a block page", location.href);
    return Promise.resolve({ type: "PARSE_RESULT", status: "blocked" });
  }
  const items = parseAmazonSearch(html);
  console.log("[whg:amz] parsed", items.length, "items for worker", location.href);
  return Promise.resolve({ type: "PARSE_RESULT", status: "ok", items });
});

console.log("[whg:amz] relay loaded", location.href);
