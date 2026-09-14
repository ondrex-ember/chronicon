'use strict';

// CHRONICON — simulační harness (chronicon-audit2-mrd, 14.9.2026)
//
// Pouštíme N nezávislých běhů po W týdnech ze STEJNÉHO čistého výchozího
// stavu (core/state.js default), sbíráme rozdělení výsledků — ne jeden
// seed. Cíl: invarianty, ne konkrétní čísla. "Zda mood/wealth dlouhodobě
// nesaturují 0/100, zda tension používá rozumnou část rozsahu, zda někdo
// upadne do krize, zda se svět zotaví, zda fronty nerostou bez omezení,
// zda nevznikne NaN" (audit #2, bod 9).
//
// Záměrně BEZ síťových volání a BEZ reálného kalendáře — voláme
// GameEngine.runWeeklyEconomy() přímo, ne celý tick() (ten by dělal
// Open-Meteo fetch a syncCalendar() na reálné datum, což pro rychlý
// opakovaný běh nedává smysl). Sezóna se cykluje ručně (~13 týdnů/sezóna).
//
// RescueRegisterSystem je nastubovaný na "žádné reporty" — harness testuje
// JÁDRO simulace (ekonomika + EVENT_REGISTRY), ne hráčskou intervenci
// (ta je otestovaná zvlášť, cíleně, viz sim/test-rescue-order.js).
//
// Spuštění: node sim/harness.js [runs] [weeks]
// Výchozí: 300 běhů × 52 týdnů (~1 herní rok).

const path = require('path');
const Module = require('module');

// --- Stub RescueRegisterSystem (žádné file I/O, žádná závislost na
// reálných hráčských datech v repu — harness má být deterministicky
// izolovaný od toho, co je zrovna v data/rescue_register.json) ---
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('rescue-register.js')) {
    return { RescueRegisterSystem: { countDaysThisWeek: () => ({}) } };
  }
  return origLoad.apply(this, arguments);
};

const { GameState } = require('../core/state.js');
const { GameEngine } = require('../core/engine.js');
const { EVENT_REGISTRY } = require('../data/events.js');

// --- Instrumentace: kolikrát se který event skutečně spustil napříč
// všemi běhy (execute() proběhlo, ne jen trigger() vrátil true) ---
const NEW_EVENT_IDS = ['d_fire_workshop', 'd_poor_harvest', 'c_bandit_raid_road', 'd_feudal_skirmish', 'c_landfriede_declared', 'd_papal_citation_1465', 'd_green_mountain_league', 'c_regional_flood', 'd_severe_hailstorm', 'd_mercenary_levy'];
const fireCounts = {};       // celkový počet spuštění napříč VŠEMI běhy
const firedInRunCount = {};  // v kolika bězích to proběhlo AlESPOŇ jednou
EVENT_REGISTRY.forEach(ev => {
  fireCounts[ev.id] = 0;
  firedInRunCount[ev.id] = 0;
  const origExecute = ev.execute;
  ev.execute = function (...args) {
    fireCounts[ev.id] += 1;
    if (currentRunFired) currentRunFired.add(ev.id);
    return origExecute.apply(this, args);
  };
});
let currentRunFired = null;

const N_RUNS = parseInt(process.argv[2], 10) || 300;
const N_WEEKS = parseInt(process.argv[3], 10) || 52;

// Čistý výchozí stav zachycený PŘED prvním runem (hluboká kopie —
// GameState je v core/state.js plný literál dat, žádné funkce/closures)
const PRISTINE = JSON.parse(JSON.stringify(GameState));

function resetState() {
  Object.keys(GameState).forEach(k => delete GameState[k]);
  Object.assign(GameState, JSON.parse(JSON.stringify(PRISTINE)));
}

const results = [];
let anyNaNRuns = 0;
let anyThrowRuns = 0;

