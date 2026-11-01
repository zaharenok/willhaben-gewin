# Willhaben Gewin — Save money buying used on Willhaben 🇦🇹

A Chrome extension (Manifest V3) that shows you **how much you'd save** by buying an item used on [Willhaben](https://willhaben.at) while browsing Amazon.de.

**Example:** viewing a €89 product on Amazon, the extension overlays:

> 💚 Used on Willhaben: ~€35 → you save €54 (61%)

## How it works (MVP)

1. A content script on `amazon.de` product pages extracts title, brand, EAN/ASIN and price.
2. The extension searches Willhaben for matching used listings.
3. Listings are fuzzy-matched to the product (user confirms the match in MVP).
4. An overlay badge near the Amazon price shows the used price range, absolute and percentage savings, with links to the listings.

## Status

💡 Idea stage — see [IDEA.md](IDEA.md). No code yet.

## Roadmap

- [ ] Prototype content script: extract title + price from Amazon product pages
- [ ] Decide Willhaben data channel (search scraping vs. prefilled search link)
- [ ] Overlay UI badge near the Amazon price
- [ ] Fuzzy matching + user confirmation
- [ ] Price range (min–median) instead of a single number

## Non-goals (for now)

Auto-buying, notifications, accounts, server-side backend.

## Contributing

Ideas and feedback welcome — open an issue.

## License

[MIT](LICENSE)

---

## Deutsch

# Willhaben Gewin — Geld sparen beim Gebrauchtkauf auf Willhaben 🇦🇹

Eine Chrome-Erweiterung (Manifest V3), die dir anzeigt, **wie viel du sparst**, wenn du einen Artikel gebraucht auf [Willhaben](https://willhaben.at) kaufst — direkt beim Stöbern auf Amazon.de.

**Beispiel:** Du siehst ein Produkt für 89 € auf Amazon, und die Erweiterung zeigt:

> 💚 Gebraucht auf Willhaben: ca. 35 € → du sparst 54 € (61 %)

### So funktioniert es (MVP)

1. Ein Content-Script auf `amazon.de`-Produktseiten extrahiert Titel, Marke, EAN/ASIN und Preis.
2. Die Erweiterung sucht auf Willhaben nach passenden Gebrauchtangeboten.
3. Die Angebote werden per Fuzzy-Matching zugeordnet (im MVP bestätigt der Nutzer).
4. Ein Badge neben dem Amazon-Preis zeigt die Preisspanne, absolute und prozentuale Ersparnis mit Links zu den Inseraten.

### Status

💡 Ideephase — siehe [IDEA.md](IDEA.md). Noch kein Code.

### Roadmap

- [ ] Content-Script-Prototyp: Titel + Preis von Amazon-Produktseiten extrahieren
- [ ] Willhaben-Datenkanal festlegen (Scraping der Suche vs. vorausgefüllter Suchlink)
- [ ] Overlay-Badge neben dem Amazon-Preis
- [ ] Fuzzy-Matching + Bestätigung durch den Nutzer
- [ ] Preisspanne (Min–Median) statt einer einzelnen Zahl

### Nicht-Ziele (vorerst)

Automatischer Kauf, Benachrichtigungen, Accounts, Server-Backend.

### Mitwirken

Ideen und Feedback willkommen — einfach ein Issue eröffnen.

### Lizenz

[MIT](LICENSE)

---

## Русский

# Willhaben Gewin — экономь, покупая б/у на Willhaben 🇦🇹

Расширение для Chrome (Manifest V3), которое показывает, **сколько ты сэкономишь**, если купишь товар б/у на [Willhaben](https://willhaben.at), прямо во время просмотра Amazon.de.

**Пример:** смотришь товар за 89 € на Amazon — расширение показывает:

> 💚 Б/у на Willhaben: ~35 € → экономия 54 € (61%)

### Как это работает (MVP)

1. Content script на страницах товаров `amazon.de` извлекает название, бренд, EAN/ASIN и цену.
2. Расширение ищет совпадающие б/у-объявления на Willhaben.
3. Товары сопоставляются нечётким поиском (в MVP — с подтверждением пользователем).
4. Бейдж рядом с ценой Amazon показывает диапазон б/у-цен, экономию в € и %, со ссылками на объявления.

### Статус

💡 Стадия идеи — см. [IDEA.md](IDEA.md). Кода пока нет.

### План

- [ ] Прототип content script: извлечение названия и цены со страниц Amazon
- [ ] Выбрать канал данных Willhaben (парсинг поиска vs ссылка с готовым запросом)
- [ ] UI-бейдж рядом с ценой Amazon
- [ ] Fuzzy-match + подтверждение пользователем
- [ ] Диапазон цен (мин–медиана) вместо одной цифры

### Не-цели (пока)

Автопокупка, уведомления, аккаунты, серверная часть.

### Участие

Идеи и фидбек приветствуются — заводи issue.

### Лицензия

[MIT](LICENSE)
