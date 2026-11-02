export type MsgKey = "badgeUsed" | "badgeNew" | "badgeRefurb" | "cheaper" | "costlier" | "chooseTitle" | "blockedHint" | "noMatch" | "openSearch" | "openGoogle" | "loadingHint" | "appleRefurb" | "adNote";

type Lang = "de" | "en" | "ru";

const DICT: Record<Lang, Record<MsgKey, string>> = {
  de: {
    badgeUsed: "Willhaben",
    badgeNew: "Neupreis auf Amazon",
    badgeRefurb: "Refurbished bei Apple",
    cheaper: "günstiger",
    costlier: "teurer",
    chooseTitle: "Artikel wählen",
    blockedHint: "Amazon hat die Anfrage blockiert",
    openSearch: "Suche öffnen",
    loadingHint: "Amazon-Preisvergleich erscheint hier",
    noMatch: "Kein passendes Angebot gefunden",
    openGoogle: "Google Shopping",
    appleRefurb: "Apple Refurbished",
    adNote: "Amazon-Links sind Partnerlinks",
  },
  en: {
    badgeUsed: "Willhaben",
    badgeNew: "New on Amazon",
    badgeRefurb: "Apple Refurbished",
    cheaper: "cheaper",
    costlier: "more expensive",
    chooseTitle: "Choose the product",
    blockedHint: "Amazon blocked the request",
    openSearch: "Open search",
    openGoogle: "Google Shopping",
    loadingHint: "Amazon price comparison will appear here",
    noMatch: "No matching offer found",
    appleRefurb: "Apple Refurbished",
    adNote: "Amazon links are affiliate links",
  },
  ru: {
    badgeUsed: "Willhaben",
    badgeNew: "Новый на Amazon",
    badgeRefurb: "Apple Refurbished",
    cheaper: "дешевле",
    costlier: "дороже",
    chooseTitle: "Выберите товар",
    blockedHint: "Amazon заблокировал запрос",
    openSearch: "Открыть поиск",
    openGoogle: "Google Shopping",
    loadingHint: "Здесь появится сравнение цен с Amazon",
    noMatch: "Подходящее предложение не найдено",
    appleRefurb: "Apple Refurbished",
    adNote: "Amazon-ссылки — партнёрские",
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
