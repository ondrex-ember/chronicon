// ============================================
//  CHRONICON — Snapshot
//  Sestaví chronicon_snapshot.json z GameState.
//  Volat po každém tiku, po saveState().
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const { GameState, StateHelpers } = require('../core/state.js');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'chronicon_snapshot.json');

const Snapshot = {

  build() {
    const now       = new Date();
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      version:     2,
      generated:   now.toISOString(),
      valid_until: validUntil.toISOString(),

      abbot: {
        name:          GameState.gm.abbot_name,
        mood:          GameState.gm.abbot_mood,
        virtue:        GameState.gm.abbot_virtue,
        portrait:      GameState.gm.abbot_portrait,
        scrinium_open: GameState.gm.scrinium_open,
        message:       GameState.gm.abbot_message,
      },

      // Obecný unlock flag pro Scriptorium (GameState.flags[x] = true).
      // null pokud GM nic nenastavil — Scriptorium strana je defenzivní no-op.
      unlockFlag: GameState.gm.unlock_flag,

      // Svátek (GM): Scriptorium serveMass čte → vliv ×2. null = obyčejný den.
      feast: GameState.gm.feast || null,

      weather: {
        key:              GameState.weather.key,
        name:             GameState.weather.name,
        icon:             GameState.weather.icon,
        desc:             GameState.weather.desc,
        season:           GameState.time.season,
        modifier_grain:   Snapshot._wx('grain'),
        modifier_wood:    Snapshot._wx('wood'),
      },

      time: {
        year:       GameState.time.year,
        season:     GameState.time.season,
        season_name: StateHelpers.seasonName(),
        season_icon: StateHelpers.seasonIcon(),
        day:        GameState.time.day,
        total_tick: GameState.time.totalTick,
        date_string: StateHelpers.dateString(),
      },

      actors: {
        monastery: {
          mood:   GameState.actors.monastery.mood,
          wealth: GameState.actors.monastery.wealth,
          piety:  GameState.actors.monastery.piety,
        },
        vesnicane: {
          mood:   GameState.actors.vesnicane.mood,
          stores: GameState.actors.vesnicane.stores,
        },
        valach: {
          mood: GameState.actors.valach.mood,
          herd: GameState.actors.valach.herd,
        },
        inkvizitor: {
          active:  GameState.actors.inkvizitor.active,
          tension: GameState.actors.inkvizitor.tension,
        },
      },

      resources: {
        grain: GameState.resources.grain.value,
        wood:  GameState.resources.wood.value,
        grose: GameState.resources.grose.value,
        piety: GameState.resources.piety.value,
      },

      // Posledních 20 chronicle záznamů
      chronicle: GameState.log.slice(0, 20),

      // Filtrované pohledy dle source
      chronicle_local:    GameState.log.filter(e =>
        e.source === 'local_events' || e.source === 'monastery_internal'
      ).slice(0, 10),

      chronicle_distant:  GameState.log.filter(e =>
        e.source === 'distant_events'
      ).slice(0, 10),

      church_calendar: Snapshot._calendar(),
    };
  },

  write() {
    try {
      const dir = path.dirname(SNAPSHOT_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const snapshot = Snapshot.build();
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(
        `[CHRONICON] Snapshot zapsán — tick ${GameState.time.totalTick},` +
        ` ${snapshot.time.date_string}`
      );
      return snapshot;
    } catch (err) {
      console.error('[CHRONICON] Chyba při zápisu snapshotu:', err.message);
      return null;
    }
  },

  // Pomocná — vrátí weather multiplier pro daný klíč
  _wx(key) {
    const w = GameState.weather;
    if (!w || !w.key) return 1.0;
    // Multipliers jsou na WeatherSystem.current — přímý přístup přes require
    try {
      const { WeatherSystem } = require('../core/weather.js');
      const mx = WeatherSystem.getMultipliers();
      return mx[key] !== undefined ? mx[key] : 1.0;
    } catch {
      return 1.0;
    }
  },

  // Jednoduchý church calendar — V1: jen sezóna + den roku
  // V2: přidat svátky, půsty, církevní kalendář
  _calendar() {
    const t       = GameState.time;
    const dayOfYear = (t.season * t.daysPerSeason) + t.day;

    return {
      day_of_year: dayOfYear,
      season:      StateHelpers.seasonName(),
      season_icon: StateHelpers.seasonIcon(),
      year:        t.year,
      note:        null,   // V2: "Sv. Václav", "Advent", "Velikonoce" atd.
    };
  },

};

module.exports = { Snapshot };
