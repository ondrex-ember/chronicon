// ============================================
//  CHRONICON v2 — Engine
//  V1→V2: computeRates()/applyResources() (monk economy, nikdy
//  fungující — assignments nikdy nenastaveny) NAHRAZENO týdenní
//  ekonomikou z Betlém (produkce/spotřeba/vztahy/napětí), s
//  NATVRDO vynuceným "nikdy nekolabuje" pravidlem (viz bod 6
//  v runWeeklyEconomy — Betlém "fenix" chování, ale bez volby).
//
//  Kadence: 1 tick = 6h (4×/den, kontrakt se Scriptoriem).
//  Den se posouvá jednou za 4 ticky (oprava proti V1, kde se
//  "day" posouval každý tick — 4× rychleji, než napovídal název).
//  Týdenní ekonomika běží jednou za 28 ticků (7 dní).
// ============================================

'use strict';

const { GameState, StateHelpers } = require('./state.js');
const { WeatherSystem }           = require('./weather.js');
const {
  PROD_TABLE, SEASON_MODS, COMMODITY_VALUE, SEASON_DEMAND,
  PROD_BLOCK_TEXTS, RELATION_THRESHOLD_TEXTS,
} = require('../data/actors.js');

// ============================================
//  GameLog (beze změny z V1)
// ============================================

const GameLog = {

  MAX_ENTRIES: 80,

  add(text, options = {}) {
    const time = GameState.time;

    const entry = {
      text,
      text_cs: options.text_cs || text,
      text_en: options.text_en || null,
      type:   options.type   || 'A',
      icon:   options.icon   || null,
      source: options.source || 'engine',
      tick:   time.totalTick,
      year:   time.year,
      season: StateHelpers.seasonName(),
      day:    time.day,
    };

    GameState.log.unshift(entry);

    if (GameState.log.length > GameLog.MAX_ENTRIES) {
      GameState.log.pop();
    }

    return entry;
  },

  addOnce(key, text, options = {}, cooldownTicks = 3) {
    const last = GameState._lastChronicle[key];
    if (last && (GameState.time.totalTick - last.tick) < cooldownTicks) {
      return null;
    }
    const entry = GameLog.add(text, options);
    GameState._lastChronicle[key] = { tick: GameState.time.totalTick, text };
    return entry;
  },

};

// ============================================
//  Relation threshold helper (port z Betlém checkRelThresholds)
// ============================================

function checkRelThreshold(prev, next) {
  if (prev >= -20 && next < -20) return 'negative_20';
  if (prev >= -40 && next < -40) return 'negative_40';
  if (prev >= -60 && next < -60) return 'negative_60';
  if (prev <= 40 && next > 40) return 'positive_40';
  if (prev <= 75 && next > 75) return 'positive_75';
  return null;
}

// ============================================
//  GameEngine
// ============================================

