// ============================================
//  CHRONICON — State
//  Port z Monasterium GameState do Node.js.
//  Rozšířen o actors (Betlem vzor) a GM sekci.
//  Tento modul je jediný zdroj pravdy.
//  Nic jiného nesmí měnit state přímo.
// ============================================

'use strict';

const GameState = {

  // --- Time ---
  time: {
    year:          1465,
    season:        0,         // 0=Jaro 1=Léto 2=Podzim 3=Zima
    day:           1,         // aktuální den v sezóně (1–90)
    daysPerSeason: 90,
    totalTick:     0,         // celkový počet ticků od startu
  },

  // --- Resources (klášterní zásoby) ---
  resources: {
    grain: {
      value: 50,
      rate:  0,
      min:   0,
      max:   9999,
    },
    wood: {
      value: 30,
      rate:  0,
      min:   0,
      max:   9999,
    },
    grose: {
      value: 20,
      rate:  0,
      min:   0,
      max:   9999,
    },
    piety: {
      value: 10,
      rate:  0,
      min:   0,
      max:   9999,
    },
  },

  // --- Virtue ---
  virtue: {
    value:  3,
    min:  -10,
    max:   10,
  },

  // --- Monks ---
  monks: {
    total: 3,
    assignments: {
      fields:      0,
      woodcutting: 0,
      prayer:      0,
      scriptorium: 0,
    },
  },

  // --- Production rates per monk per day ---
  productionRates: {
    fields:      { grain: 2.0 },
    woodcutting: { wood:  1.5 },
    prayer:      { piety: 1.0, grose: 0.3 },
    scriptorium: { manuscripts: 0.05 },
  },

  // --- Consumption per monk per day ---
  consumption: {
    grain: 0.5,
  },

  // --- Season stats accumulator ---
  seasonStats: {
    grainProduced: 0,
    woodProduced:  0,
    pietyGained:   0,
    groseEarned:   0,
  },

  // --- Weather ---
  weather: {
    key:  'spring_clear',
    name: 'Jasno',
    icon: '☀️',
    desc: 'Mírné slunce. Pole i cesty jsou schůdné.',
  },

  // --- Actors (Betlem vzor — klášterní síť) ---
  actors: {
    monastery: {
      id:       'monastery',
      label:    'Klášter',
      wealth:   50,       // zásoby/bohatství (0–100)
      mood:     70,       // nálada komunity (0–100)
      piety:    40,       // zbožnost (0–100)
      relations: {
        vesnicane:  20,
        valach:    -10,
        kovar:      10,
        inkvizitor:  0,
      },
    },
    vesnicane: {
      id:       'vesnicane',
      label:    'Vesničané',
      wealth:   35,
      mood:     50,
      stores:   40,       // zásoby jídla (0–100)
      relations: {
        monastery: 20,
        valach:    30,
        kovar:     20,
      },
    },
    valach: {
      id:       'valach',
      label:    'Valach',
      wealth:   25,
      mood:     60,
      herd:     12,       // počet zvířat ve stádě
      relations: {
        monastery: 10,
        vesnicane: 40,
        kovar:      5,
      },
    },
    kovar: {
      id:       'kovar',
      label:    'Kovář',
      wealth:   45,
      mood:     65,
      relations: {
        monastery: 15,
        vesnicane: 50,
        valach:     5,
      },
    },
    inkvizitor: {
      id:       'inkvizitor',
      label:    'Inkvizitor',
      wealth:   80,
      mood:     50,
      tension:  0,        // 0–100: roste při heretických eventech
      active:   false,    // aktivuje se při tension > 60
      relations: {
        monastery: 0,
      },
    },
  },

  // --- GM override sekce ---
  // Načítána z gm/gm_input.json každý tick přes gm_override.js
  gm: {
    abbot_name:       'Bratr Augustin',
    abbot_mood:       'klidný',
    abbot_virtue:     7,
    abbot_portrait:   null,
    scrinium_open:    true,
    abbot_message:    null,
    unlock_flag:      null,   // GM může poslat obecný unlock flag (např. 'columbarium_available')
    feast:            null,   // GM svátek: { active: true, name_cs, name_en } → mše ve Scriptoriu ×2
    tension_modifier: 0,    // GM může zesílit dramatičnost
    event_inject:     null, // GM může vynutit konkrétní event ID
  },

  // --- Chronicle log ---
  // array of { text, type, icon, source, tick, season, year, day }
  log: [],

  // --- Chain event queue ---
  // Serializovaná fronta chain eventů (Betlem vzor)
  _chainQueue: [],

  // --- Chronicle cooldown tracker ---
  // { 'key': { tick, text } } — pro addChronicleOnce
  _lastChronicle: {},

  // --- Flags ---
  flags: {
    started:            false,
    paused:             false,
    consecutiveFamines: 0,
    winterCascade:      null,
  },

};

// ============================================
//  State Helpers
//  Pure funkce čtoucí ze state.
// ============================================

const StateHelpers = {

  idleMonks() {
    const assigned = Object.values(GameState.monks.assignments)
                           .reduce((sum, n) => sum + n, 0);
    return GameState.monks.total - assigned;
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

  resetSeasonStats() {
    const s = GameState.seasonStats;
    s.grainProduced = 0;
    s.woodProduced  = 0;
    s.pietyGained   = 0;
    s.groseEarned   = 0;
  },

  // Vrátí herní datum jako čitelný string
  dateString() {
    const t = GameState.time;
    return `${StateHelpers.seasonIcon()} ${StateHelpers.seasonName()}, Léta Páně ${t.year}, den ${t.day}`;
  },

};

module.exports = { GameState, StateHelpers };
