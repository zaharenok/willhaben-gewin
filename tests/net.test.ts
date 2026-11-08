import { describe, expect, it } from "vitest";
import { isNetworkFetchError, isTabDragError } from "../src/lib/net";

describe("isNetworkFetchError", () => {
  it("matches the fetch() offline/sleep TypeError", () => {
    expect(isNetworkFetchError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFetchError(new TypeError("failed to fetch"))).toBe(true);
  });

  it("does not match other TypeErrors or throwables", () => {
    expect(isNetworkFetchError(new TypeError("Conversion error"))).toBe(false);
    expect(isNetworkFetchError(new Error("Failed to fetch"))).toBe(false);
    expect(isNetworkFetchError("Failed to fetch")).toBe(false);
    expect(isNetworkFetchError(null)).toBe(false);
    expect(isNetworkFetchError(undefined)).toBe(false);
  });
});

describe("isTabDragError", () => {
  it("matches Chrome's tab-drag refusal", () => {
    expect(isTabDragError(new Error("Tabs cannot be edited right now (user may be dragging a tab)."))).toBe(true);
  });

  it("does not match other errors", () => {
    expect(isTabDragError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isTabDragError(new Error("Cannot create tab"))).toBe(false);
    expect(isTabDragError(null)).toBe(false);
  });
});
