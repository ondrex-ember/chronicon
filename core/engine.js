// ============================================
//  CHRONICON v2 — Engine
//  V1→V2: computeRates()/applyResources() (monk economy, nikdy
//  fungující — assignments nikdy nenastaveny) NAHRAZENO týdenní
//  ekonomikou z Betlém (produkce/spotřeba/vztahy/napětí), s
//  NATVRDO vynuceným "nikdy nekolabuje" pravidlem (viz bod 6
//  v runWeeklyEconomy — Betlém "fenix" chování, ale bez volby).
//
//  Kadence: 1 tick = 6h (4×/den, kontrakt se Scriptoriem).
//  Den se posouvá jednou za 4 ticky (oprava proti V1, kde se
//  "day" posouval každý tick — 4× rychleji, než napovídal název).
//  Týdenní ekonomika běží jednou za 28 ticků (7 dní).
// ============================================

'use strict';

const { GameState, StateHelpers } = require('./state.js');
const { WeatherSystem }           = require('./weather.js');
const { RegisterSystem }          = require('./register.js');
const { RescueRegisterSystem }    = require('./rescue-register.js');
const { VrchnostRegisterSystem }  = require('./vrchnost-register.js');
const { ActorFavorRegisterSystem } = require('./actor-favor-register.js');
const { ContactRelationRegisterSystem } = require('./contact-relation-register.js');
const { AdvisoryResolvedRegisterSystem } = require('./advisory-resolved-register.js');
const { GuildRegisterSystem }           = require('./guild-register.js');
const {
  PROD_TABLE, SEASON_MODS, COMMODITY_VALUE, SEASON_DEMAND,
  PROD_BLOCK_TEXTS, RELATION_THRESHOLD_TEXTS, MATERIAL_REQUEST_POOL,
} = require('../data/actors.js');
const { EVENT_REGISTRY, CHAIN_CALLBACKS } = require('../data/events.js');

// ============================================
//  GameLog (beze změny z V1)
// ============================================

const GameLog = {

  MAX_ENTRIES: 80,

  add(text, options = {}) {
    const time = GameState.time;

    const entry = {
      text,
      text_cs: options.text_cs || text,
      text_en: options.text_en || null,
      type:   options.type   || 'A',
      icon:   options.icon   || null,
      source: options.source || 'engine',
      tick:   time.totalTick,
      year:   time.year,
      season: StateHelpers.seasonName(),
      day:    time.day,
    };

    GameState.log.unshift(entry);

    if (GameState.log.length > GameLog.MAX_ENTRIES) {
      GameState.log.pop();
    }

    return entry;
  },

  addOnce(key, text, options = {}, cooldownTicks = 3) {
    const last = GameState._lastChronicle[key];
    if (last && (GameState.time.totalTick - last.tick) < cooldownTicks) {
      return null;
    }
    const entry = GameLog.add(text, options);
    GameState._lastChronicle[key] = { tick: GameState.time.totalTick, text };
    return entry;
  },

};

// ============================================
//  Relation threshold helper (port z Betlém checkRelThresholds)
// ============================================

function checkRelThreshold(prev, next) {
  if (prev >= -20 && next < -20) return 'negative_20';
  if (prev >= -40 && next < -40) return 'negative_40';
  if (prev >= -60 && next < -60) return 'negative_60';
  if (prev <= 40 && next > 40) return 'positive_40';
  if (prev <= 75 && next > 75) return 'positive_75';
  return null;
}

// ============================================
//  GameEngine
// ============================================

