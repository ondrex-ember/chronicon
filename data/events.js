// ============================================
//  CHRONICON v2 — Event Registry
//  Kurátorovaný výběr z Betlém EVENT_REGISTRY (20 z 91) — jen
//  eventy vážící se na aktéry profilu 'ricni'. T/FX je čistá
//  pomocná DSL z Betlém (žádná React vazba, 1:1 přenositelná).
//  scheduleChain nepoužívá closures (nejsou serializovatelné) —
//  místo toho ukládá {chainId, dueWeek, data} a CHAIN_CALLBACKS
//  je najde podle jména při zpracování fronty.
// ============================================

'use strict';

const { Liturgical } = require('../core/liturgical.js');

const T = {
  season:    (state, ...seasons) => seasons.includes(state.time.season),
  gt:        (state, min, max = 100) => state.globalTension >= min && state.globalTension <= max,
  actor:     (state, id) => state.actors.find(a => a.id === id && a.status !== 'mrtvy'),
  wealth:    (state, id, min, max = 100) => { const a = T.actor(state, id); return a ? (a.wealth >= min && a.wealth <= max) : false; },
  mood:      (state, id, min, max = 100) => { const a = T.actor(state, id); return a ? (a.mood >= min && a.mood <= max) : false; },
  rel:       (state, a, b, min, max = 100) => { const ac = T.actor(state, a); if (!ac) return false; const v = ac.relations[b] || 0; return v >= min && v <= max; },
  les:       (state, min, max = 100) => state.les >= min && state.les <= max,
  epoch:     (state, ...ep) => ep.includes(state.epoch),
  chance:    (p) => Math.random() < p,
};

const FX = {
  tension: (state, d) => { state.globalTension = Math.min(100, Math.max(0, state.globalTension + d)); },
  les:     (state, d) => { state.les = Math.min(100, Math.max(0, state.les + d)); },
  wealth:  (state, id, d) => { const a = T.actor(state, id); if (a) a.wealth = Math.min(100, Math.max(0, a.wealth + d)); },
  mood:    (state, id, d) => { const a = T.actor(state, id); if (a) a.mood = Math.min(100, Math.max(0, a.mood + d)); },
  moodAll: (state, d) => { state.actors.forEach(a => { if (a.status !== 'mrtvy') a.mood = Math.min(100, Math.max(0, a.mood + d)); }); },
  stores:  (state, id, d) => { const a = T.actor(state, id); if (a) a.stores = Math.min(a.storesMax || 60, Math.max(0, a.stores + d)); },
  rel:     (state, a, b, d) => { const ac = state.actors.find(x => x.id === a); if (ac) { const prev = ac.relations[b] !== undefined ? ac.relations[b] : 0; ac.relations[b] = Math.min(100, Math.max(-100, prev + d)); } },
};

