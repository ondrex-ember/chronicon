// ============================================
//  CHRONICON — Advisory Resolved Register
//  Čte data/advisory_resolved_register.json — flat mapa
//  { advisoryId: resolvedAtTimestamp }, kterou tam commituje Scriptorium
//  (api/advisory-resolve-report.js, generický resolve-report, 28.8.2026,
//  knihovna-rozsireni-mrd oprava).
//
//  Řeší: single-slot pending advisory (pendingStudovna/pendingCtenar/
//  pendingVypujcka) se dřív nikdy nemazaly — žádný kanál nehlásil zpět
//  "hráč rozhodl", takže guard `if (!GameState.pendingX)` navždy
//  blokoval další žádost stejného typu po první, co kdy padla.
//
//  Mirror core/contact-relation-register.js 1:1 — jen jednodušší tvar
//  dat (flat id→timestamp, ne per-den kbelíky, protože tady nejde
//  o vážený průměr, jen o "bylo/nebylo vyřešeno").
//  Tiché selhání, pokud soubor chybí/je poškozený.
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'data', 'advisory_resolved_register.json');

const AdvisoryResolvedRegisterSystem = {

  // Vrací true, pokud Scriptorium nahlásilo tohle konkrétní advisory ID
  // jako vyřešené (accept/decline, nikdy 'defer' — viz Scriptorium strana
  // ChroniconSystem._resolveAdvisory()). false při chybějícím/poškozeném
  // souboru nebo neznámém ID — nikdy nespadne.
  isResolved: function (id) {
    if (!id) return false;
    if (!fs.existsSync(REGISTER_PATH)) return false;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8'));
    } catch (err) {
      console.warn('[ADVISORY_RESOLVED_REGISTER] soubor poškozený:', err.message);
      return false;
    }

    return typeof data[id] === 'number';
  },

};

module.exports = { AdvisoryResolvedRegisterSystem };
