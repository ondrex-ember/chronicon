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
const { RICNI_ACTORS } = require('./data/actors.js');

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
      Persist._syncActorLabels();
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

  // Statická/kosmetická pole (label, profese, EN varianty) se ukládají do
  // gamestate.json spolu se vším ostatním, takže úprava data/actors.js
  // (např. přejmenování 'klaster' → 'Opat', 25.7.2026) se sama nepropíše
  // do už běžícího persistovaného světa. Po každém loadu je přetáhneme
  // znovu ze zdroje pravdy (RICNI_ACTORS) podle id — simulační pole
  // (wealth/mood/stores/status) zůstávají netknutá, jen se sladí popisky.
  _syncActorLabels() {
    if (!Array.isArray(GameState.actors)) return;
    GameState.actors.forEach(actor => {
      const seed = RICNI_ACTORS.find(a => a.id === actor.id);
      if (!seed) return;
      actor.label         = seed.label;
      actor.label_en       = seed.label_en;
      actor.profession     = seed.profession;
      actor.profession_en  = seed.profession_en;
    });
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
