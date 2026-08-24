// ============================================
//  CHRONICON — Guild Register
//  Čte data/guild_register.json — denní kbelíky
//  { "YYYY-MM-DD": { "mlynarsky": 3, "pekarsky": 1, ... } },
//  které tam commituje Scriptorium (api/guild-tension-report.js).
//
//  Formát souboru: { "YYYY-MM-DD": { guildId: count, ... } }
//  Čteme POSLEDNÍCH 7 UZAVŘENÝCH DNÍ, počítáme kolik neoprávněných
//  prodejů (fušerství) proběhlo.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'guild_register.json');
const MAX_BUCKET_AGE_DAYS = 10;

const GuildRegisterSystem = {

  _dayKeysLastWeek: function () {
    const keys = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  },

  // Vrací { guildId: count } pro JEDEN konkrétní den (YYYY-MM-DD).
  // Použito v engine.js s kurzorem, aby se každý den připočetl přesně
  // jednou, ne opakovaně při každém ze 4 ticků/den (oprava, v0.6 bod 1).
  getGuildSalesCountsForDay: function (dayKey) {
    if (!fs.existsSync(REGISTER_PATH)) return {};

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[GUILD_REGISTER] guild_register.json poškozený:', err.message);
      return {};
    }

    const bucket = data[dayKey];
    if (!bucket) return {};

    const counts = {};
    Object.keys(bucket).forEach(guildId => {
      counts[guildId] = (typeof bucket[guildId] === 'number') ? bucket[guildId] : 1;
    });
    return counts;
  },

  // PŮVODNÍ funkce — ponechána (může ji používat GM admin panel pro
  // zobrazení týdenního součtu), ale engine.js ji od v0.6 už nevolá.
  // Vrací { guildId: totalUnprivilegedSalesCount } z posledních 7 dní
  getGuildSalesCountsThisWeek: function () {
    if (!fs.existsSync(REGISTER_PATH)) return {};

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[GUILD_REGISTER] guild_register.json poškozený:', err.message);
      return {};
    }

    const counts = {};
    this._dayKeysLastWeek().forEach(key => {
      const ageDays = (Date.now() - Date.parse(key + 'T00:00:00Z')) / 86400000;
      if (ageDays > MAX_BUCKET_AGE_DAYS) return;
      const bucket = data[key];
      if (!bucket) return;
      Object.keys(bucket).forEach(guildId => {
        if (typeof bucket[guildId] === 'number') {
          counts[guildId] = (counts[guildId] || 0) + bucket[guildId];
        } else if (bucket[guildId]) {
          counts[guildId] = (counts[guildId] || 0) + 1;
        }
      });
    });
    return counts;
  },

};

module.exports = { GuildRegisterSystem };
