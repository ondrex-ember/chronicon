// ============================================
//  CHRONICON — Weather System
//  Port z Monasterium WeatherSystem do Node.js.
//  Jediná změna: _set() vrací chronicle text
//  místo volání GameLog.add() — engine loguje sám.
// ============================================

'use strict';

const { GameState } = require('./state.js');

const WeatherSystem = {

  POOLS: {

    // 0 = Jaro
    0: [
      {
        key:     'spring_clear',
        name:    'Jasno',
        icon:    '☀️',
        desc:    'Mírné slunce. Pole i cesty jsou schůdné.',
        weight:  4,
        mult:    { grain: 1.10, pilgrims: 1.10 },
      },
      {
        key:     'spring_rain',
        name:    'Mírný déšť',
        icon:    '🌧',
        desc:    'Déšť zavlažuje pole. Úroda poroste.',
        weight:  4,
        mult:    { grain: 1.15 },
      },
      {
        key:     'spring_cloudy',
        name:    'Oblačno',
        icon:    '⛅',
        desc:    'Zataženo. Den plyne klidně.',
        weight:  3,
        mult:    {},
      },
      {
        key:     'spring_heavy_rain',
        name:    'Silný déšť',
        icon:    '🌧',
        desc:    'Prudký déšť. Pole prospívají, dřevorubci váznou.',
        weight:  2,
        mult:    { grain: 1.20, wood: 0.90 },
      },
      {
        key:     'spring_late_frost',
        name:    'Pozdní mráz',
        icon:    '🌨',
        desc:    'Neočekávaný mráz poškozuje osení.',
        weight:  1,
        mult:    { grain: 0.75 },
        chronicle: 'Pozdní mráz udeřil nečekaně. Část osení trpí.',
      },
      {
        key:     'spring_fog',
        name:    'Ranní mlha',
        icon:    '🌫',
        desc:    'Hustá mlha halí údolí. Poutníci bloudí.',
        weight:  1,
        mult:    { pilgrims: 0.80 },
      },
    ],

    // 1 = Léto
    1: [
      {
        key:     'summer_clear',
        name:    'Jasno',
        icon:    '☀️',
        desc:    'Horké léto. Poutníci přicházejí hojně.',
        weight:  4,
        mult:    { grain: 1.10, pilgrims: 1.20 },
      },
      {
        key:     'summer_ideal',
        name:    'Ideální počasí',
        icon:    '🌤',
        desc:    'Teplé slunce s občasným deštěm. Vše prosperuje.',
        weight:  3,
        mult:    { grain: 1.15, pilgrims: 1.15 },
      },
      {
        key:     'summer_drought',
        name:    'Sucho',
        icon:    '🌵',
        desc:    'Vedro a sucho. Pole trpí, poutníci se vyhýbají cestám.',
        weight:  2,
        mult:    { grain: 0.80, pilgrims: 0.90 },
        chronicle: 'Sucho trvá. Studny se zmenšují. Modlíme se za déšť.',
      },
      {
        key:     'summer_storm',
        name:    'Bouřka',
        icon:    '⛈',
        desc:    'Prudká bouřka. Dřevorubci a poutníci se ukrývají.',
        weight:  2,
        mult:    { grain: 0.90, wood: 0.85, pilgrims: 0.75 },
        chronicle: 'Bouřka přešla přes klášter. Bratři se modlili za bezpečí.',
      },
      {
        key:     'summer_cloudy',
        name:    'Oblačno',
        icon:    '⛅',
        desc:    'Zataženo, ale bez deště. Práce probíhá normálně.',
        weight:  3,
        mult:    {},
      },
      {
        key:     'summer_heatwave',
        name:    'Vlna veder',
        icon:    '🔆',
        desc:    'Nesnesitelné horko. Bratři pracují pomaleji.',
        weight:  1,
        mult:    { grain: 0.85, wood: 0.85, pilgrims: 0.85 },
        chronicle: 'Vlna veder ochromuje práci. V klášteře je dusno.',
      },
    ],

    // 2 = Podzim
    2: [
      {
        key:     'autumn_clear',
        name:    'Jasno',
        icon:    '☀️',
        desc:    'Zlatý podzim. Sklizeň probíhá za příznivých podmínek.',
        weight:  4,
        mult:    { grain: 1.10, pilgrims: 1.05 },
      },
      {
        key:     'autumn_rain',
        name:    'Déšť',
        icon:    '🌧',
        desc:    'Podzimní déšť. Sklizeň je náročnější.',
        weight:  3,
        mult:    { grain: 0.95 },
      },
      {
        key:     'autumn_fog',
        name:    'Mlha',
        icon:    '🌫',
        desc:    'Hustá podzimní mlha. Poutníci ztrácejí cestu.',
        weight:  2,
        mult:    { pilgrims: 0.85 },
        chronicle: 'Mlha leží nad krajem jako přikrývka.',
      },
      {
        key:     'autumn_early_frost',
        name:    'Ranní mráz',
        icon:    '🌨',
        desc:    'První mráz. Část sklizně je ohrožena.',
        weight:  2,
        mult:    { grain: 0.85 },
        chronicle: 'Ranní mráz přišel dříve než obvykle. Bratři spěchají se sklizní.',
      },
      {
        key:     'autumn_storm',
        name:    'Bouřka',
        icon:    '⛈',
        desc:    'Podzimní bouřka. Dřevo i obilí trpí.',
        weight:  1,
        mult:    { grain: 0.85, wood: 0.80 },
        chronicle: 'Bouřka poškodila část uskladněného dřeva.',
      },
      {
        key:     'autumn_golden',
        name:    'Zlaté babí léto',
        icon:    '🍂',
        desc:    'Nádherné babí léto. Poutníci přicházejí naposledy před zimou.',
        weight:  2,
        mult:    { grain: 1.05, pilgrims: 1.20 },
        chronicle: 'Babí léto přineslo nečekaný příval poutníků.',
      },
    ],

    // 3 = Zima
    3: [
      {
        key:     'winter_snow',
        name:    'Sníh',
        icon:    '❄️',
        desc:    'Sněhová pokrývka. Cesty jsou sjízdné, práce pomalá.',
        weight:  4,
        mult:    { woodDrain: 1.10 },
      },
      {
        key:     'winter_blizzard',
        name:    'Vánice',
        icon:    '🌨',
        desc:    'Silná vánice. Poutníci nepřicházejí, dřevo mizí rychle.',
        weight:  2,
        mult:    { woodDrain: 1.25, pilgrims: 0.0 },
        chronicle: 'Vánice uzavřela cesty. Klášter je odříznut od světa.',
      },
      {
        key:     'winter_thaw',
        name:    'Obleva',
        icon:    '🌧',
        desc:    'Neočekávaná obleva. Dřevo vydrží déle.',
        weight:  2,
        mult:    { woodDrain: 0.85 },
      },
      {
        key:     'winter_frost',
        name:    'Silný mráz',
        icon:    '🧊',
        desc:    'Krutý mráz. Dřevo hoří rychleji.',
        weight:  3,
        mult:    { woodDrain: 1.15 },
      },
      {
        key:     'winter_clear',
        name:    'Jasná zima',
        icon:    '☀️',
        desc:    'Mrazivé ale jasné dny. Bratři pracují ve skriptoriu s radostí.',
        weight:  2,
        mult:    { scriptorium: 1.20 },
      },
      {
        key:     'winter_grey',
        name:    'Šedá zima',
        icon:    '☁️',
        desc:    'Zataženo a ticho. Den plyne pomalu.',
        weight:  3,
        mult:    {},
      },
    ],
  },

  current: null,

  CHANGE_CHANCE: 0.20,

  init() {
    WeatherSystem.current = null;
    return WeatherSystem.roll(true);
  },

  // Vrací chronicle text pokud došlo ke změně počasí s chronicle property
  // Jinak vrací null. Engine rozhodne zda logovat.
  roll(force = false) {
    if (!force && Math.random() > WeatherSystem.CHANGE_CHANCE) return null;

    const season = GameState.time.season;
    const pool   = WeatherSystem.POOLS[season];

    const candidates = pool.filter(w =>
      !WeatherSystem.current || w.key !== WeatherSystem.current.key
    );
    const source = candidates.length > 0 ? candidates : pool;

    const total = source.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of source) {
      r -= w.weight;
      if (r <= 0) {
        return WeatherSystem._set(w);
      }
    }
    return WeatherSystem._set(source[source.length - 1]);
  },

  // Nastaví počasí, aktualizuje GameState.weather
  // Vrací chronicle text nebo null (místo volání GameLog.add)
  _set(w) {
    const prev = WeatherSystem.current;
    WeatherSystem.current = w;

    GameState.weather = {
      key:  w.key,
      name: w.name,
      icon: w.icon,
      desc: w.desc,
    };

    if (w.chronicle && prev && prev.key !== w.key) {
      return `${w.icon} ${w.chronicle}`;
    }
    return null;
  },

  getMultipliers() {
    const defaults = {
      grain:       1.0,
      wood:        1.0,
      pilgrims:    1.0,
      woodDrain:   1.0,
      scriptorium: 1.0,
    };
    if (!WeatherSystem.current) return defaults;
    return Object.assign({}, defaults, WeatherSystem.current.mult);
  },

};

module.exports = { WeatherSystem };
