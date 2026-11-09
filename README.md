# Willhaben Gewin — Willhaben → Amazon

**Status: MVP in development.**

A Chrome extension (Manifest V3) that shows, on every `willhaben.at` listing page, what the same product costs **new on Amazon.de** — and how much you overpay (or save) by buying used.

You are browsing a used listing for €35. The badge tells you: this item new on Amazon.de costs €89 → you save €54 (61%) versus buying new. One click opens the Amazon search results for that exact product.

The original idea (Amazon → Willhaben price overlay) is deferred and kept in [`ideas/amazon-to-willhaben/`](ideas/amazon-to-willhaben/).

## How it works (MVP)

1. **Extract the listing** — a content script reads title, price, condition, and listing id from the open `willhaben.at` detail page.
2. **Search Amazon** — the background service worker queries `amazon.de/s?k=…` (rate-limited, cached 24 h).
3. **Match + confirm** — candidates are scored against the listing title; the median candidate is shown as a preview (`≈`), the user confirms the actual product from a top-3 panel.
4. **Overlay badge** — a Shadow-DOM badge next to the listing price shows the new-price range, the overpay in € and %, and links to the listings.
5. **Cache / fallback** — results are cached (24 h; blocked responses 1 h); if Amazon blocks the worker's request it retries from a real background tab, and only if that also fails does the badge degrade to a direct search link.

No backend, no Amazon account — everything runs in the browser.

**List mode (optional)** — on by default: every search-result row gets a small win/loss pill — green `−€ …` when the listing undercuts the Amazon new price, red `+€ …` when it overpays (median candidate, unconfirmed). A corner button on every list page toggles it ("Show/Hide prices"), as does the popup switch; changes apply live, no reload needed. Pills fill in progressively (rate limit).
**Immobilien (v0.8.0)** — rent listings in Vienna get a €/m² badge with an orientation-only Mietrechtsgesetz check: net rent per m² vs. the Wiener Richtwert (€6.74/m² since 4/2026, max ≈ €8.99 with surcharges) → green "within rent cap" / red "well above rent cap" (never legal advice); flags for Befristung and Provision, a last-seen price delta, and a panel linking the Wiener Mietenrechner. In list mode every Immobilien result row gets a €/m² pill colored against the page: cheapest third green, dearest third red. Purchase listings render without the rent verdict. The list path is fully local — no network.

## Roadmap

- [x] Extract listing (title, price, condition) from a live willhaben.at page
- [x] Amazon search from the background worker (rate limit + cache)
- [x] Title matching + explicit user confirmation of the candidate
- [x] Overlay badge near the listing price (Shadow DOM, DE/EN/RU)
- [x] Cache, blocked-fallback link, headless e2e verification

## Development

```bash
pnpm install   # deps
pnpm dev       # vite dev — loads extension into dev browser
pnpm build     # vite build → dist/ (load unpacked at chrome://extensions)
pnpm test      # vitest run (pure-logic unit tests + fixtures)
```

Stack: TypeScript, Vite + `vite-plugin-web-extension`, `webextension-polyfill`, vitest + jsdom.

## Non-goals (for now)

Auto-buying, notifications, accounts, server-side backend, other marketplaces.

## Deutsch

**Status: MVP in Entwicklung.**

Chrome-Erweiterung (Manifest V3), die auf jeder `willhaben.at`-Anzeige den **Neupreis auf Amazon.de** für denselben Artikel zeigt — inklusive Überzahlung in € und %.

Gekaufst du gebraucht für €35, zeigt das Badge: neu auf Amazon.de €89 → du sparst €54 (61 %). Ein Klick öffnet die Amazon-Suche für diesen Artikel.

Die ursprüngliche Idee (Amazon → Willhaben) ist zurückgestellt und liegt unter [`ideas/amazon-to-willhaben/`](ideas/amazon-to-willhaben/).

**So funktioniert es (MVP):** Anzeige extrahieren (Titel, Preis, Zustand) → Amazon-Suche im Background-Worker (Rate-Limit, 24 h Cache) → Treffer-Matching + Bestätigung durch den Nutzer (Top-3-Panel, Median-Kandidat nur als Vorschau `≈`) → Badge neben dem Anzeigenpreis (Shadow DOM) → bei Blockade: Retry über einen Hintergrund-Tab, erst wenn auch das scheitert → Fallback-Link zur Amazon-Suche. Kein Backend, kein Amazon-Konto.

