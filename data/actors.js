// ============================================
//  CHRONICON v2 — Actors & Production Data
//  Port z Betlém (src/data/actors.ts) — POUZE profil 'ricni'
//  (Olomouc leží na řece Moravě). Vizuální pole (x/y/terrain/
//  placementZones) ponechána pro budoucí GM mapu, enginem
//  se nepoužívají — logistika/vzdálenost je vědomě vypuštěna
//  (Sprint 1b), viz MRD poznámka v cron.js.
// ============================================

'use strict';

const RICNI_ACTORS = [
  { id: 'vrchnost',  label: 'Vrchnost',  profession: 'Pán panství', core: true, wealth: 70, mood: 65, stores: 50, storesMax: 100 },
  { id: 'mlynar',    label: 'Mlynář',    profession: 'Mlynář',      core: true, wealth: 55, mood: 60, stores: 45, storesMax: 90 },
  { id: 'kovar',     label: 'Kovář',     profession: 'Kovář',       core: true, wealth: 50, mood: 65, stores: 40, storesMax: 80 },
  { id: 'uhlic',     label: 'Uhlíř',     profession: 'Uhlíř',       core: true, wealth: 30, mood: 50, stores: 30, storesMax: 70 },
  { id: 'vorar',     label: 'Vorař',     profession: 'Vorař',       core: true, wealth: 45, mood: 60, stores: 20, storesMax: 50 },
  { id: 'rybnikar',  label: 'Rybníkář',  profession: 'Rybníkář',    core: true, wealth: 40, mood: 55, stores: 30, storesMax: 70 },
  { id: 'prevoznik', label: 'Převozník', profession: 'Mýtný',       core: true, wealth: 50, mood: 55, stores: 25, storesMax: 60 },
  { id: 'valach',    label: 'Valach',    profession: 'Valach',      core: true, wealth: 35, mood: 55, stores: 35, storesMax: 70 },
  { id: 'klaster',   label: 'Klášter',   profession: 'Klášter',     core: true, wealth: 65, mood: 50, stores: 60, storesMax: 100 },
  { id: 'vcelar',    label: 'Včelař',    profession: 'Včelař',      core: true, wealth: 35, mood: 60, stores: 40, storesMax: 80 },
];

const RICNI_RELATIONS = {
  vrchnost: { mlynar: 30, kovar: 20, uhlic: 10, vorar: 10, rybnikar: 20, prevoznik: 40, valach: 15, klaster: -10, vcelar: 10 },
  mlynar:   { vrchnost: 30, kovar: 40, uhlic: 5, vorar: 20, rybnikar: -25, prevoznik: 10, valach: 0, klaster: 10, vcelar: 0 },
  kovar:    { vrchnost: 20, mlynar: 40, uhlic: 50, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 20, klaster: 0, vcelar: 15 },
  uhlic:    { vrchnost: 10, mlynar: 5, kovar: 50, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 5, klaster: 0, vcelar: 0 },
  vorar:    { vrchnost: 10, mlynar: 20, kovar: 0, uhlic: 0, rybnikar: -30, prevoznik: 15, valach: 0, klaster: 0, vcelar: 0 },
  rybnikar: { vrchnost: 20, mlynar: -25, kovar: 0, uhlic: 0, vorar: -30, prevoznik: 0, valach: 0, klaster: 45, vcelar: 0 },
  prevoznik:{ vrchnost: 40, mlynar: 10, kovar: 0, uhlic: 0, vorar: 15, rybnikar: 0, valach: 0, klaster: 0, vcelar: 0 },
  valach:   { vrchnost: 15, mlynar: 0, kovar: 20, uhlic: 5, vorar: 0, rybnikar: 0, prevoznik: 0, klaster: 20, vcelar: 0 },
  klaster:  { vrchnost: -10, mlynar: 10, kovar: 0, uhlic: 0, vorar: 0, rybnikar: 45, prevoznik: 0, valach: 20, vcelar: 35 },
  vcelar:   { vrchnost: 10, mlynar: 0, kovar: 15, uhlic: 0, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 0, klaster: 35 },
};

