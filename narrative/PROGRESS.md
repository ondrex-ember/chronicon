# CHRONICON narrative — Progress tracker

Sleduje co už bylo vytěženo z jednotlivých pramenů, aby se dávky z NotebookLM
nepřekrývaly tematicky. ID kolize řeší `merge.js` automaticky — tohle je
o obsahu, ne o číslech.

Cíl: **300+ záznamů na pool** (distant, local, monastery_internal).

---

## distant_events_v1.json — cíl 300+

| zdroj | aktuální počet | cílový počet | pokryto | zbývá |
|---|---|---|---|---|
| `froissart` | 10 | ~80 | stoletá válka — obecné bitvy, Calais, turnaj, sňatek, **bitva u Kresčaku (vč. smrti Jana Lucemburského)** | Skotské tažení, Édouard III, černý princ, vlámská povstání |
| `datini` | 35 | ~80 | Avignon vlna, Barcelona piráti, Florencie mor, rodina, Janov koření, Londýn clo, účty, **zbroj/zbrojíři, žoldnéřská ekonomika, luxusní zboží (truhly/obrazy/hedvábí), pojištění otroků, daně a nucené půjčky, zemědělská správa Il Palco, královská návštěva, dary a politika darů, spor s cechem, bankovní směnky, mapy** | Plachetnice/galéry detaily, vztahy s dalšími fontacos (Pisa, Benátky), další epizody moru |
| `coroner_rolls` | 5 | ~50 | opilecké nehody, led, pád z okna, rvačka, střecha | Utonutí, požáry, dětské nehody, řemeslné nehody, soudní spory o náhradu |
| `zbraslavska` | 5 | ~40 | král v klášteře, vražda Václava III, počasí, pohřeb šlechtičny, nájezd | Lucemburský nástup, korunovace, hladomor, mor 1318, církevní spory |
| `stare_letopisy` (Praha) | 6 | ~50 | vlci, poprava, ceny chleba, král Jiří, zamrzlá Vltava, hradby | Utrakvisté/katolíci napětí (opatrně, neutrálně), univerzita, požáry, povodně |

**Poznámka k zbraslavské kronice a Praze:** Jiří z Poděbrad je už zmíněn v `local_018`. Při psaní nových `stare_letopisy` záznamů dávej pozor na konzistenci s touto existující linkou (posel od krále, rada je opatrná).

---

## local_events_v1.json — cíl 300+

| téma | aktuální počet | cílový počet | pokryto | zbývá |
|---|---|---|---|---|
| Olomouc město | ~14 | ~120 | trh, soud, radnice, koroner, farní matrika | Cechy, městské brány, hradby, biskupství, škola |
| okolní města | ~16 | ~150 | Litovel, Prostějov, Přerov, Šternberk, Kroměříž, Lipník, Fulnek, Mohelnice, Kelč, Hranice, Uherské Hradiště, Bystřice, Uničov | Konice, Vyškov, Tovačov, Zábřeh, Šumperk — zatím nepoužité |

**Poznámka:** Lokální zdroj nemá jeden konkrétní pramen jako distant — je to syntetická tvorba v duchu žánrů (koronerské zápisy, trhové knihy, farní matriky). Pro NotebookLM lze použít stejné anglické prameny (Coroner's Rolls, Bourgeois-style deníky) jako inspiraci stylu, jen "přesadit" do moravského kontextu.

---

## monastery_internal_v1.json — cíl 300+

| role | aktuální počet | cílový počet | pokryto | zbývá |
|---|---|---|---|---|
| převor | 6 | ~50 | mouchy, dřevo, mlha, myši, povodeň, obleva | Návštěvy biskupa, kázeňské případy, hospodaření |
| skriptor | 4 | ~40 | moucha na iniciále, zimní světlo, vlhkost, podzimní šero | Konkrétní rukopisy, chyby v opisu, vzácné knihy |
| sklepmistr | 3 | ~30 | mrznoucí pivo, dobré víno, slabý chmel | Sýrárna, medovina, octárna |
| zahradník | 5 | ~40 | levandule, pozdní mráz, ptáci, kvetoucí stromy, povodeň | Zeleninové záhony, štěpování, plevel, škůdci |
| kuchmistr | 4 | ~40 | postní ryby, plná zásobárna, zabijačka, brouci v obilí | Hostina pro návštěvu, postní omezení, kuchyňský oheň |
| infirmář | 3 | ~30 | nemocní bratři, čerstvé byliny, bodnutí včelou | Epidemie nachlazení, zlomeniny, porod (ve vsi) |
| cantor | 2 | ~25 | chraplavý chór, nádherné officium | Nové noty, hostující zpěvák, ztracený hlas |
| vrátný | 2 | ~25 | poutníci, vlci u brány | Žebráci, podezřelí návštěvníci, zprávy od poslů |

**Důležité pro nové role:** Lze přidat další (bratr knihovník, bratr fortnýř, bratr včelař jako samostatná role) — držet formát "Zápis [role]" a vždy vyplnit `conditions`.

---

## Jak aktualizovat tento soubor

Po každé úspěšně zapojené dávce (`merge.js`):
1. Zvyš "aktuální počet" u příslušného zdroje/tématu
2. Přesuň pokryté téma ze sloupce "zbývá" do "pokryto"
3. Commitni spolu se změnou JSON souboru

---

*CHRONICON narrative progress | Červen 2026*