**Listenmodus (optional)** — standardmäßig an: jedes Suchergebnis bekommt eine kleine Gewinn/Verlust-Pille — grün `−€ …`, wenn das Inserat unter dem Amazon-Neupreis liegt, rot `+€ …` bei Überzahlung (Median-Kandidat, unbestätigt). Eine Ecken-Schaltfläche auf jeder Listenseite schaltet um („Preise anzeigen/ausblenden"), ebenso der Popup-Schalter; Änderungen greifen sofort, ohne Reload. Die Pillen füllen sich nach und nach (Rate-Limit).
**Immobilien (ab v0.8.0)** — Miet-Inserate in Wien bekommen ein €/m²-Badge mit orientierender MRG-Prüfung: Netto-Miete pro m² gegen den Wiener Richtwert (6,74 €/m² seit 4/2026, max ≈ 8,99 € mit Zuschlägen) → grün „im Richtwert-Rahmen“ / rot „deutlich über Richtwert“ (keine Rechtsberatung); Flags für Befristung und Provision, Preisdelta zum letzten Besuch, Panel mit Link zum Wiener Mietenrechner. Im Listenmodus bekommt jede Immobilien-Zeile eine €/m²-Pille, relativ zur Seite eingefärbt: günstigstes Drittel grün, teuerstes rot. Kauf-Anzeigen erscheinen ohne Miet-Verdict. Der Listenpfad ist komplett lokal — ohne Netzwerk.

**Roadmap:** `- [x]` Anzeige extrahieren · Amazon-Suche · Matching + Bestätigung · Overlay-Badge · Cache/Fallback + Headless-E2E.

**Entwicklung:** `pnpm install` · `pnpm dev` · `pnpm build` → `dist/` · `pnpm test`. Stack: TypeScript, Vite + `vite-plugin-web-extension`, `webextension-polyfill`, vitest.

**Nicht geplant:** Auto-Kauf, Benachrichtigungen, Konten, serverseitiges Backend, weitere Marktplätze.

## Русский

**Статус: MVP в разработке.**

Chrome-расширение (Manifest V3), которое на каждой странице объявления `willhaben.at` показывает **цену нового товара на Amazon.de** — и переплату (или экономию) в € и %.

Смотришь б/у объявление за €35 → бейдж скажет: новый на Amazon.de стоит €89 → экономия €54 (61 %). Один клик открывает выдачу Amazon по этому товару.

Исходная идея (Amazon → Willhaben) отложена и лежит в [`ideas/amazon-to-willhaben/`](ideas/amazon-to-willhaben/).

**Как работает (MVP):** извлечение объявления (заголовок, цена, состояние) → поиск Amazon в background-воркере (rate-limit, кэш 24 ч) → матчинг заголовка + обязательное подтверждение пользователем (панель топ-3, медианный кандидат только как предпросмотр `≈`) → бейдж рядом с ценой объявления (Shadow DOM) → при блокировке: повтор через фоновую вкладку Amazon, и только если и это не вышло — фолбэк-ссылка на поиск. Без бэкенда, без аккаунта Amazon.

**Режим списка (опционально)** — включён по умолчанию: у каждого результата поиска появляется маленькая плашка выигрыш/проигрыш — зелёная `−€ …`, если объявление дешевле нового на Amazon, красная `+€ …` при переплате (медианный кандидат, без подтверждения). Кнопка в углу каждой страницы списка переключает режим («Показать/Скрыть цены»), как и тумблер в попапе; изменения применяются сразу, без перезагрузки. Плашки заполняются постепенно (rate-limit).
**Недвижимость (с v0.8.0)** — аренда в Вене получает бейдж €/м² с ориентировочной проверкой по Mietrechtsgesetz: чистая аренда за м² против венского Richtwert (6,74 €/м² с 04.2026, максимум ≈ 8,99 € с надбавками) → зелёный «в рамках Richtwert» / красный «заметно выше Richtwert» (не юридическая консультация); флаги Befristung и Provision, дельта цены с последнего визита, панель со ссылкой на Wiener Mietenrechner. В режиме списка каждая строка недвижимости получает плашку €/м², окрашенную относительно страницы: самая дешёвая треть — зелёная, самая дорогая — красная. Объявления о покупке показываются без арендного вердикта. Списочный путь полностью локальный — без сети.

**Роадмап:** `- [x]` извлечение объявления · поиск Amazon · матчинг + подтверждение · оверлей-бейдж · кэш/фолбэк + headless-e2e.

**Разработка:** `pnpm install` · `pnpm dev` · `pnpm build` → `dist/` · `pnpm test`. Стек: TypeScript, Vite + `vite-plugin-web-extension`, `webextension-polyfill`, vitest.

**Вне скоупа (пока):** авто-покупка, уведомления, аккаунты, серверный бэкенд, другие маркетплейсы.
