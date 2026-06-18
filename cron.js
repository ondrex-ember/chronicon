// ============================================
//  CHRONICON — Cron
//  Hlavní vstupní bod. Spouští tick 4× denně.
//
//  Použití:
//    node cron.js          → spustí scheduler
//    node cron.js --once   → jeden tick a konec
//    node cron.js --dev    → tick každých 30s
// ============================================

'use strict';

const cron = require('node-cron');

const { GameState }  = require('./core/state.js');
const { WeatherSystem } = require('./core/weather.js');
const { GameEngine } = require('./core/engine.js');
const { GmOverride } = require('./gm/gm_override.js');
const { Persist }    = require('./persist.js');
const { Snapshot }   = require('./output/snapshot.js');

// ============================================
//  Hlavní tick funkce
// ============================================

function tick() {
  const start = Date.now();
  console.log(`\n[CHRONICON] ── Tick začíná ── ${new Date().toISOString()}`);

  try {
    // 1. GM override — načíst gm_input.json
    GmOverride.apply();

    // 2. Engine tick — počasí, produkce, posun dne
    GameEngine.tick();

    // 3. Persist — uložit state
    Persist.save();

    // 4. Snapshot — exportovat JSON pro Scriptorium
    Snapshot.write();

    const ms = Date.now() - start;
    console.log(`[CHRONICON] ── Tick hotov ── ${ms}ms\n`);
  } catch (err) {
    console.error('[CHRONICON] CHYBA V TIKU:', err);
  }
}

// ============================================
//  Startup — load state + init engine
// ============================================

function startup() {
  console.log('[CHRONICON] ════════════════════════════');
  console.log('[CHRONICON] CHRONICON Server startuje...');
  console.log('[CHRONICON] ════════════════════════════');

  // Načti persist state (nebo default při prvním startu)
  Persist.load();

  // Init engine — počasí + úvodní chronicle záznam
  // Pokud je to restart (totalTick > 0), přeskočíme init chronicle
  if (!GameState.flags.started) {
    GameEngine.init();
    Persist.save();
  } else {
    // Restart — jen reinit WeatherSystem (nemění state, jen nastaví current)
    WeatherSystem.init();
    console.log('[CHRONICON] Restart — pokračuji od ticku', GameState.time.totalTick);
  }
}

// ============================================
//  Režimy spuštění
// ============================================

const args = process.argv.slice(2);

startup();

if (args.includes('--once')) {
  // Jeden tick — pro GitHub Actions a manuální testování
  console.log('[CHRONICON] Režim: --once');
  tick();
  process.exit(0);

} else if (args.includes('--dev')) {
  // Dev režim — tick každých 30 sekund
  console.log('[CHRONICON] Režim: --dev (tick každých 30s)');
  tick(); // Okamžitý první tick
  cron.schedule('*/30 * * * * *', tick);

} else {
  // Produkční režim — 4× denně: 6:00, 12:00, 18:00, 00:00
  console.log('[CHRONICON] Režim: produkce (6:00 / 12:00 / 18:00 / 00:00)');
  cron.schedule('0 0,6,12,18 * * *', tick, {
    timezone: 'Europe/Prague',
  });
  console.log('[CHRONICON] Scheduler spuštěn. Čekám na tick...\n');
}
