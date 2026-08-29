// ============================================
//  CHRONICON v2 — Actors & Production Data
//  Port z Betlém (src/data/actors.ts) — POUZE profil 'ricni'
//  (Olomouc leží na řece Moravě). Vizuální pole (x/y/terrain/
//  placementZones) ponechána pro budoucí GM mapu, enginem
//  se nepoužívají — logistika/vzdálenost je vědomě vypuštěna
//  (Sprint 1b), viz MRD poznámka v cron.js.
// ============================================

'use strict';

// literacy — vypujcky-gradient-mrd §D (29.8.2026). Váha gramotnosti/
// pravděpodobnosti zájmu o knihu, historicky odstupňovaná: šlechta a
// klérus (vrchnost/klaster) nejvýš, cechovní řemesla s evidencí
// (mýtný/mlynář/sklář — mýto, váhy, receptury) uprostřed, kočovná/
// manuální řemesla (uhlíř/vorař/valach) nejníž. Násobí relation-váhu
// v pickWeightedActor (engine.js), nenahrazuje ji.
const RICNI_ACTORS = [
  { id: 'vrchnost',  label: 'Vrchnost',  label_en: 'The Lordship',      profession: 'Pán panství', profession_en: 'Lord of the Manor', core: true, wealth: 70, mood: 65, stores: 50, storesMax: 100, literacy: 2.0 },
  { id: 'mlynar',    label: 'Mlynář',    label_en: 'The Miller',        profession: 'Mlynář',      profession_en: 'Miller',            core: true, wealth: 55, mood: 60, stores: 45, storesMax: 90, literacy: 1.1 },
  { id: 'kovar',     label: 'Kovář',     label_en: 'The Blacksmith',    profession: 'Kovář',       profession_en: 'Blacksmith',         core: true, wealth: 50, mood: 65, stores: 40, storesMax: 80, literacy: 1.0 },
  { id: 'uhlic',     label: 'Uhlíř',     label_en: 'The Charcoal Burner', profession: 'Uhlíř',     profession_en: 'Charcoal Burner',    core: true, wealth: 30, mood: 50, stores: 30, storesMax: 70, literacy: 0.5 },
  { id: 'vorar',     label: 'Vorař',     label_en: 'The Raftsman',      profession: 'Vorař',       profession_en: 'Raftsman',           core: true, wealth: 45, mood: 60, stores: 20, storesMax: 50, literacy: 0.5 },
  { id: 'rybnikar',  label: 'Rybníkář',  label_en: 'The Pondkeeper',    profession: 'Rybníkář',    profession_en: 'Pondkeeper',         core: true, wealth: 40, mood: 55, stores: 30, storesMax: 70, literacy: 0.8 },
  { id: 'prevoznik', label: 'Převozník', label_en: 'The Ferryman',      profession: 'Mýtný',       profession_en: 'Toll Collector',     core: true, wealth: 50, mood: 55, stores: 25, storesMax: 60, literacy: 1.4 },
  { id: 'valach',    label: 'Valach',    label_en: 'The Shepherd',      profession: 'Valach',      profession_en: 'Shepherd',           core: true, wealth: 35, mood: 55, stores: 35, storesMax: 70, literacy: 0.5 },
  { id: 'klaster',   label: 'Opat',      label_en: 'The Abbot',         profession: 'Opat ve městě', profession_en: 'Abbot in the City', core: true, wealth: 65, mood: 50, stores: 60, storesMax: 100, literacy: 1.8 },
  { id: 'vcelar',    label: 'Včelař',    label_en: 'The Beekeeper',     profession: 'Včelař',      profession_en: 'Beekeeper',          core: true, wealth: 35, mood: 60, stores: 40, storesMax: 80, literacy: 0.7 },
  { id: 'sklar',     label: 'Sklář',     label_en: 'The Glassmaker',    profession: 'Sklář',       profession_en: 'Glassmaker',         core: true, wealth: 45, mood: 55, stores: 35, storesMax: 75, literacy: 1.3 },
];