const GameEngine = {

  // Hlavní tick — volán 4× denně z cron.js
  async tick() {
    GameState.time.totalTick++;

    // 1. Počasí — reálné z Open-Meteo (Sprint 2), s tichým fallbackem na
    // náhodný roll při výpadku sítě (viz WeatherSystem.roll)
    const weatherChronicle = await WeatherSystem.roll();
    if (weatherChronicle) {
      GameLog.add(weatherChronicle, {
        type:   'A',
        icon:   GameState.weather.icon,
        source: 'weather',
      });
    }

    // 2. Kalendář — vždy synchronizovaný s reálným datem (Europe/Prague),
    // ne přírůstkové počítání ticků. Imunní vůči resetům/výpadkům/downtimu.
    await GameEngine.syncCalendar();

    // 3. Denní dýchání aktérů (Krok D, drobné živé pohyby nálady/jmění
    // KAŽDÝ tik, ne jen týdně) — vizuálně dělá svět živější mezi
    // velkými týdenními vyhodnoceními, které zůstávají beze změny.
    GameEngine.actorBreathTick();

    // 4. Týdenní ekonomika (Betlém model) — jednou za 28 ticků (7 dní)
    if (GameState.time.totalTick % 28 === 0) {
      GameEngine.runWeeklyEconomy();
    }
  },

  // Krok D — drobný náhodný pohyb nálady/jmění při KAŽDÉM tiku (4–6×/den),
  // nezávisle na runWeeklyEconomy (ta zůstává beze změny, běží dál jen na
  // 28 ticích). Mírný tah podle globálního napětí — klidný kraj lehce
  // zlepšuje náladu, napjatý lehce zhoršuje. Mrtví aktéři se nehýbou.
  actorBreathTick() {
    const actors = GameState.actors;
    if (!Array.isArray(actors)) return;
    const tensionPull = GameState.globalTension > 60 ? -1 : (GameState.globalTension < 30 ? 1 : 0);
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      a.mood   = Math.max(0, Math.min(100, a.mood   + (Math.random() * 4 - 2) + tensionPull));
      a.wealth = Math.max(0, Math.min(100, a.wealth + (Math.random() * 2 - 1)));
    });
  },

  async syncCalendar() {
    const time = GameState.time;
    const real = StateHelpers.realCalendar();

    if (real.season !== time.season) {
      await GameEngine.onSeasonEnd(real);
    } else {
      time.day = real.day;
    }
  },

  async onSeasonEnd(real) {
    const seasonNames = ['Jaro', 'Léto', 'Podzim', 'Zima'];
    const seasonIcons = ['🌱', '☀️', '🍂', '❄️'];

    GameLog.add(
      `${seasonIcons[real.season]} ${seasonNames[real.season]} Léta Páně ${real.year} začíná.`,
      { type: 'A', icon: seasonIcons[real.season], source: 'engine' }
    );

    GameState.time.season = real.season;
    GameState.time.year   = real.year;
    GameState.time.day    = real.day;

    await WeatherSystem.init();
  },

  // ── Týdenní ekonomika (port z Betlém runWeeklyTick, jádro) ──────────────
  runWeeklyEconomy() {
    const actors = GameState.actors;
    const seasonIdx = GameState.time.season;
    GameState.week += 1;

    // Snapshot statusů PŘED tímto tikem — pro detekci "nově vstoupil do krize"
    // (pendingHospites, viz níž za blokem 4). Pokrývá jak mor, tak wealth/mood
    // cestu do krize jedním místem, beze změny existující mutační logiky.
    const prevStatusById = {};
    actors.forEach(a => { prevStatusById[a.id] = a.status; });

    actors.forEach(a => { a._pulseReason = null; a.ticksActive = (a.ticksActive || 0) + 1; });

    // 0. Splatné odložené následky (scheduleChain z minulých týdnů)
    const addChronicleFn = (entry) => GameLog.add(entry.text, { type: entry.type, icon: entry.icon, source: 'monastery_internal' });
    GameState._chainQueue = (GameState._chainQueue || []).filter(item => {
      if (item.dueWeek > GameState.week) return true;
      const cb = CHAIN_CALLBACKS[item.chainId];
      if (cb) cb(GameState, addChronicleFn);
      return false;
    });

    // 1. Produkce (blokace při mrtvém dodavateli, 50% při krizi dodavatele)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const pDef = PROD_TABLE[a.id];
      if (!pDef) return;

      let blocked = false, crisisInDeps = false;
      const missing = [];
      pDef.deps.forEach(depId => {
        const dep = actors.find(x => x.id === depId);
        if (!dep || dep.status === 'mrtvy') { blocked = true; missing.push(depId); }
        else if (dep.status === 'krize' || dep.status === 'zanikajici') crisisInDeps = true;
      });

      if (blocked) {
        const key = missing[0] ? (a.id + '_' + missing[0]) : null;
        const pool = (key && PROD_BLOCK_TEXTS[key]) || PROD_BLOCK_TEXTS.default;
        a._pulseReason = pool[Math.floor(Math.random() * pool.length)].replace('{actor}', a.label);
        a.mood = Math.max(0, a.mood - 12);

        // Žádost o surovinu na hráče — zakazky-centralizace-mrd Fáze 2
        // (26.7.2026). Max 1 aktivní najednou (stejný vzor jako Studovna).
        if (!GameState.pendingMaterialRequest) {
          const req = MATERIAL_REQUEST_POOL[a.id];
          if (req) {
            GameState.pendingMaterialRequest = {
              id: 'material_' + a.id + '_' + GameState.week,
              actorId: a.id, itemId: req.itemId, qty: req.qty,
              deadlineDays: req.days, rewardGrose: req.grose,
            };
          }
        }
        return;
      }

      let prodMultiplier = 1;
      if (crisisInDeps) {
        prodMultiplier *= 0.5;
        a._pulseReason = 'Výroba omezena na 50 % kvůli potížím dodavatelů.';
      }

      const sMods = SEASON_MODS[a.id] || SEASON_MODS.default;
      const [seasonProdMod, seasonMoodDelta] = sMods[seasonIdx] || [1.0, 0];
      prodMultiplier *= seasonProdMod;
      a.mood = Math.min(100, Math.max(0, a.mood + seasonMoodDelta));

      if (a.mood < 30) prodMultiplier *= (a.mood / 100);
      else if (a.mood > 80) prodMultiplier *= 1.25;

      const rawProd = pDef.base * prodMultiplier;
      a.stores = Math.min(a.storesMax || 80, a.stores + rawProd);

      // Item-úroveň produkce (sdileny-pool-mrd v2, 26.7.2026) — stejný
      // prodMultiplier, stejné early-return brzdy (mrtvy/blocked/crisis)
      // jako stores o řádek výš — mrtvý dodavatel = 0 produkce i tady,
      // ne zastaralá hodnota z minulého týdne.
      if (pDef.producesItems) {
        if (!a.itemStock) a.itemStock = {};
        Object.entries(pDef.producesItems).forEach(([itemId, cfg]) => {
          const cur = a.itemStock[itemId] || 0;
          a.itemStock[itemId] = Math.min(cfg.cap, cur + cfg.rate * prodMultiplier);
        });
      }
    });

    // 2. Spotřeba a obchod (přebytek → bohatství)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const pDef = PROD_TABLE[a.id];
      const produces = pDef ? pDef.produces : '';
      const cons = 2.0;

      if (a.stores >= cons) {
        a.stores -= cons;
        const surplus = a.stores * 0.35;
        if (surplus > 0.5) {
          const val = COMMODITY_VALUE[produces] || 1.0;
          const sDemand = (SEASON_DEMAND[produces] && SEASON_DEMAND[produces][seasonIdx]) || 1.0;
          const revenue = surplus * val * sDemand;
          a.stores -= surplus;
          a.wealth = Math.min(100, a.wealth + revenue);
        }
      } else {
        a.stores = 0;
        a.mood = Math.max(0, a.mood - 16);
        a.wealth = Math.max(0, a.wealth - 10);
        a._pulseReason = 'Hladoví! Zásoby potravin a materiálu došly.';
      }
    });

    // 3. Vztahy — jemný posun podle společné nálady, s prahovými hláškami
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      Object.keys(a.relations).forEach(otherId => {
        const other = actors.find(x => x.id === otherId);
        if (!other || other.status === 'mrtvy') return;
        const moodPair = (a.mood + other.mood) / 2;
        const drift = moodPair > 60 ? 0.6 : moodPair < 35 ? -0.6 : 0;
        if (drift === 0) return;

        const prev = a.relations[otherId] || 0;
        const next = Math.max(-100, Math.min(100, prev + drift));
        a.relations[otherId] = next;

        const crossed = checkRelThreshold(prev, next);
        if (crossed && RELATION_THRESHOLD_TEXTS[crossed]) {
          const pool = RELATION_THRESHOLD_TEXTS[crossed];
          const txt = pool[Math.floor(Math.random() * pool.length)]
            .replace('{a}', a.label).replace('{b}', other.label);
          GameLog.addOnce('rel_' + a.id + '_' + otherId + '_' + crossed, txt,
            { type: 'C', icon: '🤝', source: 'monastery_internal' }, 12);
        }
      });
    });

    // 3b. Náhodné příběhové eventy (kurátorovaný výběr z Betlém EVENT_REGISTRY)
    const cooldowns = GameState._eventCooldowns || {};
    Object.keys(cooldowns).forEach(k => { if (cooldowns[k] > 0) cooldowns[k] -= 1; else delete cooldowns[k]; });
    const scheduleChain = (chainId, delayWeeks) => {
      GameState._chainQueue.push({ chainId, dueWeek: GameState.week + delayWeeks });
    };
    const pool = EVENT_REGISTRY.filter(ev => {
      if ((cooldowns[ev.id] || 0) > 0) return false;
      try { return ev.trigger(GameState); } catch (e) { return false; }
    });
    if (pool.length > 0) {
      const totalW = pool.reduce((acc, ev) => acc + ev.weight, 0);
      let rand = Math.random() * totalW;
      let selected = pool[0];
      for (const ev of pool) { rand -= ev.weight; if (rand <= 0) { selected = ev; break; } }
      try {
        cooldowns[selected.id] = selected.cooldown;
        const resText = selected.execute(GameState, addChronicleFn, scheduleChain);
        if (resText) GameLog.add(resText, { type: selected.type, icon: selected.icon, source: 'monastery_internal' });
      } catch (e) { /* selhání eventu je tiché — neshodí tick */ }
    }
    GameState._eventCooldowns = cooldowns;

    // 3c. Epidemie a demografie (port z Betlém — Černá smrt, hladomor, nepokoje)
    // Poznámka: _quarantined/_epidemicImmunity zůstávají nenastavené (žádný
    // hráč v headless enginu je nemůže nastavit) — mor běží podle přirozené
    // pravděpodobnosti. Advisory event pro Scriptorium navazuje v Sprintu 2/3.
    let weekDeaths = 0;
    const weekBirths = Math.floor(Math.random() * 8) + 6;
    const activePlague = actors.filter(a => a._infected && a.status !== 'mrtvy').length;
    if (GameState.week >= 8 && activePlague === 0 && Math.random() < 0.05) {
      const candidates = actors.filter(a => a.id !== 'vrchnost' && a.status !== 'mrtvy' && !a._infected && !a._epidemicImmunity);
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim._infected = true; victim.status = 'krize'; victim.mood = Math.max(0, victim.mood - 25);
        GameLog.add(
          `ČERNÁ SMRT: V domě poplatníka ${victim.label} vypukla morová rána! Lidé umírají v horečkách, strach se šíří údolím.`,
          { type: 'D', icon: '☣️', source: 'monastery_internal' }
        );
      }
    }
    actors.forEach(a => {
      if (a.id === 'vrchnost' || a.status === 'mrtvy' || !a._infected) return;
      let casualties = Math.floor(Math.random() * 80) + 70;
      if (a._quarantined) casualties = Math.floor(casualties * 0.4);
      weekDeaths += casualties;
      a.stores = Math.max(0, a.stores - 4); a.wealth = Math.max(0, a.wealth - 6); a.mood = Math.max(0, a.mood - 12);
      if (Math.random() < (a._quarantined ? 0.08 : 0.22)) {
        a._infected = false; a._quarantined = false; a.status = 'mrtvy'; a._deathWeek = GameState.week;
        GameLog.add(`Poplatník ${a.label} podlehl Černé smrti.`, { type: 'E', icon: '💀', source: 'monastery_internal' });
        // Právo sepultury — pokud zemřelý nebyl chudý, rodina může žádat o
        // pohřeb uvnitř kláštera. Probošt gate řeší Scriptorium samo
        // (CHRONICON nezná rank jednotlivých hráčů, svět je sdílený).
        if (a.wealth >= 50) {
          if (!GameState.pendingSepulturas) GameState.pendingSepulturas = [];
          GameState.pendingSepulturas.push({
            id: 'chronicon_sepultura_' + a.id + '_' + GameState.week,
            name: a.label, profession: a.profession, wealth: Math.round(a.wealth), week: GameState.week,
          });
          if (GameState.pendingSepulturas.length > 10) GameState.pendingSepulturas.shift();
        }
      } else if (Math.random() < 0.25) {
        // Přirozené uzdravení — bez tohohle mor v headless enginu (bez
        // hráčovy karantény/léčby) nikdy sám nekončí a stane se trvale
        // endemickým. Ohraničuje vlnu na pár týdnů, jak má dramatický beat být.
        a._infected = false; a._quarantined = false; a._epidemicImmunity = true; a._immunityWeek = GameState.week;
        GameLog.add(`${a.label} přestál nákazu a uzdravil se. Sousedé děkují Bohu.`,
          { type: 'C', icon: '💪', source: 'monastery_internal' });
      }
    });
    // Imunita časem slábne (~20 týdnů) — jinak by po dost letech byl celý
    // kraj natrvalo imunní a mor by se už nikdy nemohl vrátit.
    actors.forEach(a => {
      if (a._epidemicImmunity && GameState.week - (a._immunityWeek || 0) > 20) {
        delete a._epidemicImmunity;
        delete a._immunityWeek;
      }
    });
    const infectedNow = actors.filter(a => a.id !== 'vrchnost' && a.status !== 'mrtvy' && a._infected && !a._quarantined).length;
    if (infectedNow > 0) {
      actors.forEach(a => {
        if (a.id !== 'vrchnost' && a.status !== 'mrtvy' && !a._infected && !a._epidemicImmunity) {
          if (Math.random() < 0.22 * infectedNow) {
            a._infected = true; a.status = 'krize'; a.mood = Math.max(0, a.mood - 20);
            GameLog.add(`Černá smrt přeskočila na dvůr poplatníka ${a.label}! Lidé propadají panice.`,
              { type: 'D', icon: '☣️', source: 'monastery_internal' });
          }
        }
      });
    }
    actors.forEach(a => {
      if (a.id === 'vrchnost' || a.status === 'mrtvy') return;
      if (a.stores === 0) weekDeaths += Math.floor(Math.random() * 25) + 15;
    });
    if (GameState.globalTension > 75) weekDeaths += Math.floor(GameState.globalTension * 0.3);
    GameState.totalDeaths += weekDeaths;
    GameState.totalPopulation = Math.max(500, GameState.totalPopulation - weekDeaths + weekBirths);
    // Farní pohřby pro Scriptorium (před Proboštem, pasivní) — úměrně
    // úmrtnosti v kraji, ne jen z moru. Malý dělitel = jen občasný přírůstek.
    if (weekDeaths > 0 && Math.random() < 0.3) {
      GameState.totalFuneralEvents += 1;
    }
    if (weekDeaths > 0) {
      GameLog.add(
        `Demografie: v tomto týdnu podlehlo nemocem, hladu či neklidu v kraji celkem ${weekDeaths} poddaných. Celková populace klesla na ${GameState.totalPopulation} duší.`,
        { type: 'E', icon: '💀', source: 'monastery_internal' }
      );
    }


    // 4. Přechody stavu — krize/zánik/smrt (5 týdnů souvislé bídy → smrt)
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      if (a.wealth < 22 || a.mood < 22) {
        a.ticksInCrisis += 1;
        if (a.ticksInCrisis >= 5) {
          a.status = 'mrtvy';
          a._deathWeek = GameState.week;
          GameLog.add(
            `Smutná zpráva obletěla kraj. ${a.label} (${a.profession}) podlehl dlouhodobému úpadku a bídě.`,
            { type: 'E', icon: '☠️', source: 'monastery_internal' }
          );
          return;
        }
        a.status = (a.wealth < 10 || a.mood < 10) ? 'zanikajici' : 'krize';
      } else {
        a.ticksInCrisis = 0;
        a.status = (a.wealth > 78 && a.mood > 78) ? 'prosperujici' : 'stable';
      }
    });

    // 4a. Rescue Registrum — komunitní záchrana konkrétních aktérů
    // (infirmarium-hospites-rescue-mrd.md §4.2). Denní dedup na Scriptorium
    // straně; tady čteme kolik dní z posledního týdne mělo pro daného
    // aktéra aspoň 1 report a o stejnou hodnotu odečteme ticksInCrisis —
    // žádný umělý skok na 'stable', jen brzdění cesty ke smrti.
    const rescueCounts = RescueRegisterSystem.countDaysThisWeek();
    let rescueBudget = GameState.rescueActionsLeft || 0;
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const days = rescueCounts[a.id] || 0;
      if (days <= 0 || rescueBudget <= 0) return;
      const applied = Math.min(days, rescueBudget, a.ticksInCrisis);
      if (applied <= 0) return;
      a.ticksInCrisis -= applied;
      rescueBudget -= applied;
    });

    // 4a-bis. pendingHospites — kandidáti na Infirmarium/Ubytovnu, kdo
    // poprvé v tomhle krizovém období vstoupil do 'krize'/'zanikajici'
    // (pokrývá mor i wealth/mood cestu jedním místem, viz prevStatusById
    // výš). cause: 'war' při vysokém globalTension (Vlna 1 / C —
    // ubytovna-mrd.md §8c-C) — přednost má vždy mor, war je až po něm.
    // Práh 55 je placeholder, snadno doladitelný.
    const WAR_TENSION_THRESHOLD = 55;
    actors.forEach(a => {
      const wasCrisis = prevStatusById[a.id] === 'krize' || prevStatusById[a.id] === 'zanikajici';
      const isCrisis   = a.status === 'krize' || a.status === 'zanikajici';
      if (wasCrisis || !isCrisis) return;
      if (!GameState.pendingHospites) GameState.pendingHospites = [];
      const cause = a._infected
        ? 'plague'
        : (GameState.globalTension >= WAR_TENSION_THRESHOLD ? 'war' : 'poverty');
      GameState.pendingHospites.push({
        id: 'hospes_' + a.id + '_' + GameState.week,
        actorId: a.id,
        name: a.label,
        profession: a.profession,
        wealth: Math.round(a.wealth),
        cause: cause,
      });
      if (GameState.pendingHospites.length > 10) GameState.pendingHospites.shift();
    });

    // 4a-ter. Vrchnost Favor — cílená obousměrná vazba na JEDNOHO aktéra
    // (studovna-vrchnost-mrd.md). Čtení komunitního reportu → přímé
    // posílení mood/wealth (opačný směr než Rescue Registrum, stejná
    // denní-dedup/týdenní-součet mechanika).
    const favorDays = VrchnostRegisterSystem.countDaysThisWeek();
    if (favorDays > 0) {
      const vrchnost = actors.find(a => a.id === 'vrchnost');
      if (vrchnost && vrchnost.status !== 'mrtvy') {
        vrchnost.mood   = Math.min(100, vrchnost.mood   + favorDays * 2);
        vrchnost.wealth = Math.min(100, vrchnost.wealth + favorDays * 1);
      }
    }

    // 4a-quater. Actor Favor (generický) — stejný vzor jako Vrchnost Favor
    // výš, ale pro libovolný aktéra reportovaný z api/actor-favor-report.js.
    // Dnes jediný zdroj: Scriptorium serveMass() → actorId 'klaster' — dělá
    // z "Klášter" v CHRONICONu mechanickou, ne jen vyprávěcí, zprávu o
    // komunitě hráčů. Přidání dalšího cíleného aktéra = jen nová volání na
    // Scriptorium straně, tenhle blok se nemění.
    const actorFavorCounts = ActorFavorRegisterSystem.countDaysThisWeek();
    Object.keys(actorFavorCounts).forEach(actorId => {
      const days = actorFavorCounts[actorId];
      if (days <= 0) return;
      const target = actors.find(a => a.id === actorId);
      if (!target || target.status === 'mrtvy') return;
      target.mood   = Math.min(100, target.mood   + days * 2);
      target.wealth = Math.min(100, target.wealth + days * 1);
    });

    // 4a-quinter. Clientela↔Chronicon vážený vztahový report (Krok B,
    // clientela-chronicon-most-mrd.md §5) — druhý, přesnější kanál vedle
    // Actor Favor výš (ten zůstává, tenhle jen doplňuje). Relation 50 =
    // neutrál, žádná změna; 100 = plný vztah, jemný kladný posun; 0 =
    // žádný vztah, jemný záporný posun. Generický pro libovolného
    // aktéra — přidání dalšího propojeného kontaktu na Scriptorium
    // straně sem nevyžaduje žádnou další změnu.
    actors.forEach(a => {
      if (a.status === 'mrtvy') return;
      const rel = ContactRelationRegisterSystem.readYesterdayAverage(a.id);
      if (!rel) return;
      const moodDelta   = (rel.avgRelation - 50) * 0.3;
      const wealthDelta = (rel.avgRelation - 50) * 0.15;
      a.mood   = Math.min(100, Math.max(0, a.mood   + moodDelta));
      a.wealth = Math.min(100, Math.max(0, a.wealth + wealthDelta));
    });

    // Uvolnit vyřešené single-slot pending advisory (28.8.2026 oprava) —
    // dřív se tohle nikdy nemazalo, guardy níž tak navždy blokovaly další
    // žádost stejného typu po první, co kdy padla. Musí běžet PŘED
    // všemi třemi `if (!GameState.pendingX)` guardy, ať se místo hned
    // uvolní pro tenhle týdenní tik, ne až příští.
    if (GameState.pendingStudovna && AdvisoryResolvedRegisterSystem.isResolved(GameState.pendingStudovna.id)) {
      GameState.pendingStudovna = null;
    }
    if (GameState.pendingCtenar && AdvisoryResolvedRegisterSystem.isResolved(GameState.pendingCtenar.id)) {
      GameState.pendingCtenar = null;
    }
    if (GameState.pendingVypujcka && AdvisoryResolvedRegisterSystem.isResolved(GameState.pendingVypujcka.id)) {
      GameState.pendingVypujcka = null;
    }

    // ── Gradient helpers (vypujcky-gradient-mrd, 29.8.2026) ────────────────
    // A) pool bonus — víc žijících aktérů = mírně vyšší šance (strop 3 %,
    //    ne lineární na celý pool, ať to nepřeteče při velkém světě).
    // E) sucho pojistka — čím déle daný typ žádosti nepadl, tím víc roste
    //    šance (strop 10 %), aby extrémně dlouhé výpadky nebyly možné.
    // B) váhovaný výběr aktéra dle vztahu — kdo víc důvěřuje, je
    //    pravděpodobnější žadatel (floor 5, ať i nulový vztah má šanci).
    const livingActors = actors.filter(a => a.status !== 'mrtvy');
    const poolBonus = Math.min(0.03, Math.max(0, livingActors.length - 5) * 0.005);
    if (!GameState.lastCtenarWeek) GameState.lastCtenarWeek = 0;
    if (!GameState.lastVypujckaWeek) GameState.lastVypujckaWeek = 0;
    const droughtBonus = (lastWeek) => Math.min(0.10, Math.max(0, (GameState.week - lastWeek) - 5) * 0.01);
    const pickWeightedActor = (pool) => {
      const weights = pool.map(a => {
        const rel = ContactRelationRegisterSystem.readYesterdayAverage(a.id);
        return Math.max(5, (rel && typeof rel.avgRelation === 'number') ? rel.avgRelation : 50);
      });
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return pool[i];
      }
      return pool[pool.length - 1];
    };

    // Nová žádost o Studovnu — max 1 aktivní najednou (je to jeden
    // konkrétní člověk, ne fronta jako sepultura/hospes). ~8% šance/týden.
    if (!GameState.pendingStudovna) {
      const vrchnost = actors.find(a => a.id === 'vrchnost');
      if (vrchnost && vrchnost.status !== 'mrtvy' && Math.random() < 0.08) {
        const causes = ['dispute', 'lineage', 'testament'];
        GameState.pendingStudovna = {
          id: 'studovna_' + GameState.week,
          cause: causes[Math.floor(Math.random() * causes.length)],
        };
      }
    }

    // Nová žádost o čtení v Studovně (knihovna-rozsireni-mrd §4C1,
    // 28.8.2026) — mirror pendingStudovna, ale kdokoliv z core aktérů
    // (ne jen Vrchnost) a max 1 aktivní najednou (jeden konkrétní host).
    // ~12% šance/týden základ, + A (pool) + E (sucho) gradient
    // (vypujcky-gradient-mrd, 29.8.2026). Výběr aktéra teď vážený
    // vztahem (B), ne rovnoměrný.
    if (!GameState.pendingCtenar) {
      const pool = livingActors;
      const chance = 0.12 + poolBonus + droughtBonus(GameState.lastCtenarWeek);
      if (pool.length > 0 && Math.random() < chance) {
        const actor = pickWeightedActor(pool);
        const causes = ['recipe', 'faith', 'curiosity'];
        GameState.pendingCtenar = {
          id: 'ctenar_' + GameState.week,
          actorId: actor.id,
          cause: causes[Math.floor(Math.random() * causes.length)],
        };
        GameState.lastCtenarWeek = GameState.week;
      }
    }

    // Nová žádost o absenční výpůjčku (knihovna-rozsireni-mrd §4C2,
    // 28.8.2026) — kniha smí opustit klášter. ~7% šance/týden základ,
    // + A (pool) + E (sucho) gradient, výběr vážený vztahem (B) — mirror
    // ctenar výš (vypujcky-gradient-mrd, 29.8.2026). Délka výpůjčky
    // (7 vs 14 dní) čte ContactRelationRegisterSystem — stejný kanál
    // jako Actor Favor výš, žádný nový datový tok.
    // Opat (klaster) — zvláštní případ: bere knihu s sebou na cesty,
    // z osobních nebo diplomatických důvodů, ne ke studiu/opisu/daru,
    // a vždy na 14 dní (cesta netrvá krátce).
    if (!GameState.pendingVypujcka) {
      const pool = livingActors;
      const chance = 0.07 + poolBonus + droughtBonus(GameState.lastVypujckaWeek);
      if (pool.length > 0 && Math.random() < chance) {
        const actor = pickWeightedActor(pool);
        const isAbbot = actor.id === 'klaster';
        const causes = isAbbot ? ['osobni', 'diplomaticky'] : ['study', 'copy', 'gift'];
        const rel = ContactRelationRegisterSystem.readYesterdayAverage(actor.id);
        GameState.pendingVypujcka = {
          id: 'vypujcka_' + GameState.week,
          actorId: actor.id,
          cause: causes[Math.floor(Math.random() * causes.length)],
          durationDays: isAbbot ? 14 : ((rel && rel.avgRelation >= 70) ? 14 : 7),
        };
        GameState.lastVypujckaWeek = GameState.week;
      }
    }

    // Nový pocestný u brány — fronta (Vlna 1 / ubytovna-mrd.md §8c-B,
    // rozšíření), anonymní, bez vazby na kteréhokoli z 10 core aktérů —
    // je pryč dřív, než by šlo cokoliv reportovat/rescueovat. ~18%
    // šance/týden — poutníci jsou běžnější než šlechtické spory. Cap 10,
    // FIFO (mirror pendingHospites).
    if (!GameState.pendingPocestny) GameState.pendingPocestny = [];
    if (Math.random() < 0.18) {
      const variants = ['poutnik', 'kramar', 'zebravy_mnich'];
      GameState.pendingPocestny.push({
        id: 'pocestny_' + GameState.week,
        week: GameState.week,
        variant: variants[Math.floor(Math.random() * variants.length)],
      });
      if (GameState.pendingPocestny.length > 10) GameState.pendingPocestny.shift();
    }

    // Despawn — nevyřešený pocestný po 2 týdnech tiše odchází dál po
    // cestě. Žádná zpráva hráči, žádný trvalý dopad, jen zmizí z fronty
    // (mirror principu "postupně se sami despawnou" — Bouvarde 24.7.).
    GameState.pendingPocestny = GameState.pendingPocestny.filter(
      p => (GameState.week - p.week) < 2
    );

    // Farní životní události — sdílený vesnický pool (křest/svatba/pohřeb),
    // anonymní jako pocestný, bez vazby na 10 core aktérů. Doplněk k
    // lokálnímu Scriptorium poolu (parishEventTick), ne náhrada — kód
    // v Scriptoriu (farnost-chronicon-reference.md) je na obojí připravený.
    // ~15% šance/týden — mezi pocestný (18%) a studovna (8%). Cap 10, FIFO.
    if (!GameState.pendingFarniEvents) GameState.pendingFarniEvents = [];
    if (Math.random() < 0.15) {
      const farniTypes = ['baptism', 'wedding', 'funeral'];
      const farniType = farniTypes[Math.floor(Math.random() * farniTypes.length)];
      GameState.pendingFarniEvents.push({
        id: 'farni_' + farniType + '_' + GameState.week,
        week: GameState.week,
        farniType,
      });
      if (GameState.pendingFarniEvents.length > 10) GameState.pendingFarniEvents.shift();
    }

    // 4b. Nástupnictví — mrtvý aktér NENÍ trvale mrtvý pro celý kraj (na
    // rozdíl od mnišské smrti ve Scriptoriu, kde je to schválně natrvalo).
    // Po 3 týdnech smutku převezme dvůr nástupce téhož řemesla — jednotlivé
    // úmrtí je dramatický beat, ne trvalá díra v ekonomice. Kolaps-obnova
    // (bod 6) zůstává jako vzácnější pojistka pro celoplošnou krizi.
    // abbot-persona-mrd (9.8.2026) — Opat má jmenovanou zásobu nástupců
    // (mirror Scriptorium AbbotSystem.CANDIDATES), ostatní aktéři beze
    // změny (generický "nový [řemeslo] převzal").
    // opat-nastupnictvi-mrd (15.8.2026) — nástupce i strukturovaně
    // (abbotId/abbotName na aktérovi), ne jen text v Kronice. gm.abbot_name
    // se drží synchronizované s realitou.
    // opat-nastupnictvi-mrd (15.8.2026, revize) — rozšířeno o Havla a
    // Bohuslava. abbotUsedIds brání opakovanému zvolení téhož bratra;
    // při vyčerpání poolu žádný jmenovaný nástupce (Scriptorium má na
    // chybějící abbotId tichý guard), jen info do Kroniky.
    const KLASTER_SUCCESSORS = [
      { id: 'prokop', name: 'Prokop' },
      { id: 'metodej', name: 'Metoděj' },
      { id: 'havel', name: 'Havel' },
      { id: 'bohuslav', name: 'Bohuslav' },
    ];
    if (!GameState.abbotUsedIds) GameState.abbotUsedIds = [];
    actors.forEach(a => {
      if (a.status !== 'mrtvy') return;
      if (GameState.week - (a._deathWeek || 0) < 3) return;
      a.status = 'stable';
      a.wealth = 40;
      a.mood = 55;
      a.stores = Math.round((a.storesMax || 60) * 0.3);
      a.ticksInCrisis = 0;
      delete a._deathWeek;
      delete a._infected;
      delete a._quarantined;
      if (a.id === 'klaster') {
        const available = KLASTER_SUCCESSORS.filter(s => !GameState.abbotUsedIds.includes(s.id));
        if (available.length > 0) {
          const successor = available[Math.floor(Math.random() * available.length)];
          a.abbotId = successor.id;
          a.abbotName = successor.name;
          GameState.abbotUsedIds.push(successor.id);
          if (GameState.gm) GameState.gm.abbot_name = successor.name;
          GameLog.add(
            `Klášter truchlil, ale ne dlouho — bratr ${successor.name} byl zvolen novým opatem. Dům pokračuje.`,
            { type: 'C', icon: '👤', source: 'monastery_internal' }
          );
        } else {
          GameLog.add(
            `Klášter dlouho hledá vhodného nástupce mezi svými bratry — kapitula se zatím neshodla.`,
            { type: 'C', icon: '👤', source: 'monastery_internal' }
          );
        }
      } else {
        GameLog.add(
          `Dvůr po zesnulém ${a.label} nezůstal dlouho prázdný — nový ${a.profession.toLowerCase()} převzal řemeslo a dům.`,
          { type: 'C', icon: '👤', source: 'monastery_internal' }
        );
      }
    });


    // 5. Globální napětí + Zlatá éra
    const living = actors.filter(a => a.status !== 'mrtvy');
    const avgMood   = living.reduce((acc, a) => acc + a.mood, 0) / living.length;
    const avgWealth = living.reduce((acc, a) => acc + a.wealth, 0) / living.length;

    let tensionDelta = (50 - avgMood) * 0.16;
    if (GameState.les < 30) tensionDelta += 1.8;
    const crisisCount = living.filter(a => a.status === 'krize' || a.status === 'zanikajici').length;
    tensionDelta += crisisCount * 1.4;

    // GM ruční napětí — pole existovalo, ale nikdy se nečetlo (oprava, ne nová věc)
    tensionDelta += (GameState.gm && GameState.gm.tension_modifier) || 0;

    // Registrum Coenobii — komunitní agregát ze Scriptoria (registrum-coenobii-reference.md).
    // Umbra napětí zvyšuje, Lux ho tiší. Tiché selhání, pokud soubor chybí/je poškozený —
    // stejný vzor jako GmOverride.apply().
    const registrum = RegisterSystem.readYesterdayAverage();
    if (registrum) {
      tensionDelta += (registrum.avgUmbra - registrum.avgLux) * 0.05;
    }

    GameState.globalTension = Math.min(100, Math.max(0, GameState.globalTension + tensionDelta));

    // 5b. Cechovní napětí (Guild Tension) — kurzorové zpracování, KAŽDÝ DEN
    // JEDNOU (oprava v0.6 bod 1 — dřív se celé 7denní okno přičítalo znovu
    // při každém ze 4 ticků/den, tension vylítla na strop ze dvou prodejů).
    // GM modifikátor zůstává jako okamžitá ruční korekce každý tick
    // (mirror chování tension_modifier u globálního napětí výš).
    if (GameState.guilds) {
      if (!GameState.guildRegisterCursor) {
        // První běh — kurzor je "poslední zpracovaný den". Nastav na
        // předevčírem, ať smyčka níž na prvním běhu správně zpracuje
        // včerejšek (ne starší historii zpětně).
        const y = new Date();
        y.setUTCDate(y.getUTCDate() - 2);
        GameState.guildRegisterCursor = y.toISOString().slice(0, 10);
      }

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);

      let cursor = new Date(GameState.guildRegisterCursor + 'T00:00:00Z');
      let guard = 0; // pojistka — max 10 dní dohnat najednou (mirror PRUNE_AFTER_DAYS)
      while (cursor.toISOString().slice(0, 10) < yesterdayKey && guard < 10) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        const dayKey = cursor.toISOString().slice(0, 10);
        const daySales = GuildRegisterSystem.getGuildSalesCountsForDay(dayKey);

        Object.keys(GameState.guilds).forEach(guildId => {
          const gData = GameState.guilds[guildId];
          if (!gData) return;
          const unprivilegedCount = daySales[guildId] || 0;
          const gDelta = unprivilegedCount > 0 ? (unprivilegedCount * 4) : -1;
          gData.tension = Math.min(100, Math.max(0, (gData.tension !== undefined ? gData.tension : 20) + gDelta));
        });

        GameState.guildRegisterCursor = dayKey;
        guard++;
      }

      const gmGuildTensionMod = (GameState.gm && GameState.gm.guild_tension_modifier) || 0;
      if (gmGuildTensionMod) {
        Object.keys(GameState.guilds).forEach(guildId => {
          const gData = GameState.guilds[guildId];
          if (!gData) return;
          gData.tension = Math.min(100, Math.max(0, gData.tension + gmGuildTensionMod));
        });
      }
    }

    if (avgMood > 75 && avgWealth > 75 && GameState.globalTension < 22) {
      if (!GameState.goldenAge) {
        GameState.goldenAge = true;
        GameLog.add(
          'Zlatá éra kraje započala! Lidé oslavují mír, sýpky přetékají a vrchnost se těší úctě.',
          { type: 'E', icon: '✨', source: 'monastery_internal' }
        );
      }
      GameState.goldenAgeTicks += 1;
    } else if (GameState.goldenAge) {
      GameState.goldenAge = false;
      GameState.goldenAgeTicks = 0;
      GameLog.add(
        'Zlatá éra kraje skončila. Každodenní starosti a pnutí se vracejí.',
        { type: 'E', icon: '☁️', source: 'monastery_internal' }
      );
    }

    // 6. NATVRDO: kraj nikdy nevymře. Betlém "standard" by tu skončil hrou —
    // my vždy provedeme zotavení (ekvivalent Betlém "fenix", bez volby).
    const vrc = actors.find(x => x.id === 'vrchnost');
    const coreActors = actors.filter(a => a.core);
    const deadCores = coreActors.filter(a => a.status === 'mrtvy').length;
    const collapseTriggered =
      (!vrc || vrc.status === 'mrtvy') ||
      (deadCores >= coreActors.length * 0.5) ||
      (GameState.globalTension >= 100);

    if (collapseTriggered) {
      actors.forEach(a => {
        if (a.status === 'mrtvy' || a.status === 'zanikajici' || a.status === 'krize') {
          a.status = 'stable';
          a.mood   = Math.max(a.mood, 60);
          a.wealth = Math.max(a.wealth, 35);
          a.stores = Math.max(a.stores, 25);
          a.ticksInCrisis = 0;
        }
      });
      GameState.globalTension = Math.min(GameState.globalTension, 40);
      GameLog.add(
        'Kraj prošel těžkou zkouškou, ale vydržel. Nový úrodný čas začíná — lidé se vzchopili a práce pokračuje.',
        { type: 'E', icon: '🕊️', source: 'monastery_internal' }
      );
    }
  },

  // Inicializace při prvním startu
  async init() {
    GameState.flags.started = true;

    // Kalendář hned při startu synchronizovat s reálným datem —
    // ať uvítací zpráva neukazuje "den 1, Jaro" bez ohledu na to, kdy startuje.
    const real = StateHelpers.realCalendar();
    GameState.time.year   = real.year;
    GameState.time.season = real.season;
    GameState.time.day    = real.day;

    await WeatherSystem.init();

    GameLog.add(
      `Klášter se probouzí. ${StateHelpers.dateString()}.`,
      { type: 'A', icon: '✝️', source: 'engine' }
    );
  },

};

module.exports = { GameEngine, GameLog };
