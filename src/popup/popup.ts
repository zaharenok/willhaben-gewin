import browser from "webextension-polyfill";
import { readSettings, writeSettings } from "../lib/settings";
import { t } from "../lib/i18n";

const checkbox = document.getElementById("listMode") as HTMLInputElement | null;
const label = document.getElementById("label");
const hint = document.getElementById("hint");

if (label) label.textContent = t("listModeLabel");
if (hint) hint.textContent = t("listModeHint");

if (checkbox) {
  void readSettings(browser.storage.local)
    .then((settings) => {
      checkbox.checked = settings.listMode;
    })
    .catch(() => undefined);
  checkbox.addEventListener("change", () => {
    void writeSettings(browser.storage.local, { listMode: checkbox.checked }).catch(
      () => undefined,
    );
  });
}
