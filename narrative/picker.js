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

  // --- Hlavní volání z cron.js ---
  run() {
    Picker.pickMonastery();
    Picker.pickLocal();
    Picker.pickDistant();
  },

};

module.exports = { Picker };