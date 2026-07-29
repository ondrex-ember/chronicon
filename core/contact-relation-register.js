// ============================================
//  CHRONICON — Contact Relation Register
//  Čte data/contact_relation_register.json — denní kbelíky vážených
//  součtů contactRelation hodnot per aktér, které tam commituje
//  Scriptorium (api/contact-relation-report.js, Krok B,
//  clientela-chronicon-most-mrd.md §5). Mirror core/register.js
//  (Registrum Coenobii) 1:1, jen generalizováno na libovolný aktér
//  místo jednoho globálního lux/umbra páru.
//
//  Formát souboru: { "YYYY-MM-DD": { actorId: { wsum, wcount } } }
//  Čteme VČEREJŠÍ (poslední uzavřený) den, ne dnešní rozjetý — stejný
//  důvod jako u Registrum Coenobii (částečný den by zkreslil průměr).
//  Tiché selhání, pokud soubor chybí/je poškozený.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'contact_relation_register.json');

// Kbelíky starší než tohle se ignorují (mirror MAX_BUCKET_AGE_DAYS z register.js)
const MAX_BUCKET_AGE_DAYS = 3;

const ContactRelationRegisterSystem = {

  _yesterdayKey: function () {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  },

  // Vrací { avgRelation, sampleWeight } za včerejší den pro daného
  // aktéra, nebo null (chybí/prázdný/moc starý/žádný vzorek pro
  // tohoto konkrétního aktéra).
  readYesterdayAverage: function (actorId) {
    if (!fs.existsSync(REGISTER_PATH)) return null;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[CONTACT_RELATION_REGISTER] soubor poškozený:', err.message);
      return null;
    }

    const key = this._yesterdayKey();
    const bucket = data[key];
    if (!bucket) return null;

    const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
    if (ageDays > MAX_BUCKET_AGE_DAYS) return null;

    const actorBucket = bucket[actorId];
    if (!actorBucket || !actorBucket.wcount) return null;

    return {
      avgRelation: actorBucket.wsum / actorBucket.wcount,
      sampleWeight: actorBucket.wcount,
    };
  },

};

module.exports = { ContactRelationRegisterSystem };