const GameEngine = {

  // Hlavní tick — volán 4× denně z cron.js
  tick() {
    GameState.time.totalTick++;

    // 1. Počasí (beze změny z V1 — Sprint 2 přinese Open-Meteo)
    const weatherChronicle = WeatherSystem.roll();
    if (weatherChronicle) {
      GameLog.add(weatherChronicle, {
        type:   'A',
        icon:   GameState.weather.icon,
        source: 'weather',
      });
    }

    // 2. Posun dne — jednou za 4 ticky (1 den = 6h × 4), oprava proti V1
    if (GameState.time.totalTick % 4 === 0) {
      GameEngine.advanceDay();
    }

    // 3. Týdenní ekonomika (Betlém model) — jednou za 28 ticků (7 dní)
    if (GameState.time.totalTick % 28 === 0) {
      GameEngine.runWeeklyEconomy();
    }
  },

  advanceDay() {
    const time = GameState.time;
    time.day++;

    if (time.day > time.daysPerSeason) {
      GameEngine.onSeasonEnd();
    }
  },

  onSeasonEnd() {
    const time      = GameState.time;
    const nextSeason = (time.season + 1) % 4;
    const nextYear   = nextSeason === 0 ? time.year + 1 : time.year;

    const seasonNames = ['Jaro', 'Léto', 'Podzim', 'Zima'];
    const seasonIcons = ['🌱', '☀️', '🍂', '❄️'];

    GameLog.add(
      `${seasonIcons[nextSeason]} ${seasonNames[nextSeason]} Léta Páně ${nextYear} začíná.`,
      { type: 'A', icon: seasonIcons[nextSeason], source: 'engine' }
    );

    time.season = nextSeason;
    time.year   = nextYear;
    time.day    = 1;

    WeatherSystem.init();
  },

  // ── Týdenní ekonomika (port z Betlém runWeeklyTick, jádro) ──────────────
  runWeeklyEconomy() {
    const actors = GameState.actors;
    const seasonIdx = GameState.time.season;

    actors.forEach(a => { a._pulseReason = null; });

    // 1. Produkce (blokace při mrtvém dodavateli, 50% při krizi dodavatele)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const pDef = PROD_TABLE[a.id];
      if (!pDef) return;

      let blocked = false, crisisInDeps = false;
      const missing = [];
      pDef.deps.forEach(depId => {
        const dep = actors.find(x => x.id === depId);
        if (!dep || dep.status === 'mrtvy') { blocked = true; missing.push(depId); }
        else if (dep.status === 'krize' || dep.status === 'zanikajici') crisisInDeps = true;
      });

      if (blocked) {
        const key = missing[0] ? (a.id + '_' + missing[0]) : null;
        const pool = (key && PROD_BLOCK_TEXTS[key]) || PROD_BLOCK_TEXTS.default;
        a._pulseReason = pool[Math.floor(Math.random() * pool.length)].replace('{actor}', a.label);
        a.mood = Math.max(0, a.mood - 12);
        return;
      }

      let prodMultiplier = 1;
      if (crisisInDeps) {
        prodMultiplier *= 0.5;
        a._pulseReason = 'Výroba omezena na 50 % kvůli potížím dodavatelů.';
      }

      const sMods = SEASON_MODS[a.id] || SEASON_MODS.default;
      const [seasonProdMod, seasonMoodDelta] = sMods[seasonIdx] || [1.0, 0];
      prodMultiplier *= seasonProdMod;
      a.mood = Math.min(100, Math.max(0, a.mood + seasonMoodDelta));

      if (a.mood < 30) prodMultiplier *= (a.mood / 100);
      else if (a.mood > 80) prodMultiplier *= 1.25;

      const rawProd = pDef.base * prodMultiplier;
      a.stores = Math.min(a.storesMax || 80, a.stores + rawProd);
    });

    // 2. Spotřeba a obchod (přebytek → bohatství)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const pDef = PROD_TABLE[a.id];
      const produces = pDef ? pDef.produces : '';
      const cons = 2.0;

      if (a.stores >= cons) {
        a.stores -= cons;
        const surplus = a.stores * 0.35;
        if (surplus > 0.5) {
          const val = COMMODITY_VALUE[produces] || 1.0;
          const sDemand = (SEASON_DEMAND[produces] && SEASON_DEMAND[produces][seasonIdx]) || 1.0;
          const revenue = surplus * val * sDemand;
          a.stores -= surplus;
          a.wealth = Math.min(100, a.wealth + revenue);
        }
      } else {
        a.stores = 0;
        a.mood = Math.max(0, a.mood - 16);
        a.wealth = Math.max(0, a.wealth - 10);
        a._pulseReason = 'Hladoví! Zásoby potravin a materiálu došly.';
      }
    });

    // 3. Vztahy — jemný posun podle společné nálady, s prahovými hláškami
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      Object.keys(a.relations).forEach(otherId => {
        const other = actors.find(x => x.id === otherId);
        if (!other || other.status === 'mrtvy') return;
        const moodPair = (a.mood + other.mood) / 2;
        const drift = moodPair > 60 ? 0.6 : moodPair < 35 ? -0.6 : 0;
        if (drift === 0) return;

        const prev = a.relations[otherId] || 0;
        const next = Math.max(-100, Math.min(100, prev + drift));
        a.relations[otherId] = next;

        const crossed = checkRelThreshold(prev, next);
        if (crossed && RELATION_THRESHOLD_TEXTS[crossed]) {
          const pool = RELATION_THRESHOLD_TEXTS[crossed];
          const txt = pool[Math.floor(Math.random() * pool.length)]
            .replace('{a}', a.label).replace('{b}', other.label);
          GameLog.addOnce('rel_' + a.id + '_' + otherId + '_' + crossed, txt,
            { type: 'C', icon: '🤝', source: 'monastery_internal' }, 12);
        }
      });
    });

    // 4. Přechody stavu — krize/zánik/smrt (5 týdnů souvislé bídy → smrt)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      if (a.wealth < 22 || a.mood < 22) {
        a.ticksInCrisis += 1;
        if (a.ticksInCrisis >= 5) {
          a.status = 'mrtvy';
          GameLog.add(
            `Smutná zpráva obletěla kraj. ${a.label} (${a.profession}) podlehl dlouhodobému úpadku a bídě.`,
            { type: 'E', icon: '☠️', source: 'monastery_internal' }
          );
          return;
        }
        a.status = (a.wealth < 10 || a.mood < 10) ? 'zanikajici' : 'krize';
      } else {
        a.ticksInCrisis = 0;
        a.status = (a.wealth > 78 && a.mood > 78) ? 'prosperujici' : 'stable';
      }
    });

    // 5. Globální napětí + Zlatá éra
    const living = actors.filter(a => a.status !== 'mrtvy');
    const avgMood   = living.reduce((acc, a) => acc + a.mood, 0) / living.length;
    const avgWealth = living.reduce((acc, a) => acc + a.wealth, 0) / living.length;

    let tensionDelta = (50 - avgMood) * 0.16;
    if (GameState.les < 30) tensionDelta += 1.8;
    const crisisCount = living.filter(a => a.status === 'krize' || a.status === 'zanikajici').length;
    tensionDelta += crisisCount * 1.4;
    GameState.globalTension = Math.min(100, Math.max(0, GameState.globalTension + tensionDelta));

    if (avgMood > 75 && avgWealth > 75 && GameState.globalTension < 22) {
      if (!GameState.goldenAge) {
        GameState.goldenAge = true;
        GameLog.add(
          'Zlatá éra kraje započala! Lidé oslavují mír, sýpky přetékají a vrchnost se těší úctě.',
          { type: 'E', icon: '✨', source: 'monastery_internal' }
        );
      }
      GameState.goldenAgeTicks += 1;
    } else if (GameState.goldenAge) {
      GameState.goldenAge = false;
      GameState.goldenAgeTicks = 0;
      GameLog.add(
        'Zlatá éra kraje skončila. Každodenní starosti a pnutí se vracejí.',
        { type: 'E', icon: '☁️', source: 'monastery_internal' }
      );
    }

    // 6. NATVRDO: kraj nikdy nevymře. Betlém "standard" by tu skončil hrou —
    // my vždy provedeme zotavení (ekvivalent Betlém "fenix", bez volby).
    const vrc = actors.find(x => x.id === 'vrchnost');
    const coreActors = actors.filter(a => a.core);
    const deadCores = coreActors.filter(a => a.status === 'mrtvy').length;
    const collapseTriggered =
      (!vrc || vrc.status === 'mrtvy') ||
      (deadCores >= coreActors.length * 0.5) ||
      (GameState.globalTension >= 100);

    if (collapseTriggered) {
      actors.forEach(a => {
        if (a.status === 'mrtvy' || a.status === 'zanikajici' || a.status === 'krize') {
          a.status = 'stable';
          a.mood   = Math.max(a.mood, 60);
          a.wealth = Math.max(a.wealth, 35);
          a.stores = Math.max(a.stores, 25);
          a.ticksInCrisis = 0;
        }
      });
      GameState.globalTension = Math.min(GameState.globalTension, 40);
      GameLog.add(
        'Kraj prošel těžkou zkouškou, ale vydržel. Nový úrodný čas začíná — lidé se vzchopili a práce pokračuje.',
        { type: 'E', icon: '🕊️', source: 'monastery_internal' }
      );
    }
  },

  // Inicializace při prvním startu
  init() {
    GameState.flags.started = true;
    WeatherSystem.init();

    GameLog.add(
      `Klášter se probouzí. ${StateHelpers.dateString()}.`,
      { type: 'A', icon: '✝️', source: 'engine' }
    );
  },

};

module.exports = { GameEngine, GameLog };
