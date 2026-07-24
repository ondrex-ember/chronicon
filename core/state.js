// ============================================
//  CHRONICON v2 — State
//  V1→V2: monks/resources/productionRates/consumption (nikdy
//  nefungující stub — assignments se nikdy nenastavily, obilí
//  trvale na 0 od ticku ~33) NAHRAZENO modelem z Betlém (actors/
//  produkční síť/vztahy). time/weather/virtue/gm/log beze změny
//  — to je kompatibilní kontrakt se Scriptoriem i abbot-panelem.
//  Tento modul je jediný zdroj pravdy.
// ============================================

'use strict';

const { RICNI_ACTORS, RICNI_RELATIONS } = require('../data/actors.js');

const GameState = {

  // --- Time --- (beze změny, kontrakt s abbot-panelem)
  time: {
    year:          1465,
    season:        0,         // 0=Jaro 1=Léto 2=Podzim 3=Zima
    day:           1,         // aktuální den v sezóně (1–90)
    daysPerSeason: 90,
    totalTick:     0,         // celkový počet ticků od startu (1 tick = 6h, kontrakt se Scriptoriem)
  },

  // --- Weather --- (beze změny — WeatherSystem.js se v V2 nemění, Sprint 2 přinese Open-Meteo)
  weather: {
    key:  'spring_clear',
    name: 'Jasno',
    icon: '☀️',
    desc: 'Mírné slunce. Pole i cesty jsou schůdné.',
  },

  // --- Virtue --- (beze změny, zachováno i když dnes nikde nečteno — neškodí)
  virtue: {
    value:  3,
    min:  -10,
    max:   10,
  },

  // --- NOVÉ: Actors & Economy (Betlém model, profil 'ricni') ---
  profile: 'ricni',
  epoch: 'pozdni',            // 1465 = pozdní středověk (Betlém EPOCH_START_YEARS.pozdni: 1410)
  estateName: 'Olomoucké panství',
  week: 0,                    // roste 1× za týdenní tick, pro T.week()/cooldowny eventů
  globalTension: 20,
  les: 60,
  goldenAge: false,
  goldenAgeTicks: 0,
  rescueActionsLeft: 3,        // rezerva pro budoucí GM zásah (Sprint 2+), engine sám nikdy nekolabuje
  totalPopulation: 10000,      // pozaďová populace kraje (mimo 10 sledovaných aktérů) — demografický čítač
  totalDeaths: 0,
  totalFuneralEvents: 0,       // monotónní čítač — Scriptorium (před Proboštem) z rozdílu tvoří pasivní pohřby
  pendingSepulturas: [],       // fronta žádostí o právo sepultury (bohatí zesnulí), max 10, FIFO
  pendingHospites: [],         // fronta kandidátů na Infirmarium (aktéři v krizi), max 10, FIFO
  pendingStudovna: null,       // max 1 aktivní žádost Vrchnosti o Studovnu, ne fronta
  pendingPocestny: [],         // fronta pocestných (Vlna 1 / ubytovna-mrd.md §8c-B), max 10 FIFO, despawn po 2 týdnech (viz engine.js)
  _eventCooldowns: {},         // { eventId: ticksLeft } — pro EVENT_REGISTRY
  actors: RICNI_ACTORS.map(a => ({
    ...a,
    status: 'stable',
    ticksActive: 0,
    ticksInCrisis: 0,
    relations: { ...RICNI_RELATIONS[a.id] },
  })),

  // --- GM override sekce --- (beze změny, zůstává marginální)
  gm: {
    abbot_name:       'Bratr Augustin',
    abbot_mood:       'klidný',
    abbot_virtue:     7,
    abbot_portrait:   null,
    scrinium_open:    true,
    abbot_message:    null,
    abbot_message_en: null,
    feast:            null,   // GM svátek: { active: true, name_cs, name_en } → mše ve Scriptoriu ×2
    fast:             null,   // GM půst: { active: true, name_cs, name_en } → ryby ×1.5, maso ×0.5 na trhu
    tension_modifier: 0,
    event_inject:     null,
  },

  // --- Unlock flags accumulator --- trvalý, nikdy se nepřepisuje, jen roste.
  // gm_input.json.unlock_flags = dávka k přidání tento tik (GmOverride ji smerguje sem).
  // Snapshot posílá VŽDY celé pole → každý hráč (starý i nový) dostane celou historii.
  unlockedFlags: [],

  // --- Chronicle log --- (beze změny — kontrakt se Scriptoriem: text_cs/text_en/icon/source/tick/id)
  log: [],

  // --- Chain event queue --- (beze změny stub, Sprint 1b)
  _chainQueue: [],

  // --- Chronicle cooldown tracker ---
  _lastChronicle: {},

  // --- Flags ---
  flags: {
    started: false,
    paused:  false,
  },

};

// ============================================
//  State Helpers
// ============================================

const StateHelpers = {

  // Odvodí { year, season, day } z reálného data (Europe/Prague), stejná
  // pravidla hranic měsíců jako Scriptorium._getApiarySeason() (3-5 Jaro,
  // 6-8 Léto, 9-11 Podzim, 12/1/2 Zima). Rok napevno 1465 — kontrakt se
  // Scriptoriem, kde se reálný rok nikdy neukazuje.
  realCalendar() {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const m = parseInt(parts.find(p => p.type === 'month').value, 10);
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);

    let season, seasonStartY, seasonStartM;
    if (m >= 3 && m <= 5)       { season = 0; seasonStartY = y;                seasonStartM = 3;  }
    else if (m >= 6 && m <= 8)  { season = 1; seasonStartY = y;                seasonStartM = 6;  }
    else if (m >= 9 && m <= 11) { season = 2; seasonStartY = y;                seasonStartM = 9;  }
    else                        { season = 3; seasonStartY = (m === 12 ? y : y - 1); seasonStartM = 12; }

    const seasonStart = Date.UTC(seasonStartY, seasonStartM - 1, 1);
    const current      = Date.UTC(y, m - 1, d);
    const day = Math.round((current - seasonStart) / 86400000) + 1;

    return { year: 1465, season, day };
  },

  seasonName() {
    return ['Jaro', 'Léto', 'Podzim', 'Zima'][GameState.time.season];
  },

  seasonIcon() {
    return ['🌱', '☀️', '🍂', '❄️'][GameState.time.season];
  },

  isWinter() {
    return GameState.time.season === 3;
  },

  changeVirtue(delta) {
    const v = GameState.virtue;
    v.value = Math.max(v.min, Math.min(v.max, v.value + delta));
  },

  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  dateString() {
    const t = GameState.time;
    return `${StateHelpers.seasonIcon()} ${StateHelpers.seasonName()}, Léta Páně ${t.year}, den ${t.day}`;
  },

  livingActors() {
    return GameState.actors.filter(a => a.status !== 'mrtvy');
  },

};

module.exports = { GameState, StateHelpers };
