import { describe, expect, it } from "vitest";
import { isNetworkFetchError } from "../src/lib/net";

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
