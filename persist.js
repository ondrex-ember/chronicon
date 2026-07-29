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
const { RICNI_ACTORS, RICNI_RELATIONS } = require('./data/actors.js');

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
      Persist._syncMissingActors();
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

  // Přírůstek RICNI_ACTORS (nový aktér, např. 'sklar' 29.7.2026) se sám
  // nepropíše do už běžícího persistovaného světa — GameState.actors se
  // inicializuje z RICNI_ACTORS jen jednou, při vzniku (core/state.js).
  // Po každém loadu:
  //   1) chybějící aktéři se PŘIDAJÍ (stejný tvar jako core/state.js init,
  //      žádný reset, ostatní aktéři netknutí)
  //   2) STÁVAJÍCÍM aktérům se doplní chybějící klíče v .relations (nový
  //      aktér má vztah k nim, oni k němu ještě ne — z RICNI_RELATIONS)
  _syncMissingActors() {
    if (!Array.isArray(GameState.actors)) return;

    const existingIds = new Set(GameState.actors.map(a => a.id));
    RICNI_ACTORS.forEach(seed => {
      if (existingIds.has(seed.id)) return;
      GameState.actors.push({
        ...seed,
        status: 'stable',
        ticksActive: 0,
        ticksInCrisis: 0,
        relations: { ...RICNI_RELATIONS[seed.id] },
      });
      console.log(`[CHRONICON] Nový aktér přidán do běžícího světa: ${seed.id} (${seed.label}).`);
    });

    GameState.actors.forEach(actor => {
      const seedRelations = RICNI_RELATIONS[actor.id];
      if (!seedRelations || !actor.relations) return;
      Object.keys(seedRelations).forEach(otherId => {
        if (actor.relations[otherId] === undefined) {
          actor.relations[otherId] = seedRelations[otherId];
        }
      });
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
