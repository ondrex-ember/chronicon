# CHRONICON

Generativní engine živého světa pro [Scriptorium](https://myscriptorium.cz).

Tikuje 4× denně. Exportuje `data/chronicon_snapshot.json` — veřejný feed který Scriptorium fetchuje při startu.

---

## Snapshot URL

```
https://raw.githubusercontent.com/ondrex-ember/chronicon/main/data/chronicon_snapshot.json
```

---

## Spuštění lokálně

```bash
npm install
node cron.js --once    # jeden tick
node cron.js --dev     # tick každých 30s
node cron.js           # produkční scheduler (6/12/18/00)
```

---

## Struktura

```
core/        GameState, WeatherSystem, GameEngine
gm/          GM override — gm_input.json edituje Ondrex ručně
narrative/   Datové sety pro chronicle feed (distant, local, monastery)
output/      Snapshot builder
data/        Generované soubory (gamestate.json, chronicon_snapshot.json)
```

---

## Chronicle feed — tři vrstvy

| Vrstva | Zdroj | Popis |
|--------|-------|-------|
| Místní drby | `local_events_v1.json` | Olomouc a okolí, zpoždění 1–5 dní |
| Zprávy z dálky | `distant_events_v1.json` | Froissart, Datini, Coroner's Rolls |
| Interní klášter | `monastery_internal_v1.json` | Podmíněno sezónou a počasím |
| Engine | GameEngine + actors | Generativní, živý svět |
| GM vsuvky | `gm_input.json` | Ondrex — zlaté zprávy od opata |

---

## Herní čas

Hra se odehrává v roce **1465, Olomouc**. Kalendář je transponovaný na reálný čas — dnes v reálu = dnes v roce 1465.

---

*Pécuchet pro Bouvarda | CHRONICON V1 | Červen 2026*
