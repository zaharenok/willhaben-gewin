import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  readSettings,
  SETTINGS_KEY,
  writeSettings,
  type SettingsStorage,
} from "../src/lib/settings";

function fakeStorage(initial: Record<string, unknown> = {}): SettingsStorage {
  const data = { ...initial };
  return {
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}

describe("settings", () => {
  it("falls back to defaults when nothing is stored", async () => {
    expect(await readSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.listMode).toBe(true);
  });

  it("round-trips a written value", async () => {
    const area = fakeStorage();
    await writeSettings(area, { listMode: true });
    expect(await readSettings(area)).toEqual({ listMode: true });
    expect((await area.get(SETTINGS_KEY))[SETTINGS_KEY]).toEqual({ listMode: true });
  });

  it("ignores stored garbage", async () => {
    expect(await readSettings(fakeStorage({ [SETTINGS_KEY]: "junk" }))).toEqual(DEFAULT_SETTINGS);
    expect(await readSettings(fakeStorage({ [SETTINGS_KEY]: { listMode: "yes" } }))).toEqual({
      listMode: true,
    });
  });
});
