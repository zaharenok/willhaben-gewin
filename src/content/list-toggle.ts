import browser from "webextension-polyfill";
import { readSettings, writeSettings, type SettingsStorage } from "../lib/settings";
import { t } from "../lib/i18n";

export interface ListToggleHandle {
  /** Resolves after the last pending read/write + render settles (test seam). */
  flush(): Promise<void>;
  destroy(): void;
}

/**
 * Fixed corner button on willhaben list pages: toggles list mode without
 * opening the popup. Label always names the action ("Show prices" when off).
 * Reacts to external changes (popup toggle) via storage.onChanged.
 */
export function mountListToggle(doc: Document, area: SettingsStorage = browser.storage.local): ListToggleHandle {
  const host = doc.createElement("div");
  host.setAttribute("data-whg-list-toggle", "");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>.btn{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:inline-block;font:600 12px/1.3 system-ui,sans-serif;padding:7px 12px;border-radius:999px;background:#ffffffee;color:#1c1c1c;border:1px solid #cfcfcf;box-shadow:0 1px 4px rgba(0,0,0,.18);cursor:pointer;user-select:none}.btn.on{border-color:#8fd6a5}</style><div class="btn" role="button"></div>`;
  const btn = shadow.querySelector(".btn")!;
  doc.body.appendChild(host);

  let current = false;
  let pending: Promise<unknown> = Promise.resolve();
  /** Track async read/write work so flush() can await it deterministically. */
  const track = <T>(task: Promise<T>): Promise<T> => {
    pending = task.catch(() => undefined);
    return task;
  };

  const render = (): void => {
    btn.textContent = current ? t("listToggleHide") : t("listToggleShow");
    btn.className = current ? "btn on" : "btn";
    btn.setAttribute("title", t("listModeHint"));
  };

  const sync = async (): Promise<void> => {
    try {
      current = (await readSettings(area)).listMode;
    } catch {
      return;
    }
    render();
  };
  const onChanged = (_changes: unknown, areaName: string): void => {
    if (areaName === "local") void track(sync());
  };
  void browser.storage.onChanged.addListener(onChanged);
  btn.addEventListener("click", () => {
    current = !current; // optimistic — onChanged confirms with the real value
    render();
    void track(writeSettings(area, { listMode: current }));
  });
  void track(sync());

  return {
    flush: () => pending.then(() => undefined),
    destroy(): void {
      try {
        void browser.storage.onChanged.removeListener(onChanged);
      } catch {
        // polyfill shape differences — the host removal is what matters
      }
      host.remove();
    },
  };
}
