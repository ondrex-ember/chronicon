# CHRONICON — narrative/ — schéma a návod pro rozšiřování

Tento dokument je referencí pro doplňování nových záznamů do tří JSON setů
(`distant_events_v1.json`, `local_events_v1.json`, `monastery_internal_v1.json`).
Slouží jako podklad pro generování dávek v NotebookLM nebo ruční přidávání.

---

## Společná pravidla pro všechny tři sety

- **`id`** — unikátní string, prefix podle zdroje (viz katalog níže) + číslo, např. `frois_008`, `local_031`, `mono_031`. Nikdy neopakovat existující ID.
- **`text_cs`** a **`text_en`** — povinné oba. Vždy psát oba jazyky najednou, nikdy nedoplňovat zpětně.
- **`icon`** — jedno emoji, vystihující obsah zprávy.
- **`type`** — jedno z: `A` (běžná/neutrální), `B` (hrozba/varování), `C` (info/diplomacie), `D` (škoda/ztráta), `E` (pozitivní zpráva).
- **`tags`** — pole klíčových slov, pro budoucí filtrování.
- Texty držet v rozsahu 2–4 vět, konkrétní (jména, místa, čísla) — abstraktní fráze feed nudí.

---

## distant_events_v1.json — zprávy z dálky

Pole navíc: `source`, `source_label`, `delay_days`, `month_hint` (pole měsíců 1–12 nebo `null`).

### Katalog zdrojů (`source` → `source_label` → typický `delay_days`)

| source | source_label (vzor) | delay_days | poznámka |
|---|---|---|---|
| `froissart` | Kronika Jeana Froissarta, Flandry | 30–50 | války, rytíři, dvůr |
| `datini` | Kupecká pošta z Prata, agent v [město] | 20–55 | obchod, ceny, mor |
| `coroner_rolls` | Londýnské koronerské svitky | 55 | černá kronika, absurdní úmrtí |
| `zbraslavska` | Zbraslavská kronika, Petr Žitavský | 6–10 | středoevropská politika |
| `stare_letopisy` | Staré letopisy české, Praha | 8 | Praha — král Jiří, místní politika |

Nové zdroje lze přidat — držet stejnou strukturu (`source` + `source_label` + realistický `delay_days` dle vzdálenosti).

`delay_days` je narativní metadata (zatím nepoužívané enginem pro skutečné zpoždění) — promítá se do textu jako "zpráva stará X týdnů".

---

## local_events_v1.json — místní drby (Olomouc a Morava)

Stejná pole jako distant, ale `delay_days` 1–5 (posel z okolí) a `source` vždy `local_region`.

### Katalog `source_label` vzorů
`Posel z [město]` nebo `Zpráva z olomoucké [instituce]` (radnice, trhu, koronerské knihy, farní matriky).

### Použitá místa (pro konzistenci)
Olomouc, Litovel, Prostějov, Přerov, Šternberk, Kroměříž, Lipník nad Bečvou, Fulnek, Mohelnice, Kelč, Hranice na Moravě, Uherské Hradiště, Bystřice pod Hostýnem, Uničov.

**Pozor na prepozice Z/Ze** — "Z Přerova", "Z Prostějova", "Z Fulneku" (standardní), ale "Ze Šternberka" (kvůli souhláskovému shluku Š+t).

---

## monastery_internal_v1.json — interní klášterní život

Pole navíc: `conditions: { season: [...], weather_keys: [...] | null }`.

- `season`: pole čísel 0–3 (0=Jaro, 1=Léto, 2=Podzim, 3=Zima).
- `weather_keys`: pole klíčů z `core/weather.js` (např. `summer_storm`, `winter_frost`) nebo `null` = kdykoli v dané sezóně.

### Role-based `source_label` vzory
Zápis převora, Zápis skriptora, Zápis sklepmistra, Zápis zahradníka, Zápis kuchmistra, Zápis infirmáře, Zápis cantora, Zápis vrátného.

Tyto role lze rozšířit (bratr knihovník, bratr fortnýř...) — držet konzistentní "Zápis [role]" formát.

---

## Picker — jak engine vybírá

`narrative/picker.js` má tři pravděpodobnostní gates (`PROB_MONASTERY`, `PROB_LOCAL`, `PROB_DISTANT`) — i když podmínky sedí, zpráva se nepřidá vždy. To rozprostírá feed v čase. Aktuálně každý pool vybírá max 1 záznam za tick.

**Pokud datový pool naroste na stovky záznamů** a bude žádoucí víc zpráv za tick, lze v `Picker.run()` zavolat `pickDistant()` apod. vícekrát, nebo upravit pick funkce aby vracely pole místo jednoho záznamu.

Cooldown (kolik ticků nesmí stejné ID zopakovat): monastery 8, local 6, distant 10. S větším poolem lze cooldown snížit, protože riziko brzkého opakování klesá.

---

## Validace před nasazením

Spusť `node narrative/validate.js` po každé úpravě JSON setů — zkontroluje povinná pole, duplicitní ID a základní konzistenci.

---

*CHRONICON narrative schema v1 | Červen 2026*
