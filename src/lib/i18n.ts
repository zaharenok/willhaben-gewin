export type MsgKey = "badgeUsed" | "badgeNew" | "cheaper" | "costlier" | "chooseTitle" | "blockedHint" | "noMatch" | "openSearch" | "loadingHint";

type Lang = "de" | "en" | "ru";

const DICT: Record<Lang, Record<MsgKey, string>> = {
  de: {
    badgeUsed: "Willhaben",
    badgeNew: "Neupreis auf Amazon",
    cheaper: "günstiger",
    costlier: "teurer",
    chooseTitle: "Artikel wählen",
    blockedHint: "Amazon hat die Anfrage blockiert",
    openSearch: "Suche öffnen",
    loadingHint: "Amazon-Preisvergleich erscheint hier",
    noMatch: "Kein passendes Angebot auf Amazon gefunden",
  },
  en: {
    badgeUsed: "Willhaben",
    badgeNew: "New on Amazon",
    cheaper: "cheaper",
    costlier: "more expensive",
    chooseTitle: "Choose the product",
    blockedHint: "Amazon blocked the request",
    openSearch: "Open search",
    loadingHint: "Amazon price comparison will appear here",
    noMatch: "No matching product found on Amazon",
  },
  ru: {
    badgeUsed: "Willhaben",
    badgeNew: "Новый на Amazon",
    cheaper: "дешевле",
    costlier: "дороже",
    chooseTitle: "Выберите товар",
    blockedHint: "Amazon заблокировал запрос",
    openSearch: "Открыть поиск",
    loadingHint: "Здесь появится сравнение цен с Amazon",
    noMatch: "Подходящий товар на Amazon не найден",
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
