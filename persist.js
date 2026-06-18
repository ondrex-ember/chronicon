// ============================================
//  CHRONICON — Persist
//  Load/save GameState do data/gamestate.json.
//  loadState() — při startu serveru
//  saveState() — po každém tiku
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const { GameState } = require('./core/state.js');

const STATE_PATH = path.join(__dirname, 'data', 'gamestate.json');

const Persist = {

  load() {
    if (!fs.existsSync(STATE_PATH)) {
      console.log('[CHRONICON] Žádný save nenalezen — první start, použit default state.');
      return;
    }

    try {
      const raw     = fs.readFileSync(STATE_PATH, 'utf8');
      const saved   = JSON.parse(raw);
      Object.assign(GameState, saved);
      console.log(
        `[CHRONICON] State načten — tick ${GameState.time.totalTick},` +
        ` ${GameState.time.season === 0 ? 'Jaro' :
           GameState.time.season === 1 ? 'Léto' :
           GameState.time.season === 2 ? 'Podzim' : 'Zima'}` +
        ` Léta Páně ${GameState.time.year}.`
      );
    } catch (err) {
      console.error('[CHRONICON] Chyba při načítání state:', err.message);
      console.log('[CHRONICON] Pokračuji s default state.');
    }
  },

  save() {
    try {
      const dir = path.dirname(STATE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATE_PATH, JSON.stringify(GameState, null, 2), 'utf8');
    } catch (err) {
      console.error('[CHRONICON] Chyba při ukládání state:', err.message);
    }
  },

};

module.exports = { Persist };
