// ============================================
//  CHRONICON — Register (Registrum Coenobii)
//  Čte data/community_register.json — denní kbelíky vážených součtů
//  Lux/Umbra, které tam commituje Scriptorium (api/registrum-report.js,
//  Varianta A, GitHub Contents API). Žádný fetch — soubor je součástí
//  tohoto repa, GitHub Actions ho má už checked-out, stejně jako
//  gm_input.json.
//
//  Formát souboru: { "YYYY-MM-DD": { wsum_lux, wsum_umbra, wsum } }
//  Čteme VČEREJŠÍ (poslední uzavřený) den, ne dnešní rozjetý —
//  vyhne se zkreslení částečným dnem (registrum-coenobii-reference.md §3).
//  Tiché selhání, pokud soubor chybí/je poškozený — stejný vzor jako
//  GmOverride.apply().
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'community_register.json');

// Kbelíky starší než tohle se ignorují (TTL — otázka 9.6 v MRD, nástřel 3 dny)
const MAX_BUCKET_AGE_DAYS = 3;

const RegisterSystem = {

  _yesterdayKey: function () {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  },

  // Vrací { avgLux, avgUmbra } za včerejší den, nebo null (chybí/prázdný/moc starý).
  readYesterdayAverage: function () {
    if (!fs.existsSync(REGISTER_PATH)) return null;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[REGISTER] community_register.json poškozený:', err.message);
      return null;
    }

    const key = this._yesterdayKey();
    const bucket = data[key];
    if (!bucket || !bucket.wsum) return null;

    const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
    if (ageDays > MAX_BUCKET_AGE_DAYS) return null;

    return {
      avgLux:   bucket.wsum_lux   / bucket.wsum,
      avgUmbra: bucket.wsum_umbra / bucket.wsum,
    };
  },

};

module.exports = { RegisterSystem };
