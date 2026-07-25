// ============================================
//  CHRONICON — Actor Favor Register
//  Čte data/actor_favor_register.json — denní kbelíky
//  { "YYYY-MM-DD": { "klaster": true, "jinyAktor": true, ... } },
//  které tam commituje Scriptorium (api/actor-favor-report.js).
//  Generický — na rozdíl od Vrchnost Registru (jeden pevný aktér)
//  umí libovolný actorId, bez dalšího zásahu do enginu při přidání
//  dalšího cíle (klaster dnes, cokoliv příště).
//
//  Formát souboru: { "YYYY-MM-DD": { actorId: true, ... } }
//  Čteme POSLEDNÍCH 7 UZAVŘENÝCH DNÍ, počítáme kolik z nich mělo pro
//  daného aktéra aspoň 1 report — stejný vzor jako RescueRegisterSystem.
//  Tiché selhání, pokud soubor chybí/je poškozený.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'actor_favor_register.json');
const MAX_BUCKET_AGE_DAYS = 10;

const ActorFavorRegisterSystem = {

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
  // poškozeném souboru — volající strana se chová jako "žádný favor".
  countDaysThisWeek: function () {
    if (!fs.existsSync(REGISTER_PATH)) return {};

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[ACTOR_FAVOR_REGISTER] actor_favor_register.json poškozený:', err.message);
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

module.exports = { ActorFavorRegisterSystem };
