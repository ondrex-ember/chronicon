// ============================================
//  CHRONICON — Rescue Register
//  Čte data/rescue_register.json — denní kbelíky {actorId: true}, které
//  tam commituje Scriptorium (api/rescue-report.js, mirror registrum-report.js
//  / Registrum Coenobii). Žádný fetch — soubor je součástí tohoto repa,
//  GitHub Actions ho má už checked-out, stejně jako gm_input.json.
//
//  Formát souboru: { "YYYY-MM-DD": { "actorId1": true, "actorId2": true } }
//  Samostatný soubor od community_register.json — jiný účel (cílená
//  záchrana konkrétních aktérů, ne difuzní lux/umbra tension).
//
//  Čteme POSLEDNÍCH 7 UZAVŘENÝCH DNÍ (ne dnešní rozjetý), počítáme
//  kolik z nich mělo pro daného aktéra aspoň 1 report — viz
//  infirmarium-hospites-rescue-mrd.md §4.2.
//  Tiché selhání, pokud soubor chybí/je poškozený — stejný vzor jako
//  RegisterSystem/GmOverride.apply().
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'rescue_register.json');

// Kbelíky starší než tohle se ignorují (mirror RegisterSystem MAX_BUCKET_AGE_DAYS,
// o něco větší okno, ať pokryje celý týdenní ohlédnutí + rezervu).
const MAX_BUCKET_AGE_DAYS = 10;

const RescueRegisterSystem = {

  _dayKeysLastWeek: function () {
    const keys = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  },

  // Vrací { actorId: count } — kolik z posledních 7 uzavřených dní mělo
  // pro daného aktéra aspoň 1 report. Prázdný objekt při chybějícím/
  // poškozeném souboru — volající strana se chová jako "žádná záchrana".
  countDaysThisWeek: function () {
    if (!fs.existsSync(REGISTER_PATH)) return {};

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[RESCUE_REGISTER] rescue_register.json poškozený:', err.message);
      return {};
    }

    const counts = {};
    this._dayKeysLastWeek().forEach(key => {
      const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
      if (ageDays > MAX_BUCKET_AGE_DAYS) return;
      const bucket = data[key];
      if (!bucket) return;
      Object.keys(bucket).forEach(actorId => {
        if (bucket[actorId]) counts[actorId] = (counts[actorId] || 0) + 1;
      });
    });
    return counts;
  },

};

module.exports = { RescueRegisterSystem };
