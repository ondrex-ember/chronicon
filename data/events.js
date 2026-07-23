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

const T = {
  season:    (state, s) => state.time.season === s,
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
      return `Opat rozhodl o stavbě nové románské baziliky. ${aName(s, 'kovar')} získává obrovskou panskou zakázku na kování.`;
    },
  },
  {
    id: 'b_pust_ryby', type: 'B', icon: '🐟', weight: 2, cooldown: 10,
    trigger: (s) => (T.season(s, 0) || T.season(s, 3)) && !!T.actor(s, 'rybnikar') && !!T.actor(s, 'klaster') && T.chance(0.07),
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
];

module.exports = { T, FX, rndText, aName, ACTOR_LABELS, EVENT_REGISTRY, CHAIN_CALLBACKS };
