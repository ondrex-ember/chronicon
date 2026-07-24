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
const {
  PROD_TABLE, SEASON_MODS, COMMODITY_VALUE, SEASON_DEMAND,
  PROD_BLOCK_TEXTS, RELATION_THRESHOLD_TEXTS,
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

    // 3. Týdenní ekonomika (Betlém model) — jednou za 28 ticků (7 dní)
    if (GameState.time.totalTick % 28 === 0) {
      GameEngine.runWeeklyEconomy();
    }
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

    // 4a-bis. pendingHospites — kandidáti na Infirmarium, kdo poprvé
    // v tomhle krizovém období vstoupil do 'krize'/'zanikajici' (pokrývá
    // mor i wealth/mood cestu jedním místem, viz prevStatusById výš).
    actors.forEach(a => {
      const wasCrisis = prevStatusById[a.id] === 'krize' || prevStatusById[a.id] === 'zanikajici';
      const isCrisis   = a.status === 'krize' || a.status === 'zanikajici';
      if (wasCrisis || !isCrisis) return;
      if (!GameState.pendingHospites) GameState.pendingHospites = [];
      GameState.pendingHospites.push({
        id: 'hospes_' + a.id + '_' + GameState.week,
        actorId: a.id,
        name: a.label,
        profession: a.profession,
        wealth: Math.round(a.wealth),
        cause: a._infected ? 'plague' : 'poverty',
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

    // Nový pocestný u brány — max 1 aktivní najednou, anonymní (Vlna 1 /
    // ubytovna-mrd.md §8c-B). Mirror Studovna vzoru, ale bez vazby na
    // kteréhokoli z 10 core aktérů — je pryč dřív, než by šlo cokoliv
    // reportovat/rescueovat. ~18% šance/týden — poutníci jsou běžnější
    // než šlechtické spory.
    if (!GameState.pendingPocestny) {
      if (Math.random() < 0.18) {
        const variants = ['poutnik', 'kramar', 'zebravy_mnich'];
        GameState.pendingPocestny = {
          id: 'pocestny_' + GameState.week,
          variant: variants[Math.floor(Math.random() * variants.length)],
        };
      }
    }

    // 4b. Nástupnictví — mrtvý aktér NENÍ trvale mrtvý pro celý kraj (na
    // rozdíl od mnišské smrti ve Scriptoriu, kde je to schválně natrvalo).
    // Po 3 týdnech smutku převezme dvůr nástupce téhož řemesla — jednotlivé
    // úmrtí je dramatický beat, ne trvalá díra v ekonomice. Kolaps-obnova
    // (bod 6) zůstává jako vzácnější pojistka pro celoplošnou krizi.
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
      GameLog.add(
        `Dvůr po zesnulém ${a.label} nezůstal dlouho prázdný — nový ${a.profession.toLowerCase()} převzal řemeslo a dům.`,
        { type: 'C', icon: '👤', source: 'monastery_internal' }
      );
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
