// ============================================
//  CHRONICON — Guilds (Cechy)
//  chronicon-cechy-mrd.md (15.8.2026) — NEJSOU RICNI_ACTORS (data/actors.js).
//  Cechy neprodukujou komoditu (žádný PROD_TABLE/wealth/mood/sezónní
//  modifikátory) — jsou to městský regulační instituce. `tension` =
//  sdílený politický tlak vůči "klášterním kličkám" obecně (imunita,
//  dvůr, privilegia), NE vztah k jednomu konkrétnímu hráči — to zůstává
//  v `GuildsDB.relation` na Scriptorium straně (cechy-a-prava-mrd.md §3).
//
//  MVP (aktivní use-case, cechy-a-prava-mrd.md §1): mlynarsky,
//  truhlarsky, kolarsky, kovarsky.
//  Rezerva (přidána už teď, ať to "žije v Chroniconu" — Scriptorium
//  strana je zapojí postupně): pekarsky, reznicky, zlatnicky, kozeluzsky.
// ============================================

'use strict';

const GUILDS = [
  { id: 'mlynarsky',  label: 'Mlynářský cech',           label_en: 'The Millers\' Guild' },
  { id: 'truhlarsky', label: 'Truhlářský cech',           label_en: 'The Cabinetmakers\' Guild' },
  { id: 'kolarsky',   label: 'Kolářský cech',             label_en: 'The Wheelwrights\' Guild' },
  { id: 'kovarsky',   label: 'Kovářský a hamernický cech', label_en: 'The Smiths\' and Forgemasters\' Guild' },
  { id: 'pekarsky',   label: 'Pekařský cech',             label_en: 'The Bakers\' Guild' },
  { id: 'reznicky',   label: 'Řeznický cech',             label_en: 'The Butchers\' Guild' },
  { id: 'zlatnicky',  label: 'Zlatnický cech',            label_en: 'The Goldsmiths\' Guild' },
  { id: 'kozeluzsky', label: 'Koželužský cech',           label_en: 'The Tanners\' Guild' },
];

const GUILD_TENSION_DEFAULT = 20;

module.exports = { GUILDS, GUILD_TENSION_DEFAULT };
