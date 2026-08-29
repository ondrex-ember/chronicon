// ============================================
//  CHRONICON — Library Fond Register
//  Čte data/library_fond_register.json — denní kbelíky { "YYYY-MM-DD": N },
//  kde N je NEJVYŠŠÍ nahlášený počet odemčených knih toho dne napříč
//  hráči, které tam commituje Scriptorium (api/library-fond-report.js).
//  Mirror core/actor-favor-register.js, jen s číslem místo boolean flagu.
//
//  Formát souboru: { "YYYY-MM-DD": count }
//  Čteme POSLEDNÍCH 14 UZAVŘENÝCH DNÍ, bereme NEJVYŠŠÍ hodnotu z nich —
//  "nejproslulejší knihovna regionu", ne průměr (viz vypujcky-gradient-mrd
//  §C, 29.8.2026). Tiché selhání, pokud soubor chybí/je poškozený.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'library_fond_register.json');
const LOOKBACK_DAYS = 14;
const MAX_BUCKET_AGE_DAYS = 21;

const LibraryFondRegisterSystem = {

  _dayKeysLookback: function () {
    const keys = [];
    for (let i = 0; i <= LOOKBACK_DAYS; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  },

  // Vrací nejvyšší nahlášený počet odemčených knih za posledních
  // LOOKBACK_DAYS dní, nebo 0 při chybějícím/poškozeném souboru —
  // volající strana se chová jako "žádný fond bonus".
  getRecentMax: function () {
    if (!fs.existsSync(REGISTER_PATH)) return 0;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[LIBRARY_FOND_REGISTER] library_fond_register.json poškozený:', err.message);
      return 0;
    }

    let max = 0;
    this._dayKeysLookback().forEach(key => {
      const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
      if (ageDays > MAX_BUCKET_AGE_DAYS) return;
      const val = data[key];
      if (typeof val === 'number' && val > max) max = val;
    });
    return max;
  },

};

module.exports = { LibraryFondRegisterSystem };