for (let run = 0; run < N_RUNS; run++) {
  resetState();
  currentRunFired = new Set();
  let threw = false;
  for (let w = 0; w < N_WEEKS; w++) {
    GameState.time.season = Math.floor((w % 52) / 13) % 4; // ~13 týdnů/sezóna
    try {
      GameEngine.runWeeklyEconomy();
    } catch (e) {
      threw = true;
      anyThrowRuns++;
      console.error(`RUN ${run} THREW at week ${w}:`, e.stack);
      break;
    }
  }
  if (threw) continue;
  currentRunFired.forEach(id => { firedInRunCount[id] = (firedInRunCount[id] || 0) + 1; });

  const actors = GameState.actors;
  const alive = actors.filter(a => a.status !== 'mrtvy');
  const hasNaN = actors.some(a => isNaN(a.wealth) || isNaN(a.mood) || isNaN(a.stores)) || isNaN(GameState.globalTension);
  if (hasNaN) anyNaNRuns++;

  results.push({
    finalTension: GameState.globalTension,
    meanWealth: alive.length ? alive.reduce((s, a) => s + a.wealth, 0) / alive.length : NaN,
    meanMood: alive.length ? alive.reduce((s, a) => s + a.mood, 0) / alive.length : NaN,
    deaths: actors.length - alive.length,
    everInCrisis: actors.some(a => a.ticksInCrisis > 0 || a.status === 'krize' || a.status === 'zanikajici'),
    pendingHospitesLen: (GameState.pendingHospites || []).length,
    chainQueueLen: (GameState._chainQueue || []).length,
    guildTensionRange: (() => {
      const vals = Object.values(GameState.guilds || {}).map(g => g.tension);
      return vals.length ? [Math.min(...vals), Math.max(...vals)] : [null, null];
    })(),
    hasNaN,
  });
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) * p)];
}
function summary(key) {
  const vals = results.map(r => r[key]).filter(v => !isNaN(v));
  return `min ${pct(vals, 0).toFixed(1)} | p25 ${pct(vals, 0.25).toFixed(1)} | median ${pct(vals, 0.5).toFixed(1)} | p75 ${pct(vals, 0.75).toFixed(1)} | max ${pct(vals, 1).toFixed(1)}`;
}

console.log(`\n=== CHRONICON harness — ${N_RUNS} běhů × ${N_WEEKS} týdnů, ze stejného čistého výchozího stavu ===\n`);
console.log('globalTension (final):', summary('finalTension'));
console.log('mean wealth (živí):   ', summary('meanWealth'));
console.log('mean mood (živí):     ', summary('meanMood'));
console.log('deaths per run:       ', summary('deaths'));
console.log('pendingHospites len:  ', summary('pendingHospitesLen'));
console.log('chainQueue len:       ', summary('chainQueueLen'));
console.log('\nběhy s NaN:            ', anyNaNRuns, '/', N_RUNS);
console.log('běhy co spadly (throw):', anyThrowRuns, '/', N_RUNS);
console.log('běhy kde NĚKDO byl v krizi:', results.filter(r => r.everInCrisis).length, '/', results.length);
console.log('běhy kde je alespoň 1 smrt:', results.filter(r => r.deaths > 0).length, '/', results.length);

console.log('\n(cechovní tension vynechán z reportu — řídí ho výhradně GuildRegisterSystem/reálné datum,')
console.log(' mimo scope tohoto harness; viz poznámka v dodávce)');

console.log('\n--- vlna 1: kolik běhů z', N_RUNS, 'mělo daný event alespoň jednou / celkový počet spuštění ---');
NEW_EVENT_IDS.forEach(id => console.log(' ', id.padEnd(24), `${firedInRunCount[id] || 0}/${N_RUNS} běhů`, `| celkem ${fireCounts[id]}× (~${(fireCounts[id] / N_RUNS).toFixed(1)}/běh)`));
console.log('--- pro srovnání, pár starých eventů (celkem spuštění) ---');
['a_uroda_podzim', 'd_nove_dane', 'c_smireni', 'a_mor_dobytek'].forEach(id => console.log(' ', id.padEnd(24), fireCounts[id] || 0));
