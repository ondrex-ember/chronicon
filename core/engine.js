// ============================================
//  CHRONICON — Engine
//  Port z Monasterium GameEngine do Node.js.
//  Odstraněno: setInterval, GameUI, tickPilgrims,
//              resumeAfterEvent, speed, pause.
//  Přidáno: chronicle typologie (type/icon/source),
//           addChronicleOnce() s cooldown trackerem.
// ============================================

'use strict';

const { GameState, StateHelpers } = require('./state.js');
const { WeatherSystem }           = require('./weather.js');

// ============================================
//  GameLog
// ============================================

const GameLog = {

  MAX_ENTRIES: 80,

  add(text, options = {}) {
    const time = GameState.time;

    const entry = {
      text,
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

  // Přidá záznam pouze pokud neexistuje v cooldown okně
  // key: unikátní string identifikátor zprávy
  // cooldownTicks: kolik ticků musí uplynout před opakováním
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
//  GameEngine
// ============================================

const GameEngine = {

  // Hlavní tick — volán 4× denně z cron.js
  tick() {
    GameState.time.totalTick++;

    // 1. Počasí
    const weatherChronicle = WeatherSystem.roll();
    if (weatherChronicle) {
      GameLog.add(weatherChronicle, {
        type:   'A',
        icon:   GameState.weather.icon,
        source: 'weather',
      });
    }

    // 2. Produkce a spotřeba
    GameEngine.computeRates();
    GameEngine.applyResources();

    // 3. Posun dne
    GameEngine.advanceDay();
  },

  computeRates() {
    const rates  = GameState.productionRates;
    const assign = GameState.monks.assignments;
    const res    = GameState.resources;
    const isWinter = StateHelpers.isWinter();
    const wx     = WeatherSystem.getMultipliers();

    // Reset rates
    for (const key in res) {
      res[key].rate = 0;
    }

    // Zimní spotřeba dřeva
    if (isWinter) {
      res.wood.rate -= GameState.monks.total * 0.4 * wx.woodDrain;
    }

    // Cold Cascade multiplier
    let winterMult = 1.0;
    if (isWinter) {
      const woodFull = GameState.monks.total * 36;
      const woodHave = res.wood.value;
      const ratio    = woodFull > 0 ? woodHave / woodFull : 1.0;

      if      (ratio >= 1.0)  winterMult = 1.0;
      else if (ratio >= 0.75) winterMult = 0.85;
      else if (ratio >= 0.5)  winterMult = 0.65;
      else if (ratio >= 0.25) winterMult = 0.40;
      else                    winterMult = 0.0;

      GameState.flags.winterCascade = ratio >= 1.0   ? 'full'
                                    : ratio >= 0.75  ? 'mild'
                                    : ratio >= 0.5   ? 'significant'
                                    : ratio >= 0.25  ? 'severe'
                                    : 'crisis';
    } else {
      GameState.flags.winterCascade = null;
    }

    // Produkce dle assignmentů
    res.grain.rate += assign.fields      * rates.fields.grain      * winterMult * wx.grain;
    res.wood.rate  += assign.woodcutting * rates.woodcutting.wood  * winterMult * wx.wood;
    res.piety.rate += assign.prayer      * rates.prayer.piety;
    res.grose.rate += assign.prayer      * rates.prayer.grose;

    // Spotřeba obilí
    res.grain.rate -= GameState.monks.total * GameState.consumption.grain;
  },

  applyResources() {
    const res   = GameState.resources;
    const stats = GameState.seasonStats;

    for (const key in res) {
      const r = res[key];
      r.value += r.rate;
      r.value  = Math.max(r.min, Math.min(r.max, r.value));
      r.value  = Math.round(r.value * 10) / 10;
    }

    if (res.grain.rate > 0) stats.grainProduced += res.grain.rate;
    if (res.wood.rate  > 0) stats.woodProduced  += res.wood.rate;
    if (res.piety.rate > 0) stats.pietyGained   += res.piety.rate;
    if (res.grose.rate > 0) stats.groseEarned   += res.grose.rate;

    // Chronicle při hladomorové situaci
    if (res.grain.value <= 0) {
      GameLog.addOnce('famine_warning', 'Zásobárna je prázdná. Bratři hladoví.', {
        type: 'B', icon: '☠️', source: 'engine',
      }, 4);
      GameState.flags.consecutiveFamines++;
    } else {
      GameState.flags.consecutiveFamines = 0;
    }

    // Chronicle při zimní krizi s dřevem
    if (StateHelpers.isWinter() && GameState.flags.winterCascade === 'crisis') {
      GameLog.addOnce('wood_crisis', 'Žádné dřevo nezbývá. Klášter mrznout.', {
        type: 'B', icon: '🪵', source: 'engine',
      }, 4);
    }
  },

  advanceDay() {
    const time = GameState.time;
    time.day++;

    if (time.day > time.daysPerSeason) {
      GameEngine.onSeasonEnd();
    }
  },

  onSeasonEnd() {
    const time      = GameState.time;
    const nextSeason = (time.season + 1) % 4;
    const nextYear   = nextSeason === 0 ? time.year + 1 : time.year;

    const seasonNames = ['Jaro', 'Léto', 'Podzim', 'Zima'];
    const seasonIcons = ['🌱', '☀️', '🍂', '❄️'];

    GameLog.add(
      `${seasonIcons[nextSeason]} ${seasonNames[nextSeason]} Léta Páně ${nextYear} začíná.`,
      { type: 'A', icon: seasonIcons[nextSeason], source: 'engine' }
    );

    if (nextSeason === 3) {
      GameLog.add('❄️ Zima přichází. Pole zmrzají a ztichají.', {
        type: 'B', icon: '❄️', source: 'engine',
      });
    }

    // Přechod
    time.season = nextSeason;
    time.year   = nextYear;
    time.day    = 1;

    StateHelpers.resetSeasonStats();
    WeatherSystem.init();
  },

  // Inicializace při prvním startu
  init() {
    GameState.flags.started = true;
    WeatherSystem.init();

    GameLog.add(
      `Klášter se probouzí. ${StateHelpers.dateString()}.`,
      { type: 'A', icon: '✝️', source: 'engine' }
    );
  },

};

module.exports = { GameEngine, GameLog };
