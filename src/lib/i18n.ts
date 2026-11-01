export type MsgKey = "badgeUsed" | "badgeNew" | "badgeOverpay" | "chooseTitle" | "blockedHint" | "openSearch";

type Lang = "de" | "en" | "ru";

const DICT: Record<Lang, Record<MsgKey, string>> = {
  de: {
    badgeUsed: "Willhaben",
    badgeNew: "Neupreis auf Amazon",
    badgeOverpay: "Überzahlung",
    chooseTitle: "Artikel wählen",
    blockedHint: "Amazon hat die Anfrage blockiert",
    openSearch: "Suche öffnen",
  },
  en: {
    badgeUsed: "Willhaben",
    badgeNew: "New on Amazon",
    badgeOverpay: "Overpay",
    chooseTitle: "Choose the product",
    blockedHint: "Amazon blocked the request",
    openSearch: "Open search",
  },
  ru: {
    badgeUsed: "Willhaben",
    badgeNew: "Новый на Amazon",
    badgeOverpay: "Переплата",
    chooseTitle: "Выберите товар",
    blockedHint: "Amazon заблокировал запрос",
    openSearch: "Открыть поиск",
  },
};

function detectLang(navigatorLanguage: string): Lang {
  const base = navigatorLanguage.toLowerCase().split("-")[0];
  return base === "en" || base === "ru" ? base : "de";
}

/** UI string for a key; picks DE/EN/RU by navigator language, fallback DE. */
export function t(key: MsgKey): string {
  const lang = typeof navigator !== "undefined" ? detectLang(navigator.language) : "de";
  return DICT[lang][key];
}
