// ============================================
//  CHRONICON — Vrchnost Register
//  Čte data/vrchnost_register.json — denní kbelíky {favor: true}, které tam
//  commituje Scriptorium (api/vrchnost-report.js, mirror rescue-report.js).
//  Na rozdíl od Rescue Registrum je tohle cílené na JEDNOHO aktéra
//  (Vrchnost), takže žádný per-actor rozklad — jen "kolik dní z posledního
//  týdne mělo aspoň 1 report".
//
//  Formát souboru: { "YYYY-MM-DD": { "favor": true } }
//  Tiché selhání, pokud soubor chybí/je poškozený.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'vrchnost_register.json');
const MAX_BUCKET_AGE_DAYS = 10;

const VrchnostRegisterSystem = {

  _dayKeysLastWeek: function () {
    const keys = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  },

  // Vrací počet dní z posledního uzavřeného týdne, co měly aspoň 1 report.
  countDaysThisWeek: function () {
    if (!fs.existsSync(REGISTER_PATH)) return 0;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[VRCHNOST_REGISTER] vrchnost_register.json poškozený:', err.message);
      return 0;
    }

    let count = 0;
    this._dayKeysLastWeek().forEach(key => {
      const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
      if (ageDays > MAX_BUCKET_AGE_DAYS) return;
      const bucket = data[key];
      if (bucket && bucket.favor) count++;
    });
    return count;
  },

};

module.exports = { VrchnostRegisterSystem };
