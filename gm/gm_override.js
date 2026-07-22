// ============================================
//  CHRONICON — GM Override
//  Načítá gm/gm_input.json před každým tikem.
//  Injectuje hodnoty do GameState.gm.
//  Tiché selhání pokud soubor chybí nebo je
//  poškozený — GameState.gm zůstane beze změny.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const { GameState } = require('../core/state.js');

const GM_PATH = path.join(__dirname, 'gm_input.json');

// Povolené klíče — ochrana před neočekávanými poli v JSON
const ALLOWED_KEYS = [
  'abbot_name',
  'abbot_mood',
  'abbot_virtue',
  'abbot_portrait',
  'scrinium_open',
  'abbot_message',
  'abbot_message_en',
  'abbot_message_id',
  'abbot_message_one_shot',
  'tension_modifier',
  'event_inject',
  'feast',
  'fast',
];

const GmOverride = {

  apply() {
    if (!fs.existsSync(GM_PATH)) {
      return;
    }

    try {
      const raw  = fs.readFileSync(GM_PATH, 'utf8');
      const input = JSON.parse(raw);

      for (const key of ALLOWED_KEYS) {
        if (key in input) {
          GameState.gm[key] = input[key];
        }
      }

      // Unlock flags — merge, nikdy přepis. gm_input.json.unlock_flags = jen
      // dávka k přidání tento tik; GameState.unlockedFlags roste natrvalo.
      if (Array.isArray(input.unlock_flags)) {
        if (!Array.isArray(GameState.unlockedFlags)) GameState.unlockedFlags = [];
        for (const flag of input.unlock_flags) {
          if (typeof flag === 'string' && !GameState.unlockedFlags.includes(flag)) {
            GameState.unlockedFlags.push(flag);
          }
        }
      }

      // Actor overrides — přímý zásah do GameState.actors
      if (input.actor_overrides && typeof input.actor_overrides === 'object') {
        for (const [actorId, fields] of Object.entries(input.actor_overrides)) {
          if (GameState.actors && GameState.actors[actorId] && typeof fields === 'object') {
            for (const [field, value] of Object.entries(fields)) {
              if (typeof value === 'number') {
                GameState.actors[actorId][field] = value;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CHRONICON] gm_override: chyba při načítání gm_input.json —', err.message);
    }
  },

};

module.exports = { GmOverride };
