// ============================================
//  CHRONICON — Narrative Validator
//  Spustit: node narrative/validate.js
//  Kontroluje povinná pole, duplicitní ID,
//  základní konzistenci napříč třemi sety.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const FILES = [
  { name: 'distant_events_v1.json',    type: 'distant'   },
  { name: 'local_events_v1.json',      type: 'local'     },
  { name: 'monastery_internal_v1.json', type: 'monastery' },
];

const VALID_TYPES = ['A', 'B', 'C', 'D', 'E'];

let errors   = 0;
let warnings = 0;
const allIds = new Set();

function err(msg) {
  console.error('❌ ' + msg);
  errors++;
}

function warn(msg) {
  console.warn('⚠️  ' + msg);
  warnings++;
}

function validateCommon(entry, filename) {
  const prefix = `${filename} / ${entry.id || '???'}`;

  if (!entry.id) {
    err(`${prefix}: chybí 'id'`);
    return;
  }

  if (allIds.has(entry.id)) {
    err(`${prefix}: duplicitní ID napříč sety`);
  }
  allIds.add(entry.id);

  if (!entry.text_cs) err(`${prefix}: chybí 'text_cs'`);
  if (!entry.text_en) err(`${prefix}: chybí 'text_en'`);
  if (!entry.icon)    warn(`${prefix}: chybí 'icon'`);
  if (!entry.type || !VALID_TYPES.includes(entry.type)) {
    err(`${prefix}: 'type' musí být jedno z ${VALID_TYPES.join(', ')}, je: ${entry.type}`);
  }

  if (entry.text_cs && entry.text_cs.length < 20) {
    warn(`${prefix}: 'text_cs' je podezřele krátký (${entry.text_cs.length} znaků)`);
  }
  if (entry.text_en && entry.text_en.length < 20) {
    warn(`${prefix}: 'text_en' je podezřele krátký (${entry.text_en.length} znaků)`);
  }

  // Pozn.: heuristika na anglická slova v text_cs byla odstraněna —
  // české znaky s diakritikou (ě, í, á...) rozbíjejí \b hranice v regexu
  // a generují falešné poplachy (např. "anděl" matchne "and").
}

function validateDistant(entry, filename) {
  validateCommon(entry, filename);
  const prefix = `${filename} / ${entry.id}`;

  if (!entry.source)       err(`${prefix}: chybí 'source'`);
  if (!entry.source_label) err(`${prefix}: chybí 'source_label'`);
  if (entry.delay_days === undefined) warn(`${prefix}: chybí 'delay_days'`);
  if (entry.month_hint !== null && entry.month_hint !== undefined) {
    if (!Array.isArray(entry.month_hint)) {
      err(`${prefix}: 'month_hint' musí být pole nebo null`);
    } else if (entry.month_hint.some(m => m < 1 || m > 12)) {
      err(`${prefix}: 'month_hint' obsahuje neplatné číslo měsíce`);
    }
  }
}

function validateLocal(entry, filename) {
  validateDistant(entry, filename); // stejná pole jako distant
}

function validateMonastery(entry, filename) {
  validateCommon(entry, filename);
  const prefix = `${filename} / ${entry.id}`;

  if (!entry.conditions) {
    err(`${prefix}: chybí 'conditions'`);
    return;
  }
  if (!Array.isArray(entry.conditions.season)) {
    err(`${prefix}: 'conditions.season' musí být pole`);
  } else if (entry.conditions.season.some(s => s < 0 || s > 3)) {
    err(`${prefix}: 'conditions.season' obsahuje neplatné číslo sezóny (0–3)`);
  }
  if (entry.conditions.weather_keys !== null && !Array.isArray(entry.conditions.weather_keys)) {
    err(`${prefix}: 'conditions.weather_keys' musí být pole nebo null`);
  }
}

function run() {
  console.log('🔍 CHRONICON narrative validator\n');

  for (const file of FILES) {
    const filepath = path.join(__dirname, file.name);
    if (!fs.existsSync(filepath)) {
      err(`Soubor neexistuje: ${file.name}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      err(`${file.name}: neplatný JSON — ${e.message}`);
      continue;
    }

    if (!Array.isArray(data)) {
      err(`${file.name}: root musí být pole`);
      continue;
    }

    console.log(`📄 ${file.name} — ${data.length} záznamů`);

    for (const entry of data) {
      if (file.type === 'distant')   validateDistant(entry, file.name);
      if (file.type === 'local')     validateLocal(entry, file.name);
      if (file.type === 'monastery') validateMonastery(entry, file.name);
    }
  }

  console.log(`\n${errors === 0 ? '✅' : '❌'} Hotovo — ${errors} chyb, ${warnings} varování.`);
  if (errors > 0) process.exit(1);
}

run();
