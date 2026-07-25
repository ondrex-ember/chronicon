// ============================================
//  CHRONICON — Picker
//  Vybírá záznamy z narrative JSON setů
//  a přidává je do chronicle každý tick.
//
//  Tři pooly:
//    monastery_internal — podmíněno sezónou + počasím
//    local_events       — Olomouc a okolí
//    distant_events     — Froissart, Datini, Coroner
// ============================================

'use strict';

const path = require('path');
const { GameState }     = require('../core/state.js');
const { GameLog }       = require('../core/engine.js');

// Načtení JSON setů (jednou při startu)
const MONASTERY = require('./monastery_internal_v1.json');
const LOCAL     = require('./local_events_v1.json');
const DISTANT   = require('./distant_events_v1.json');
const PORTA     = require('./porta_letters_v1.json');

// ============================================
//  Pomocné funkce
// ============================================

// Odvoď aktuální herní měsíc (1–12) ze sezóny + dne
function currentMonth() {
  const season = GameState.time.season;
  const day    = GameState.time.day;

  // Každá sezóna = 90 dní = 3 měsíce po 30 dnech
  const monthInSeason = Math.floor((day - 1) / 30); // 0, 1, 2

  // Mapping sezóna → první měsíc
  const firstMonth = [3, 6, 9, 12][season];
  const month      = firstMonth + monthInSeason;

  // Prosinec wrap (zima: 12, 1, 2)
  return month > 12 ? month - 12 : month;
}

// Náhodný výběr z poolu (bez váhování — všechny záznamy stejná šance)
function randomPick(pool) {
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Filtr dle month_hint — vrátí true pokud záznam sedí na aktuální měsíc
function monthFits(entry) {
  if (!entry.month_hint) return true;
  return entry.month_hint.includes(currentMonth());
}

// Filtr dle conditions pro porta_letters — sezóna (jako monastery) +
// volitelné meze globalTension. Vše null/chybí = platí vždy.
function portaConditionsFit(entry) {
  const c = entry.conditions || {};
  if (Array.isArray(c.season) && !c.season.includes(GameState.time.season)) return false;
  if (typeof c.tension_min === 'number' && GameState.globalTension < c.tension_min) return false;
  if (typeof c.tension_max === 'number' && GameState.globalTension > c.tension_max) return false;
  return true;
}

// ============================================
//  Picker
//
//  Pravděpodobnostní gates — i když podmínky
//  (sezóna/počasí/month_hint) sedí, zpráva se
//  nepřidá vždy. To rozprostírá feed v čase a
//  dělá ho méně předvídatelným.
//  0 zpráv za tick je výjimečné (~0.75 % šancí).
// ============================================

const PROB_MONASTERY = 0.75;
const PROB_LOCAL     = 0.85;
const PROB_DISTANT   = 0.80;
// Nižší pravděpodobnost + delší cooldown než pasivní chronicle — Porta dopis
// je interaktivní (volba+efekt ve hře), nemá se hromadit ve frontě hráče.
const PROB_PORTA     = 0.55;
const PORTA_COOLDOWN_TICKS = 12; // ~3 dny při 4 ticích/den

const Picker = {

  // --- Monastery internal ---
  // Podmíněno sezónou + weather_key. Cooldown 8 ticků.
  pickMonastery() {
    if (Math.random() > PROB_MONASTERY) return;

    const season     = GameState.time.season;
    const weatherKey = GameState.weather.key;

    const candidates = MONASTERY.filter(entry => {
      // Sezóna musí sedět
      if (!entry.conditions.season.includes(season)) return false;
      // Počasí musí sedět (null = kdykoli)
      if (entry.conditions.weather_keys !== null) {
        if (!entry.conditions.weather_keys.includes(weatherKey)) return false;
      }
      return true;
    });

    if (candidates.length === 0) return;

    const entry = randomPick(candidates);
    if (!entry) return;

    GameLog.addOnce(
      entry.id,
      entry.text_cs,
      {
        type:    entry.type,
        icon:    entry.icon,
        source:  'monastery_internal',
        text_cs: entry.text_cs,
        text_en: entry.text_en || null,
      },
      8
    );
  },

  // --- Local events ---
  // Filtr dle month_hint. Cooldown 6 ticků.
  pickLocal() {
    if (Math.random() > PROB_LOCAL) return;

    const candidates = LOCAL.filter(monthFits);
    if (candidates.length === 0) return;

    const entry = randomPick(candidates);
    if (!entry) return;

    GameLog.addOnce(
      entry.id,
      entry.text_cs,
      {
        type:    entry.type,
        icon:    entry.icon,
        source:  'local_events',
        text_cs: entry.text_cs,
        text_en: entry.text_en || null,
      },
      6
    );
  },

  // --- Distant events ---
  // Filtr dle month_hint. Cooldown 10 ticků.
  pickDistant() {
    if (Math.random() > PROB_DISTANT) return;

    const candidates = DISTANT.filter(monthFits);
    if (candidates.length === 0) return;

    const entry = randomPick(candidates);
    if (!entry) return;

    GameLog.addOnce(
      entry.id,
      entry.text_cs,
      {
        type:    entry.type,
        icon:    entry.icon,
        source:  'distant_events',
        text_cs: entry.text_cs,
        text_en: entry.text_en || null,
      },
      10
    );
  },

  // --- Porta letters (Vrstva 3 — dynamické dopisy) ---
  // Podmínky: sezóna + volitelné meze globalTension. Cooldown vlastní
  // (nesdílí GameLog.add/GameState.log — dopisy nesmí vypadnout z okna
  // posledních 20 chronicle záznamů, než je hráč vůbec uvidí). Ukládá se do
  // GameState.portaLetterHistory jako PLNÝ záznam (včetně choices/effects),
  // ne jen text — Scriptorium ho čte 1:1 ze snapshotu.
  pickPortaLetters() {
    if (Math.random() > PROB_PORTA) return;

    const candidates = PORTA.filter(portaConditionsFit);
    if (candidates.length === 0) return;

    const entry = randomPick(candidates);
    if (!entry) return;

    const cooldownKey = 'porta_' + entry.id;
    const last = GameState._lastChronicle[cooldownKey];
    if (last && (GameState.time.totalTick - last.tick) < PORTA_COOLDOWN_TICKS) return;

    GameState.portaLetterHistory.unshift(Object.assign({}, entry, {
      _pickedTick: GameState.time.totalTick,
    }));
    GameState._lastChronicle[cooldownKey] = { tick: GameState.time.totalTick, text: entry.id };
  },

  // --- Hlavní volání z cron.js ---
  run() {
    Picker.pickMonastery();
    Picker.pickLocal();
    Picker.pickDistant();
    Picker.pickPortaLetters();
  },

};

module.exports = { Picker };