const RICNI_RELATIONS = {
  vrchnost: { mlynar: 30, kovar: 20, uhlic: 10, vorar: 10, rybnikar: 20, prevoznik: 40, valach: 15, klaster: -10, vcelar: 10, sklar: 10 },
  mlynar:   { vrchnost: 30, kovar: 40, uhlic: 5, vorar: 20, rybnikar: -25, prevoznik: 10, valach: 0, klaster: 10, vcelar: 0, sklar: 5 },
  kovar:    { vrchnost: 20, mlynar: 40, uhlic: 50, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 20, klaster: 0, vcelar: 15, sklar: 20 },
  uhlic:    { vrchnost: 10, mlynar: 5, kovar: 50, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 5, klaster: 0, vcelar: 0, sklar: 45 },
  vorar:    { vrchnost: 10, mlynar: 20, kovar: 0, uhlic: 0, rybnikar: -30, prevoznik: 15, valach: 0, klaster: 0, vcelar: 0, sklar: 0 },
  rybnikar: { vrchnost: 20, mlynar: -25, kovar: 0, uhlic: 0, vorar: -30, prevoznik: 0, valach: 0, klaster: 45, vcelar: 0, sklar: 0 },
  prevoznik:{ vrchnost: 40, mlynar: 10, kovar: 0, uhlic: 0, vorar: 15, rybnikar: 0, valach: 0, klaster: 0, vcelar: 0, sklar: 10 },
  valach:   { vrchnost: 15, mlynar: 0, kovar: 20, uhlic: 5, vorar: 0, rybnikar: 0, prevoznik: 0, klaster: 20, vcelar: 0, sklar: 0 },
  klaster:  { vrchnost: -10, mlynar: 10, kovar: 0, uhlic: 0, vorar: 0, rybnikar: 45, prevoznik: 0, valach: 20, vcelar: 35, sklar: 25 },
  vcelar:   { vrchnost: 10, mlynar: 0, kovar: 15, uhlic: 0, vorar: 0, rybnikar: 0, prevoznik: 0, valach: 0, klaster: 35, sklar: 5 },
  sklar:    { vrchnost: 10, mlynar: 5, kovar: 20, uhlic: 45, vorar: 0, rybnikar: 0, prevoznik: 10, valach: 0, klaster: 25, vcelar: 5 },
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
  // Sklář — sdíleny-pool-mrd v2 (26.7.2026). producesItems = item-úroveň
  // produkce navíc k abstraktnímu 'stores' (paralelní, nedotýká se core
  // simulace). {rate, cap} pár za item — různá vzácnost, ne plochý strop.
  sklar:     { base: 2.5, deps: ['uhlic'],   produces: 'sklo',
               producesItems: {
                 glass_goblet:        { rate: 0.35, cap: 6 },
                 glass_vase:          { rate: 0.12, cap: 3 },
                 glass_pitcher:       { rate: 0.15, cap: 4 },
                 naramek_sklo_zeleny: { rate: 0.40, cap: 8 },
                 naramek_sklo_hnedy:  { rate: 0.40, cap: 8 },
                 naramek_sklo_modry:  { rate: 0.08, cap: 2 },
               } },
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
  ryby: 1.5, doprava: 1.5, myto: 1.5, legitimita: 2.0, sklo: 2.5,
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

// Žádost o surovinu na hráče — zakazky-centralizace-mrd Fáze 2 (26.7.2026).
// Spouštěč = SKUTEČNÁ krize (mrtvý dodavatel dle PROD_TABLE.deps), ne čistá
// náhoda. itemId = ověřené reálné Scriptorium itemy (charcoal, kovani).
const MATERIAL_REQUEST_POOL = {
  kovar: { itemId: 'charcoal', qty: 5, days: 14, grose: 25 },  // dep: uhlic
  sklar: { itemId: 'charcoal', qty: 5, days: 14, grose: 20 },  // dep: uhlic
  mlynar: { itemId: 'kovani', qty: 2, days: 14, grose: 15 },   // dep: kovar
};

module.exports = {
  RICNI_ACTORS, RICNI_RELATIONS, PROD_TABLE, SEASON_MODS,
  COMMODITY_VALUE, SEASON_DEMAND, PROD_BLOCK_TEXTS, RELATION_THRESHOLD_TEXTS,
  MATERIAL_REQUEST_POOL,
};