// base = týdenní produkce do 'stores' (před modifikátory); deps = na kom závisí (blokace při 'mrtvy', 50% při 'krize'/'zanikajici')
const PROD_TABLE = {
  vrchnost:  { base: 0,   deps: [],          produces: 'legitimacy' },
  mlynar:    { base: 3.5, deps: ['kovar'],   produces: 'mouka' },
  kovar:     { base: 3.0, deps: ['uhlic'],   produces: 'kovani' },
  uhlic:     { base: 2.5, deps: [],          produces: 'uhli' },
  vorar:     { base: 2.5, deps: [],          produces: 'doprava' },
  rybnikar:  { base: 2.5, deps: [],          produces: 'ryby' },
  prevoznik: { base: 3.0, deps: [],          produces: 'myto' },
  valach:    { base: 2.5, deps: [],          produces: 'vlna' },
  klaster:   { base: 2.5, deps: [],          produces: 'legitimita' },
  vcelar:    { base: 2.2, deps: [],          produces: 'med' },
};

// [prodMod, moodDelta] pro [Jaro, Léto, Podzim, Zima]
const SEASON_MODS = {
  vrchnost:  [[1.0,0],[1.0,0],[1.0,5],[1.0,-5]],
  mlynar:    [[0.7,-10],[1.2,5],[1.5,15],[0.6,-5]],
  kovar:     [[1.1,5],[1.0,-5],[1.2,5],[1.1,5]],
  uhlic:     [[0.8,-5],[1.3,5],[1.2,0],[0.4,-15]],
  vorar:     [[0.5,-15],[1.3,10],[1.2,5],[0.1,-20]],
  rybnikar:  [[1.3,10],[0.8,-10],[1.5,15],[0.6,-5]],
  prevoznik: [[0.6,-10],[1.4,15],[1.3,10],[0.3,-20]],
  klaster:   [[1.1,10],[0.9,-5],[1.1,5],[1.2,10]],
  valach:    [[1.2,10],[1.3,10],[1.0,0],[0.5,-15]],
  vcelar:    [[0.5,-5],[1.5,15],[1.3,10],[0.0,-20]],
  default:   [[1.0,0],[1.0,0],[1.0,0],[0.9,-5]],
};

const COMMODITY_VALUE = {
  uhli: 1.0, mouka: 1.5, kovani: 2.0, vlna: 2.0, med: 3.0,
  ryby: 1.5, doprava: 1.5, myto: 1.5, legitimita: 2.0,
};

const SEASON_DEMAND = {
  ryby: [1.5, 0.5, 1.5, 1.2],
  med:  [1.0, 1.0, 1.5, 0.5],
};

const PROD_BLOCK_TEXTS = {
  kovar_uhlic: [
    'Výheň <em>Kováře</em> chladne — uhlí nedochází od <em>Uhlíře</em>.',
    '<em>Kovář</em> čeká na dodávku uhlí. Kladivo mlčí.',
  ],
  mlynar_kovar: [
    '<em>Mlynář</em> hlásí: bez kování se kolo zastavilo. Mouka nedochází.',
    'Mlýn stojí — chybí kování na údržbu. <em>Mlynář</em> je zoufalý.',
  ],
  default: [
    '<em>{actor}</em> nemůže pracovat — chybí klíčové suroviny.',
    'Výroba <em>{actor}</em>e vázne. Dodavatelský řetězec je přerušen.',
  ],
};

const RELATION_THRESHOLD_TEXTS = {
  negative_40: [
    '<em>{a}</em> otevřeně odmítá spolupracovat s <em>{b}</em>em.',
    'Spor mezi <em>{a}</em>em a <em>{b}</em>em přerostl v otevřené nepřátelství.',
  ],
  positive_75: [
    '<em>{a}</em> a <em>{b}</em> uzavřeli neformální alianci. Společně jsou silnější.',
    'Přátelství <em>{a}</em>e a <em>{b}</em>e přerostlo v spojenectví.',
  ],
};

module.exports = {
  RICNI_ACTORS, RICNI_RELATIONS, PROD_TABLE, SEASON_MODS,
  COMMODITY_VALUE, SEASON_DEMAND, PROD_BLOCK_TEXTS, RELATION_THRESHOLD_TEXTS,
};
