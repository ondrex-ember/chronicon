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
      // Zatím čistě GM-ruční (Abbot panel) — automatický výpočet je V2, viz _calendar().
      feast: GameState.gm.feast || null,

      // Půst (GM přebíjí, jinak automatický výpočet dle skutečného data):
      // Scriptorium calcPrice čte → ryby ×1.5, maso ×0.5. null = obyčejný den.
      fast: GameState.gm.fast || Snapshot._computeFast(),

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

      // V2: dynamický seznam aktérů (Betlém model, profil 'ricni') —
      // NAHRAZUJE starý pevný seznam {monastery,vesnicane,valach,inkvizitor}.
      // Abbot-panel čte starý tvar — bude potřebovat vlastní update (plán, ne teď).
      actors: GameState.actors.map(a => ({
        id: a.id, label: a.label, profession: a.profession,
        wealth: Math.round(a.wealth), mood: Math.round(a.mood),
        stores: Math.round(a.stores), status: a.status,
      })),

      region: {
        tension:   Math.round(GameState.globalTension),
        goldenAge: GameState.goldenAge,
      },

      // Kurátorované eventy pro Scriptorium (Sprint 2/3) — zatím vždy prázdné,
      // no-op, dokud parser vrstva nevznikne. Bezpečné přidání, nic dnes toto pole nečte.
      advisory_events: [],

      // V2: stará fake-ekonomika (grain/wood/grose/piety) odstraněna — nikdy
      // nefungovala (assignments se nikdy nenastavily, obilí trvale na 0).
      // Abbot-panel na ni měl odkaz — dostane vlastní update.

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

  // ── Velikonoce (algoritmus Meeuse/Jones/Butcher) — identický se Scriptorium
  //    client `systems/calendar.js` CalendarSystem.getEaster(), aby oba systémy
  //    počítaly stejné datum ze stejného reálného roku.
  _getEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  },

  // Automatický postní den — počítáno ze SKUTEČNÉHO reálného data (ne z
  // Chronicon fikčního time modelu). Postní dny: každá středa a pátek celý
  // rok + celá postní doba (Popeleční středa → Velikonoce). Vigilie svátků
  // a Advent zatím vynechány (V2 — vyžadovalo by sdílet celou feastDays
  // databázi ze Scriptorium client repa).
  _computeFast() {
    const now   = new Date();
    const year  = now.getFullYear();
    const easter = Snapshot._getEaster(year);
    const easterDate = new Date(year, easter.month - 1, easter.day);
    const ashDate = new Date(easterDate); ashDate.setDate(easterDate.getDate() - 46);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dow = today.getDay(); // 0=Ne .. 6=So
    const inLent = today >= ashDate && today < easterDate;
    const isWed = dow === 3;
    const isFri = dow === 5;

    if (!inLent && !isWed && !isFri) return null;

    const name_cs = inLent ? 'Postní doba' : (isWed ? 'Postní středa' : 'Postní pátek');
    const name_en = inLent ? 'Lent'        : (isWed ? 'Fasting Wednesday' : 'Fasting Friday');
    return { active: true, name_cs, name_en };
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
