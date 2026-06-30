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
  'unlock_flag',
  'tension_modifier',
  'event_inject',
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
    } catch (err) {
      console.warn('[CHRONICON] gm_override: chyba při načítání gm_input.json —', err.message);
    }
  },

};

module.exports = { GmOverride };
