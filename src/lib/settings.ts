/**
 * Extension settings, stored under one key in chrome.storage.local.
 * The storage area is injected (chrome.storage.local in the extension, a
 * fake in tests), so the settings logic stays free of browser APIs.
 */
export interface Settings {
  /** Annotate every search-result row with a win/loss price badge. */
  listMode: boolean;
}

/** List mode is the visible value of the extension — on unless switched off. */
export const DEFAULT_SETTINGS: Settings = { listMode: true };

export const SETTINGS_KEY = "settings";

/** Subset of browser.storage.AreaAsync that settings actually use. */
export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** Read settings; missing/garbage values fall back to the defaults. */
export async function readSettings(area: SettingsStorage): Promise<Settings> {
  const raw = (await area.get(SETTINGS_KEY))[SETTINGS_KEY];
  if (raw === null || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const obj = raw as Partial<Settings>;
  return {
    listMode: typeof obj.listMode === "boolean" ? obj.listMode : DEFAULT_SETTINGS.listMode,
  };
}

export async function writeSettings(area: SettingsStorage, settings: Settings): Promise<void> {
  await area.set({ [SETTINGS_KEY]: settings });
}