function rndText(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

const ACTOR_LABELS = {
  vrchnost: 'Vrchnost', mlynar: 'Mlynář', kovar: 'Kovář', uhlic: 'Uhlíř',
  valach: 'Valach', vorar: 'Vorař', rybnikar: 'Rybníkář', prevoznik: 'Převozník',
  klaster: 'Klášter', vcelar: 'Včelař', lazebnik: 'Lazebník', kupec: 'Kupec',
  sklar: 'Sklář', myslivec: 'Myslivec', tisar: 'Tiskař',
};

function aName(state, id) {
  const a = state.actors.find(x => x.id === id);
  if (a) return `<em>${a.label}</em>`;
  return `<em>${ACTOR_LABELS[id] || id}</em>`;
}

// Anglický protějšek aName() — tension-wave-1-mrd (13.9.2026). Nové eventy
// jsou dvojjazyčné (text_cs/text_en), staré zůstávají česky-only beze změny.
function aNameEn(state, id) {
  const a = state.actors.find(x => x.id === id);
  if (a) return `<em>${a.label_en || a.label}</em>`;
  return `<em>${id}</em>`;
}

// Serializovatelná fronta odložených následků (žádné closures)
const CHAIN_CALLBACKS = {
  a_prival_oprava(state, addChronicle) {
    const m = state.actors.find(x => x.id === 'mlynar');
    const rel = m ? (m.relations['kovar'] || 0) : 0;
    if (rel > 0) {
      FX.rel(state, 'mlynar', 'kovar', 10);
      addChronicle({ type: 'A', icon: '🔨', text: `Náhon je opraven. ${aName(state, 'mlynar')} mele znovu — s vděkem vůči ${aName(state, 'kovar')}i.` });
    } else {
      FX.rel(state, 'mlynar', 'kovar', -12);
      addChronicle({ type: 'C', icon: '⚖️', text: 'Kovář odřekl rychlou opravu. Mlynář si stěžuje u pánského soudu. Starý spor eskaluje.' });
    }
  },
  a_mor_vysledek(state, addChronicle) {
    if (Math.random() < 0.5) {
      FX.wealth(state, 'valach', 5);
      addChronicle({ type: 'A', icon: '💊', text: `Stádo ${aName(state, 'valach')}e se pomalu zotavuje.` });
    } else {
      FX.wealth(state, 'valach', -8);
      addChronicle({ type: 'A', icon: '🪦', text: `Mor ovcí pokračuje. ${aName(state, 'valach')} ztratil třetinu stáda. Zima bude krutá.` });
    }
  },
  // tension-wave-1-mrd (13.9.2026) — následek d_fire_workshop za 4 týdny.
  // data.victimId přichází ze scheduleChain(chainId, delayWeeks, data).
  d_fire_rebuild_outcome(state, addChronicle, data) {
    const victimId = data && data.victimId;
    const victim = victimId && T.actor(state, victimId);
    if (!victim) return;
    if (Math.random() < 0.5) {
      FX.wealth(state, victimId, 6); FX.mood(state, victimId, 8);
      if (victimId !== 'kovar') FX.rel(state, victimId, 'kovar', 10);
      addChronicle({
        type: 'A', icon: '🔨',
        text_cs: `Dílna ${aName(state, victimId)}e stojí znovu na nohou — sousedé pomohli se stavbou dříve, než napadl první sníh.`,
        text_en: `${aNameEn(state, victimId)}'s workshop stands again — neighbours helped rebuild before the first snow fell.`,
      });
    } else {
      FX.mood(state, victimId, -6); FX.wealth(state, victimId, -3);
      addChronicle({
        type: 'C', icon: '🪵',
        text_cs: `Obnova dílny ${aName(state, victimId)}e vázne — dříví na stavbu je drahé a ruce k pomoci řídnou.`,
        text_en: `Rebuilding ${aNameEn(state, victimId)}'s workshop drags on — timber is dear and helping hands grow scarce.`,
      });
    }
  },

  // tension-wave-1-mrd (13.9.2026) — následek c_bandit_raid_road za 3 týdny.
  c_bandit_raid_outcome(state, addChronicle, data) {
    void data; // vyhrazeno pro budoucí rozšíření (např. specifický text dle oběti)
    if (Math.random() < 0.4) {
      FX.tension(state, -3);
      if (T.actor(state, 'vrchnost')) FX.mood(state, 'vrchnost', 5);
      addChronicle({
        type: 'C', icon: '⛓️',
        text_cs: 'Vrchnostenští jezdci dostihli lapky na hranici panství. Uloupené zboží se z valné části vrátilo majitelům.',
        text_en: "The lordship's riders caught up with the bandits at the estate's edge. Most of the stolen goods found their way back to their owners.",
      });
    } else {
      FX.tension(state, 2);
      if (T.actor(state, 'vrchnost')) FX.mood(state, 'vrchnost', -5);
      addChronicle({
        type: 'C', icon: '🌲',
        text_cs: 'Lapkové unikli beze stopy do lesů. Cestující si stále víc stěžují, že cesty nejsou bezpečné.',
        text_en: 'The bandits vanished into the woods without a trace. Travellers complain more and more that the roads are not safe.',
      });
    }
  },

  c_mlyn_rozsudek(state, addChronicle) {
    const klaWins = Math.random() < 0.4;
    addChronicle({
      type: 'D', icon: klaWins ? '✝️' : '⚖️',
      text: klaWins
        ? `${aName(state, 'vrchnost')} rozhodl ve prospěch kláštera. ${aName(state, 'mlynar')} musí odvádět desátek i z mletí.`
        : `${aName(state, 'vrchnost')} zamítl klášterní nároky. Tradiční práva mlynářů zůstávají svobodná.`
    });
    FX.rel(state, 'mlynar', 'klaster', klaWins ? -20 : 10);
  },
};

// weight = relativní šance výběru mezi triggernutými; cooldown = ticky (28/týden) než smí znovu
// chronicon-wave2-deadline-mrd (15.9.2026) — sdílené mezi eligible() a
// trigger() u obou wave-2 once-eventů, ať se ty dvě podmínky nerozejdou.
const _papalEligible = (s) => !!T.actor(s, 'klaster') && T.season(s, 1, 2, 3);
const _leagueEligible = (s) => !!T.actor(s, 'vrchnost') && T.season(s, 2)
  && (s._firedOnceEvents || []).includes('d_papal_citation_1465');

const EVENT_REGISTRY = [
  {
    id: 'a_jaro_prival', type: 'A', icon: '🌊', weight: 2, cooldown: 12,
    trigger: (s) => T.season(s, 0) && !!T.actor(s, 'mlynar') && T.chance(0.06),
    execute: (s, addChronicle, scheduleChain) => {
      FX.wealth(s, 'mlynar', -8); FX.stores(s, 'mlynar', -15); FX.mood(s, 'mlynar', -12); FX.wealth(s, 'kovar', 4);
      scheduleChain('a_prival_oprava', 4);
      return rndText([
        `Jarní příval poškodil náhon ${aName(s, 'mlynar')}e. Mlýn stojí. ${aName(s, 'kovar')} je naléhavě žádán o dodání kování.`,
        'Rozbouřená řeka si vzala kus hráze u brodu. Bez opravy nebude mouka.',
      ]);
    },
  },
  {
    id: 'a_zima_mraz', type: 'A', icon: '❄️', weight: 3, cooldown: 10,
    trigger: (s) => T.season(s, 3) && T.chance(0.06),
    execute: (s) => {
      ['vorar', 'prevoznik', 'vcelar'].forEach(id => { FX.stores(s, id, -12); FX.mood(s, id, -10); });
      FX.tension(s, 6);
      return rndText([
        `Řeka zamrzla přes noc. ${aName(s, 'vorar')} uvízl s dřívím, ${aName(s, 'prevoznik')} zavřel přívoz. Panství je dočasně odříznuto.`,
        'Ledy poškodily vory. Panství přežívá ze zimních zásob.',
      ]);
    },
  },
  {
    id: 'a_mor_dobytek', type: 'A', icon: '🐄', weight: 1, cooldown: 30,
    trigger: (s) => !!T.actor(s, 'valach') && T.epoch(s, 'vrcholny', 'pozdni') && T.chance(0.015),
    execute: (s, addChronicle, scheduleChain) => {
      FX.wealth(s, 'valach', -12); FX.stores(s, 'valach', -20); FX.mood(s, 'valach', -15);
      FX.tension(s, 12); // tension-wave-1-mrd (13.9.2026) retrofit — dřív chybělo úplně
      scheduleChain('a_mor_vysledek', 4);
      return `Stádo ${aName(s, 'valach')}a decimuje neznámá choroba. Léčba je drahá.`;
    },
  },
  {
    id: 'a_uroda_podzim', type: 'A', icon: '🌾', weight: 3, cooldown: 13,
    trigger: (s) => T.season(s, 2) && T.chance(0.07),
    execute: (s) => {
      s.actors.filter(a => a.status !== 'mrtvy').forEach(a => {
        a.stores = Math.min(a.storesMax || 60, a.stores + (a.storesMax || 60) * 0.18);
        a.mood = Math.min(100, a.mood + 6);
      });
      FX.tension(s, -5);
      return `Léto bylo mimořádně štědré. ${aName(s, 'mlynar')} mele dnem i nocí. Panství jde vstříc tučné zimě.`;
    },
  },
  {
    id: 'a_sucho_leto', type: 'A', icon: '☀️', weight: 2, cooldown: 15,
    trigger: (s) => T.season(s, 1) && T.chance(0.04),
    execute: (s) => {
      FX.mood(s, 'mlynar', -10); FX.wealth(s, 'mlynar', -5); FX.mood(s, 'vorar', -8); FX.les(s, -8); FX.tension(s, 4);
      return `Léto zcela bez deště. ${aName(s, 'mlynar')}ovo kolo se točí naprázdno. ${aName(s, 'vorar')} uvízl na mělčině.`;
    },
  },
  {
    id: 'a_vylov_rybniku', type: 'A', icon: '🐟', weight: 2, cooldown: 13,
    trigger: (s) => T.season(s, 2) && !!T.actor(s, 'rybnikar') && T.chance(0.08),
    execute: (s) => {
      FX.wealth(s, 'rybnikar', 10); FX.mood(s, 'rybnikar', 15);
      if (T.actor(s, 'klaster')) FX.rel(s, 'rybnikar', 'klaster', 8);
      return `Velký podzimní výlov začal. ${aName(s, 'rybnikar')} má sítě plné ryb na nasolení pro celé panství.`;
    },
  },
  {
    id: 'a_krupobi', type: 'A', icon: '⛈️', weight: 2, cooldown: 12,
    trigger: (s) => T.season(s, 1) && T.chance(0.04),
    execute: (s) => {
      FX.tension(s, 5); FX.moodAll(s, -8);
      return 'Prudké krupobití poničilo střechy i úrodu. Práce na panství vázne.';
    },
  },
  {
    id: 'b_karavan', type: 'B', icon: '🛒', weight: 2, cooldown: 10,
    trigger: (s) => !!T.actor(s, 'vorar') && T.chance(0.08),
    execute: (s) => {
      FX.wealth(s, 'vorar', 8); FX.tension(s, -3);
      return `Na panství dorazil kupecký vůz. ${aName(s, 'vorar')} třepe měšcem — přivezl sůl a novinky.`;
    },
  },
  {
    id: 'b_klaster_stavba', type: 'B', icon: '🏗️', weight: 2, cooldown: 12,
    trigger: (s) => T.actor(s, 'klaster') && T.wealth(s, 'klaster', 55) && T.chance(0.05),
    execute: (s) => {
      FX.wealth(s, 'klaster', -10); FX.wealth(s, 'kovar', 6); FX.wealth(s, 'uhlic', 4); FX.rel(s, 'klaster', 'kovar', 8); FX.tension(s, -3);
      // chronicon-p0-fix-mrd (14.9.2026), audit-3 bod 17: "románská
      // bazilika" byl anachronismus — v roce 1465 se stavělo/přestavovalo
      // goticky, ne románsky (to bylo hotové +/- 200-300 let dřív).
      return `Opat rozhodl o přestavbě klášterního kostela v gotickém slohu — nová žebrová klenba a vyšší okna mají vpustit víc světla do chóru. ${aName(s, 'kovar')} získává obrovskou panskou zakázku na kování.`;
    },
  },
  {
    id: 'b_pust_ryby', type: 'B', icon: '🐟', weight: 2, cooldown: 10,
    // chronicon-p0-fix-mrd (14.9.2026), audit-3 bod 17: dřív hrubý sezónní
    // odhad (Jaro nebo Zima — skoro půl roku), teď skutečná postní doba
    // (Popeleční středa → Velikonoce), stejný výpočet jako snapshot.js.
    trigger: (s) => Liturgical.isLent() && !!T.actor(s, 'rybnikar') && !!T.actor(s, 'klaster') && T.chance(0.07),
    execute: (s) => {
      FX.wealth(s, 'rybnikar', 8); FX.stores(s, 'rybnikar', -20); FX.wealth(s, 'klaster', -5); FX.rel(s, 'rybnikar', 'klaster', 6);
      return `Nastal přísný předvelikonoční půst a hlad po rybách. ${aName(s, 'rybnikar')} dodává kapry přímo do klášterního refektáře.`;
    },
  },
  {
    id: 'c_spor_voda', type: 'C', icon: '💧', weight: 3, cooldown: 10,
    trigger: (s) => T.actor(s, 'mlynar') && T.actor(s, 'rybnikar') && T.rel(s, 'mlynar', 'rybnikar', -100, -10) && T.chance(0.08),
    execute: (s) => {
      FX.rel(s, 'mlynar', 'rybnikar', -12); FX.rel(s, 'rybnikar', 'mlynar', -10); FX.tension(s, 7);
      return `${aName(s, 'mlynar')} obvinil ${aName(s, 'rybnikar')}a z úmyslného zadržování vody v rybniční strouze.`;
    },
  },
  {
    id: 'c_valach_hranice', type: 'C', icon: '🐺', weight: 2, cooldown: 15,
    trigger: (s) => !!T.actor(s, 'valach') && T.chance(0.04),
    execute: (s) => {
      FX.rel(s, 'valach', 'vrchnost', -12); FX.tension(s, 5);
      if (T.actor(s, 'vrchnost')) FX.wealth(s, 'vrchnost', -3);
      return 'Stádo valašských ovcí překročilo vyznačenou panskou hranici a popáslo cizí polnosti.';
    },
  },
  {
    id: 'c_klaster_mlyn', type: 'C', icon: '⚖️', weight: 1, cooldown: 25,
    trigger: (s) => T.actor(s, 'klaster') && T.actor(s, 'mlynar') && T.rel(s, 'klaster', 'mlynar', 10) && T.wealth(s, 'klaster', 55) && T.chance(0.025),
    execute: (s, addChronicle, scheduleChain) => {
      FX.rel(s, 'mlynar', 'klaster', -25); FX.mood(s, 'mlynar', -18); FX.tension(s, 10);
      scheduleChain('c_mlyn_rozsudek', 6);
      return 'Opat kláštera předložil staré pergamenty dokládající, že mlýn na řece stojí na darované svaté půdě.';
    },
  },
  {
    id: 'c_smireni', type: 'C', icon: '🕊️', weight: 1, cooldown: 20,
    trigger: (s) => s.actors.some(a => a.status !== 'mrtvy' && Object.values(a.relations).some(v => v < -40)) && T.chance(0.035),
    execute: (s) => {
      let worst = null, worstVal = 0;
      s.actors.filter(a => a.status !== 'mrtvy').forEach(a => {
        Object.entries(a.relations).forEach(([bid, val]) => { if (val < worstVal) { worst = [a.id, bid]; worstVal = val; } });
      });
      if (!worst) return null;
      FX.rel(s, worst[0], worst[1], 18); FX.rel(s, worst[1], worst[0], 12); FX.tension(s, -5);
      return `${aName(s, worst[0])} a ${aName(s, worst[1])} usedli za zprostředkování církve k jednomu stolu a urovnali staré spory.`;
    },
  },
  {
    id: 'c_kovar_boom', type: 'C', icon: '⚒️', weight: 2, cooldown: 20,
    trigger: (s) => T.actor(s, 'kovar') && T.wealth(s, 'kovar', 60) && T.chance(0.05),
    execute: (s) => {
      FX.wealth(s, 'kovar', 8); FX.wealth(s, 'vrchnost', 4); FX.rel(s, 'kovar', 'vrchnost', 6);
      return `Panská kovárna ${aName(s, 'kovar')}e nestíhá vyřizovat zakázky ze sousedních újezdů. Hospodářství kvete.`;
    },
  },
  {
    id: 'd_pan_nemoc', type: 'D', icon: '🤒', weight: 1, cooldown: 30,
    trigger: (s) => T.actor(s, 'vrchnost') && ((T.actor(s, 'vrchnost') || {}).ticksActive || 0) > 60 && T.chance(0.02),
    execute: (s) => {
      FX.mood(s, 'vrchnost', -20); FX.wealth(s, 'vrchnost', -4); FX.tension(s, 10);
      return `${aName(s, 'vrchnost')} ulehl se zlou horečkou. Panství se obává o nástupnictví.`;
    },
  },
  {
    id: 'd_nove_dane', type: 'D', icon: '💰', weight: 1, cooldown: 35,
    trigger: (s) => T.epoch(s, 'vrcholny', 'pozdni') && T.chance(0.02),
    execute: (s) => {
      FX.tension(s, 10); FX.moodAll(s, -10); FX.wealth(s, 'vrchnost', 8);
      s.actors.filter(a => a.status !== 'mrtvy' && a.id !== 'klaster').forEach(a => { a.wealth = Math.max(0, a.wealth - 3); });
      return `Zemský sněm vyhlásil mimořádnou berni na obranu hranic. ${aName(s, 'vrchnost')} musí vybrat stříbro od všech poddaných.`;
    },
  },
  {
    id: 'd_vizitace', type: 'D', icon: '⛪', weight: 1, cooldown: 30,
    trigger: (s) => T.actor(s, 'klaster') && T.epoch(s, 'vrcholny', 'pozdni') && T.chance(0.025),
    execute: (s) => {
      FX.mood(s, 'klaster', -12); FX.wealth(s, 'klaster', -4);
      return 'Z diecéze dorazil neohlášený biskupský vizitátor. V klášteře narychlo schovávají drahé poháry a víno.';
    },
  },
  {
    id: 'e_vorar_zpravy', type: 'E', icon: '⚓', weight: 2, cooldown: 12,
    trigger: (s) => T.actor(s, 'vorar') && ((T.actor(s, 'vorar') || {}).ticksActive || 0) > 10 && T.chance(0.04),
    execute: (s) => {
      FX.wealth(s, 'vorar', 6);
      return `${aName(s, 'vorar')} přirazil vor k panským molům a přivezl vzácné zprávy o dění v sousedním kraji.`;
    },
  },
  {
    id: 'e_uhlic_nemoc', type: 'E', icon: '🤒', weight: 2, cooldown: 18,
    trigger: (s) => T.actor(s, 'uhlic') && T.mood(s, 'uhlic', 0, 30) && T.chance(0.06),
    execute: (s) => {
      FX.mood(s, 'uhlic', -12); FX.wealth(s, 'uhlic', -6);
      return `${aName(s, 'uhlic')} těžce onemocněl z uhelného dýmu. Milíře doutnají bez dozoru a hrozí vyhasnutí pecí.`;
    },
  },

  // ============================================
  //  TENSION WAVE 1 — tension-wave-1-mrd (13.9.2026)
  //  Nová anglická ID (na rozdíl od starých českých slugů výš) — dohodnuto
  //  s Bouvardem. Dvojjazyčné text_cs/text_en (execute() vrací objekt
  //  místo řetězce — engine.js blok 3b to teď umí obojí).
  // ============================================

  {
    id: 'd_fire_workshop', type: 'D', icon: '🔥', weight: 1, cooldown: 18,
    trigger: (s) => ['kovar', 'uhlic', 'sklar'].some(id => T.actor(s, id)) && T.chance(0.03),
    execute: (s, addChronicle, scheduleChain) => {
      const candidates = ['kovar', 'uhlic', 'sklar'].filter(id => T.actor(s, id));
      const victimId = candidates[Math.floor(Math.random() * candidates.length)];
      FX.wealth(s, victimId, -8); FX.stores(s, victimId, -15); FX.mood(s, victimId, -14);
      FX.moodAll(s, -3); FX.tension(s, 12);
      if (victimId === 'uhlic') FX.les(s, -4); // milíř v lese — oheň se snáz šíří dál
      scheduleChain('d_fire_rebuild_outcome', 4, { victimId });
      return {
        text_cs: `Z dílny ${aName(s, victimId)}e vyšlehly v noci plameny — jiskra z výhně přeskočila na suchou střechu. Než sousedé donosili vodu, oheň strávil půl stavení i zásoby uvnitř. Kouř byl prý vidět až od kláštera.`,
        text_en: `Flames broke out at night in ${aNameEn(s, victimId)}'s workshop — a spark from the forge caught the dry roof. Before neighbours could carry enough water, the fire had consumed half the building and the stores within. The smoke, they say, was seen as far as the monastery.`,
      };
    },
  },
  {
    id: 'd_poor_harvest', type: 'D', icon: '🥀', weight: 2, cooldown: 16,
    trigger: (s) => T.season(s, 2) && T.chance(0.035),
    execute: (s) => {
      s.actors.filter(a => a.status !== 'mrtvy').forEach(a => {
        a.stores = Math.max(0, a.stores - (a.storesMax || 60) * 0.12);
        a.mood = Math.max(0, a.mood - 10);
      });
      FX.tension(s, 14);
      return {
        text_cs: 'Podzimní sklizeň byla hubená — zrno v klasech bylo řídké a mnohé pole zůstalo napůl prázdné. Sedláci počítají pytle a mlčí. Zima bude dlouhá.',
        text_en: 'The autumn harvest was thin — the grain stood sparse in the ear, and many fields were left half-bare. The farmers count their sacks in silence. Winter will be long.',
      };
    },
  },
  {
    id: 'c_bandit_raid_road', type: 'D', icon: '🏹', weight: 2, cooldown: 14,
    trigger: (s) => (T.actor(s, 'vorar') || T.actor(s, 'prevoznik')) && T.chance(0.03),
    execute: (s, addChronicle, scheduleChain) => {
      const candidates = ['vorar', 'prevoznik'].filter(id => T.actor(s, id));
      const victimId = candidates[Math.floor(Math.random() * candidates.length)];
      FX.wealth(s, victimId, -10); FX.stores(s, victimId, -10); FX.mood(s, victimId, -15);
      if (T.actor(s, 'vrchnost')) FX.wealth(s, 'vrchnost', -4);
      FX.tension(s, 12);
      scheduleChain('c_bandit_raid_outcome', 3, { victimId });
      return {
        text_cs: `Na cestě k brodu přepadli lapkové ${aName(s, victimId)}ův povoz. Zboží je pryč, kůň zraněný. Vrchnost slibuje spravedlnost, ale cesty jsou dlouhé a hlídek málo.`,
        text_en: `Bandits ambushed ${aNameEn(s, victimId)}'s cart on the road to the ford. The goods are gone, the horse wounded. The lordship promises justice, but the roads are long and the watch is thin.`,
      };
    },
  },
  {
    id: 'd_feudal_skirmish', type: 'D', icon: '⚔️', weight: 1, cooldown: 25,
    trigger: (s) => T.actor(s, 'vrchnost') && T.epoch(s, 'vrcholny', 'pozdni') && T.chance(0.02),
    execute: (s) => {
      FX.mood(s, 'vrchnost', -15); FX.wealth(s, 'vrchnost', -8);
      FX.moodAll(s, -4); FX.tension(s, 16);
      return {
        text_cs: 'Sousedský spor o mez přerostl v ozbrojenou potyčku — dva dvory vypáleny, čeleď zraněna. Vrchnost svolává hotovost, ale klid v kraji je ten tam.',
        text_en: "A boundary dispute between neighbours turned to armed skirmish — two farmsteads burned, servants wounded. The lordship musters its men, but peace in the land is gone for now.",
      };
    },
  },
  {
    id: 'c_landfriede_declared', type: 'C', icon: '📯', weight: 2, cooldown: 15,
    trigger: (s) => T.actor(s, 'vrchnost') && T.gt(s, 50, 100) && T.chance(0.04),
    execute: (s) => {
      FX.tension(s, -12); FX.wealth(s, 'vrchnost', -3); FX.mood(s, 'vrchnost', 5);
      return {
        text_cs: 'Vrchnost svolala okolní pány a vyhlásila zemský mír — kdo bude nadále loupit, propadne cti i majetku. Na několik týdnů je na cestách klidněji.',
        text_en: 'The lordship summoned the neighbouring lords and proclaimed a land peace — whoever continues to plunder shall forfeit both honour and property. For a few weeks, the roads grow quieter.',
      };
    },
  },

  // ============================================
  //  TENSION WAVE 2 — chronicon-wave2-mrd (14.9.2026)
  //  Datované politické beaty roku 1465, fired-once (viz ev.once + engine.js
  //  blok 3b). Konkrétní historická jména dle dohody s Bouvardem — u
  //  datovaných beatů jmenovat, u generických eventů ne.
  //
  //  chronicon-wave2-deadline-mrd (15.9.2026): forceAfterWeeks — absolutní
  //  pojistka, aby se tahle konkrétní historická událost v žádném světě
  //  nemohla "prostě nestat" jen kvůli smůle na kostce. eligible() je
  //  stejná podmínka jako trigger(), sdílená přes lokální funkci, aby
  //  se to nerozešlo, kdyby se jedna z nich upravila a druhá ne.
  // ============================================

  {
    id: 'd_papal_citation_1465', type: 'D', icon: '📜', weight: 1, cooldown: 20, once: true,
    // chronicon-wave2-deadline-mrd (15.9.2026), zpřesněno 15.9.2026: 13
    // (ne 26) — worst-case vynucení musí padnout NEJPOZDĚJI do konce Léta
    // (jeho první eligible sezóny), aby jednotě zbyl celý Podzim (13
    // týdnů) na její vlastní forceAfterWeeks:10. S 26 by se teoreticky
    // mohly obě spadnout do dvou různých let (ověřeno testem).
    forceAfterWeeks: 13,
    eligible: _papalEligible,
    // chronicon-wave2-fix-mrd (14.9.2026): gate rozšířen z Léto-only na
    // Léto/Podzim/Zima — text nezmiňuje konkrétní datum, "zpráva z Říma
    // dorazila" i na podzim/v zimě je věrohodné (pomalá komunikace 1465).
    // Jaro záměrně vynecháno — to by bylo dřív než srpen 1465.
    trigger: (s) => _papalEligible(s) && T.chance(0.15),
    execute: (s) => {
      FX.mood(s, 'klaster', -12); FX.rel(s, 'klaster', 'vrchnost', -8); FX.tension(s, 14);
      return {
        text_cs: 'Z Říma dorazila zpráva, která znepokojila celé království: papež Pavel II. obnovil půhon proti králi Jiřímu a předvolal ho před římský soud. Krátce nato prý dostali papežovi legáti pravomoc stíhat klatbou i ty, kdo zůstávají věrni koruně. Opat čte list potichu a dlouho mlčí.',
        text_en: 'News arrived from Rome that has troubled the whole kingdom: Pope Paul II renewed the citation against King George and summoned him before the Roman court. Soon after, it is said, the papal legates were granted the power to pursue with excommunication even those who remain loyal to the Crown. The abbot reads the letter in silence, and says nothing for a long while.',
      };
    },
  },
  {
    id: 'd_green_mountain_league', type: 'D', icon: '⚜️', weight: 1, cooldown: 20, once: true,
    // chronicon-wave2-deadline-mrd (15.9.2026): jednota má eligible okno
    // jen 1 sezónu (Podzim, ~13 týdnů) na rozdíl od půhonu (3 sezóny,
    // ~39 týdnů) — nižší hranice, ať se vynucení vejde do PRVNÍHO podzimu
    // po půhonu, ne až do druhého.
    forceAfterWeeks: 10,
    eligible: _leagueEligible,
    // Historické pořadí: musí proběhnout AŽ PO d_papal_citation_1465
    // (srpen → listopad 1465) — vynuceno přes _leagueEligible.
    trigger: (s) => _leagueEligible(s) && T.chance(0.15),
    execute: (s) => {
      FX.tension(s, 16); FX.moodAll(s, -5);
      if (T.actor(s, 'klaster')) FX.rel(s, 'klaster', 'vrchnost', -5);
      return {
        text_cs: 'Z Čech přišla zpráva: na Zelené Hoře se katoličtí páni v čele se Zdeňkem ze Šternberka spojili proti králi Jiřímu. V hostincích i kapitulních síních se šeptá, kdo zůstane věrný koruně a kdo se přikloní k odpůrcům — a nikdo na panství neví, přidá-li se i Morava.',
        text_en: 'News has come from Bohemia: at Zelená Hora, Catholic lords led by Zdeněk ze Šternberka have joined together against King George. In taverns and chapter halls men whisper about who will remain loyal to the Crown and who will side with its opponents — and no one on the estate knows whether Moravia, too, will join.',
      };
    },
  },

  // ============================================
  //  TENSION WAVE 3 — chronicon-wave3-mrd (14.9.2026)
  //  Regionální varianty vedle stávajících a_jaro_prival/a_krupobi (ty se
  //  nemění), + odložený mercenary levy.
  // ============================================

  {
    id: 'c_regional_flood', type: 'C', icon: '🌉', weight: 1, cooldown: 30,
    trigger: (s) => ['vorar', 'prevoznik', 'rybnikar'].some(id => T.actor(s, id)) && T.season(s, 0) && T.chance(0.015),
    execute: (s) => {
      ['vorar', 'prevoznik', 'rybnikar'].forEach(id => {
        if (T.actor(s, id)) { FX.wealth(s, id, -6); FX.mood(s, id, -8); }
      });
      FX.tension(s, 12);
      return {
        text_cs: 'Morava se rozvodnila v celém kraji — voda strhla lávku u brodu, potopila několik rybníků a vor uvízl na naplaveném dříví. Škody hlásí skoro každý, kdo žije u vody.',
        text_en: 'The Morava has flooded across the whole region — the water swept away the footbridge at the ford, drowned several fishponds, and a raft ran aground on driftwood. Nearly everyone who lives by the water reports damage.',
      };
    },
  },
  {
    id: 'd_severe_hailstorm', type: 'D', icon: '🧊', weight: 1, cooldown: 30,
    trigger: (s) => (T.actor(s, 'mlynar') || T.actor(s, 'vcelar')) && T.season(s, 1, 2) && T.chance(0.015),
    execute: (s) => {
      if (T.actor(s, 'mlynar')) FX.stores(s, 'mlynar', -10);
      if (T.actor(s, 'vcelar')) { FX.wealth(s, 'vcelar', -8); FX.mood(s, 'vcelar', -10); }
      FX.tension(s, 12);
      return {
        text_cs: 'Kroupy velké jako vlašské ořechy bily přes čtvrt hodiny. Obilí v pytlích na mlýně navlhlo skrz rozbitou střechu a včelaři popadaly úly i s roji.',
        text_en: 'Hailstones the size of walnuts battered the land for a quarter of an hour. Grain sacks at the mill soaked through a shattered roof, and the beekeeper lost hives, swarms and all.',
      };
    },
  },
  {
    id: 'd_mercenary_levy', type: 'D', icon: '🛡️', weight: 1, cooldown: 30,
    trigger: (s) => T.actor(s, 'vrchnost') && T.epoch(s, 'vrcholny', 'pozdni') && T.chance(0.018),
    execute: (s) => {
      FX.wealth(s, 'vrchnost', -6); FX.moodAll(s, -6);
      if (T.actor(s, 'kovar')) FX.wealth(s, 'kovar', 5);
      FX.tension(s, 10);
      return {
        text_cs: 'Vrchnost povolala hotovost — muži odcházejí od pluhů a kovadlin s kopími na rameni. Kovář má plné ruce práce s brněním, ale pole zůstávají napůl obdělaná.',
        text_en: "The lordship has called the levy — men leave plough and anvil, spears on their shoulders. The blacksmith's hands are full with armour, but the fields stand half-tilled.",
      };
    },
  },
];

module.exports = { T, FX, rndText, aName, ACTOR_LABELS, EVENT_REGISTRY, CHAIN_CALLBACKS };
