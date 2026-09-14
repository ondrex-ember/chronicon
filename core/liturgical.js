'use strict';

// CHRONICON — liturgický kalendář (Velikonoce + postní doba)
//
// audit-3 (14.9.2026), bod 17: "postní" event se dřív spouštěl podle
// hrubého sezónního odhadu (Jaro nebo Zima — cca půl roku), zatímco
// output/snapshot.js si už dřív spočítal skutečnou postní dobu
// (Popeleční středa → Velikonoce) pro vlastní účely. Tenhle modul dělá
// STEJNÝ výpočet (algoritmus Meeuse/Jones/Butcher, identický se
// Scriptorium client systems/calendar.js CalendarSystem.getEaster()),
// aby events.js a snapshot.js mluvily o stejném kalendáři.
//
// Záměrně NEDOTÝKÁ snapshot.js — jeho vlastní _getEaster()/_computeFast()
// zůstávají beze změny (funkční, netřeba refaktorovat kvůli jednomu
// novému volajícímu). Obě implementace jsou numericky identické.
//
// Počítá ze SKUTEČNÉHO reálného data, ne z Chronicon fikčního roku 1465
// (stejně jako snapshot.js to dělá pro _computeFast()).

const Liturgical = {
  getEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  },

  // true, pokud "dnes" (reálné datum) leží mezi Popeleční středou
  // (Velikonoce − 46 dní) a Velikonoční nedělí (výlučně).
  isLent(now) {
    now = now || new Date();
    const year = now.getFullYear();
    const easter = Liturgical.getEaster(year);
    const easterDate = new Date(year, easter.month - 1, easter.day);
    const ashDate = new Date(easterDate); ashDate.setDate(easterDate.getDate() - 46);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today >= ashDate && today < easterDate;
  },
};

module.exports = { Liturgical };
