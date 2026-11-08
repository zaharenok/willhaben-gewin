import { describe, expect, it } from "vitest";
import { mountListToggle } from "../src/content/list-toggle";
import { readSettings, type SettingsStorage } from "../src/lib/settings";
import { t } from "../src/lib/i18n";

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

function freshDoc(): Document {
  return new DOMParser().parseFromString("<html><body></body></html>", "text/html");
}

/** The shadow button, reached through the open shadow root. */
function button(doc: Document): HTMLElement {
  const host = doc.querySelector("[data-whg-list-toggle]")!;
  return host.shadowRoot!.querySelector(".btn")!;
}

describe("mountListToggle", () => {
  it("labels the action from the stored state (default on → 'hide' action)", async () => {
    const doc = freshDoc();
    const handle = mountListToggle(doc, fakeStorage());
    await handle.flush();
    expect(button(doc).textContent).toBe(t("listToggleHide"));
    handle.destroy();
  });

  it("click toggles the stored setting and flips the label", async () => {
    const doc = freshDoc();
    const area = fakeStorage();
    const handle = mountListToggle(doc, area);
    await handle.flush();
    button(doc).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await handle.flush();
    expect((await readSettings(area)).listMode).toBe(false);
    expect(button(doc).textContent).toBe(t("listToggleShow"));
    button(doc).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await handle.flush();
    expect((await readSettings(area)).listMode).toBe(true);
    expect(button(doc).textContent).toBe(t("listToggleHide"));
    handle.destroy();
  });

  it("a stored false value starts the button as 'show prices'", async () => {
    const doc = freshDoc();
    const area = fakeStorage({ settings: { listMode: false } });
    const handle = mountListToggle(doc, area);
    await handle.flush();
    expect(button(doc).textContent).toBe(t("listToggleShow"));
    handle.destroy();
  });

  it("destroy removes the host", () => {
    const doc = freshDoc();
    const handle = mountListToggle(doc, fakeStorage());
    expect(doc.querySelector("[data-whg-list-toggle]")).not.toBeNull();
    handle.destroy();
    expect(doc.querySelector("[data-whg-list-toggle]")).toBeNull();
  });
});
