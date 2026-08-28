// ============================================
//  CHRONICON — Snapshot
//  Sestaví chronicon_snapshot.json z GameState.
//  Volat po každém tiku, po saveState().
// ============================================

'use strict';

const fs   = require('fs');
const path = require('path');

const { GameState, StateHelpers } = require('../core/state.js');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'chronicon_snapshot.json');

const Snapshot = {

  build() {
    const now       = new Date();
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      version:     2,
      generated:   now.toISOString(),
      valid_until: validUntil.toISOString(),

      abbot: {
        name:          GameState.gm.abbot_name,
        mood:          GameState.gm.abbot_mood,
        virtue:        GameState.gm.abbot_virtue,
        portrait:      GameState.gm.abbot_portrait,
        scrinium_open: GameState.gm.scrinium_open,
        message:       GameState.gm.abbot_message,
        message_en:    GameState.gm.abbot_message_en,
      },

      // Trvalý seznam odemčených flagů pro Scriptorium (GameState.flags[x] = true).
      // Celá historie vždy, ne jen dnešní dávka — nový hráč dostane vše najednou.
      unlockFlags: GameState.unlockedFlags || [],

      // Svátek (GM): Scriptorium serveMass čte → vliv ×2. null = obyčejný den.
      // Zatím čistě GM-ruční (Abbot panel) — automatický výpočet je V2, viz _calendar().
      feast: GameState.gm.feast || null,

      // Půst (GM přebíjí, jinak automatický výpočet dle skutečného data):
      // Scriptorium calcPrice čte → ryby ×1.5, maso ×0.5. null = obyčejný den.
      fast: GameState.gm.fast || Snapshot._computeFast(),

      // Cechy (Guilds) — chronicon-cechy-mrd.md (15.8.2026). Sdílený
      // politický tlak, ne per-hráč vztah (ten žije ve Scriptoriu
      // GuildsDB.relation, cechy-a-prava-mrd.md §3).
      guilds: GameState.guilds,

      // Veletrh — chronicon-cechy-mrd.md §2/§3. Sv. Václav, 28.9., jediný
      // den v roce cechovní gate (cechy-a-prava-mrd.md §5) padá úplně.
      // Chronicon je autoritativní zdroj — Scriptorium žádnou vlastní
      // logiku nepočítá, jen čte tohle pole (mirror feast/fast dualita).
      // V1: čistě auto-výpočet ze skutečného data; GM override je TBD
      // (chronicon-cechy-mrd.md TBD #4) — zatím žádný gm.veletrh klíč.
      veletrh: Snapshot._computeVeletrh(),

      weather: {
        key:              GameState.weather.key,
        name:             GameState.weather.name,
        icon:             GameState.weather.icon,
        desc:             GameState.weather.desc,
        tempC:            GameState.weather.tempC,
        windKmH:          GameState.weather.windKmH,
        rainMm:           GameState.weather.rainMm,
        season:           GameState.time.season,
        modifier_grain:   Snapshot._wx('grain'),
        modifier_wood:    Snapshot._wx('wood'),
      },

      time: {
        year:       GameState.time.year,
        season:     GameState.time.season,
        season_name: StateHelpers.seasonName(),
        season_icon: StateHelpers.seasonIcon(),
        day:        GameState.time.day,
        total_tick: GameState.time.totalTick,
        date_string: StateHelpers.dateString(),
      },

      // V2: dynamický seznam aktérů (Betlém model, profil 'ricni') —
      // NAHRAZUJE starý pevný seznam {monastery,vesnicane,valach,inkvizitor}.
      // Abbot-panel čte starý tvar — bude potřebovat vlastní update (plán, ne teď).
      // relations přidáno (abbot-persona-mrd, 9.8.2026) — dřív jen interní
      // pro engine (blok "Vztahy"), teď čitelné i Scriptoriem pro zobrazení
      // vztahové sítě konkrétního aktéra (Opat tab).
      actors: GameState.actors.map(a => ({
        id: a.id, label: a.label, label_en: a.label_en,
        profession: a.profession, profession_en: a.profession_en,
        wealth: Math.round(a.wealth), mood: Math.round(a.mood),
        stores: Math.round(a.stores), status: a.status,
        itemStock: a.itemStock || undefined,
        relations: a.relations || undefined,
        abbotId: a.abbotId || undefined,
        abbotName: a.abbotName || undefined,
      })),

      region: {
        tension:   Math.round(GameState.globalTension),
        goldenAge: GameState.goldenAge,
        totalFuneralEvents: GameState.totalFuneralEvents || 0,
        population: GameState.totalPopulation,
      },

      // Kurátorované eventy pro Scriptorium (Sprint 3 dokončí spotřebu na
      // straně Scriptoria) — mor v kraji je první konkrétní obsah tohoto pole.
      advisory_events: Snapshot._buildAdvisoryEvents(),

      // V2: stará fake-ekonomika (grain/wood/grose/piety) odstraněna — nikdy
      // nefungovala (assignments se nikdy nenastavily, obilí trvale na 0).
      // Abbot-panel na ni měl odkaz — dostane vlastní update.

      // Vrstva 3 — dynamické Porta dopisy (narrative/porta_letters_v1.json
      // přes Picker.pickPortaLetters). Plné záznamy včetně choices/effects,
      // ne jen text. Scriptorium dedupuje po id (GameState.letters.readIds/
      // dynamic) — poslední 30 stačí, starší už hráč buď má, nebo prošvihl
      // stejně jako u chronicle.
      porta_letters: (GameState.portaLetterHistory || []).slice(0, 30),

      // Posledních 20 chronicle záznamů
      chronicle: GameState.log.slice(0, 20),

      // Filtrované pohledy dle source
      chronicle_local:    GameState.log.filter(e =>
        e.source === 'local_events' || e.source === 'monastery_internal'
      ).slice(0, 10),

      chronicle_distant:  GameState.log.filter(e =>
        e.source === 'distant_events'
      ).slice(0, 10),

      church_calendar: Snapshot._calendar(),
    };
  },

  write() {
    try {
      const dir = path.dirname(SNAPSHOT_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const snapshot = Snapshot.build();
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(
        `[CHRONICON] Snapshot zapsán — tick ${GameState.time.totalTick},` +
        ` ${snapshot.time.date_string}`
      );
      return snapshot;
    } catch (err) {
      console.error('[CHRONICON] Chyba při zápisu snapshotu:', err.message);
      return null;
    }
  },

  // ── Velikonoce (algoritmus Meeuse/Jones/Butcher) — identický se Scriptorium
  //    client `systems/calendar.js` CalendarSystem.getEaster(), aby oba systémy
  //    počítaly stejné datum ze stejného reálného roku.
  _getEaster(year) {
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

  // Automatický postní den — počítáno ze SKUTEČNÉHO reálného data (ne z
  // Chronicon fikčního time modelu). Postní dny: každá středa a pátek celý
  // rok + celá postní doba (Popeleční středa → Velikonoce). Vigilie svátků
  // a Advent zatím vynechány (V2 — vyžadovalo by sdílet celou feastDays
  // databázi ze Scriptorium client repa).
  _computeFast() {
    const now   = new Date();
    const year  = now.getFullYear();
    const easter = Snapshot._getEaster(year);
    const easterDate = new Date(year, easter.month - 1, easter.day);
    const ashDate = new Date(easterDate); ashDate.setDate(easterDate.getDate() - 46);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dow = today.getDay(); // 0=Ne .. 6=So
    const inLent = today >= ashDate && today < easterDate;
    const isWed = dow === 3;
    const isFri = dow === 5;

    if (!inLent && !isWed && !isFri) return null;

    const name_cs = inLent ? 'Postní doba' : (isWed ? 'Postní středa' : 'Postní pátek');
    const name_en = inLent ? 'Lent'        : (isWed ? 'Fasting Wednesday' : 'Fasting Friday');
    return { active: true, name_cs, name_en };
  },

  // Veletrh sv. Václava (28.9.) — jeden den v roce, panovníkem vyhlášený
  // "svobodný trh" (cechy-a-prava-mrd.md §2.4). Počítáno ze skutečného
  // reálného data, stejný vzor jako _computeFast(). Jen ten jeden den —
  // vědomě žádné vícedenní okno na V1, TBD pokud se ukáže moc úzké.
  _computeVeletrh() {
    const now = new Date();
    const isVaclav = now.getMonth() === 8 && now.getDate() === 28; // getMonth() 0-indexed, 8 = září

    if (!isVaclav) return { active: false };

    return {
      active: true,
      name_cs: 'Veletrh sv. Václava',
      name_en: "St. Wenceslas' Fair",
    };
  },

  // Pomocná — vrátí weather multiplier pro daný klíč
  _wx(key) {
    const w = GameState.weather;
    if (!w || !w.key) return 1.0;
    // Multipliers jsou na WeatherSystem.current — přímý přístup přes require
    try {
      const { WeatherSystem } = require('../core/weather.js');
      const mx = WeatherSystem.getMultipliers();
      return mx[key] !== undefined ? mx[key] : 1.0;
    } catch {
      return 1.0;
    }
  },

  // Mor v kraji → jeden advisory event, přítomný PO CELOU DOBU vzplanutí
  // (ne jen jeden tik) — hráči fetchují snapshot jen ~1×/6h s cache, takže
  // jednorázový výskyt by se snadno prošvihl. "Zobrazit jen jednou" řeší
  // Scriptorium samo (per hráč), ne CHRONICON.
  _buildAdvisoryEvents() {
    const events = [];
    const infected = GameState.actors.filter(a => a._infected && a.status !== 'mrtvy');

    if (infected.length > 0) {
      events.push({
        id: 'chronicon_regional_plague',
        icon: '☣️',
        title_cs: 'Zprávy o moru v kraji',
        title_en: 'News of plague in the region',
        text_cs: `Z okolí přicházejí znepokojivé zprávy — u ${infected[0].label} vypukla morová nákaza. Bratři se ptají, zda posílit dohled nad nemocnými.`,
        text_en: `Unsettling news arrives from nearby — plague has broken out near ${infected[0].label}. The brothers wonder whether to reinforce care for the sick.`,
        choices: [
          { id: 'bolster', label_cs: 'Posílit dohled (bude vyžadovat Infirmarium)', label_en: 'Reinforce care (will require the Infirmary)' },
          { id: 'ignore',  label_cs: 'Nechat být', label_en: 'Let it be' },
          { id: 'defer',   label_cs: 'Rozhodnout se později', label_en: 'Decide later' },
        ],
      });
    }

    // Právo sepultury — jen pro hráče s hodností Probošt (probost_only flag,
    // gate provádí Scriptorium samo, CHRONICON nezná rank jednotlivých hráčů).
    (GameState.pendingSepulturas || []).forEach(s => {
      events.push({
        id: s.id,
        kind: 'sepultura',
        icon: '⚱️',
        probost_only: true,
        wealth: s.wealth,
        title_cs: 'Žádost o právo sepultury',
        title_en: 'Request for the right of sepulture',
        text_cs: `Zesnul ${s.name} — ${s.profession}, muž nemalého jmění. Jeho rodina žádá klášter o dovolení pochovat jej uvnitř kostelních zdí, výměnou za štědrý dar na spásu duše.`,
        text_en: `The family of the late ${s.name} (${s.profession}, a man of no small means) petitions the monastery for permission to bury him within the church walls, in exchange for a generous gift for the soul's salvation.`,
        choices: [
          { id: 'accept',  label_cs: 'Přijmout dar a právo sepultury udělit', label_en: 'Accept the gift and grant the right' },
          { id: 'decline', label_cs: 'Zdvořile odmítnout', label_en: 'Politely decline' },
          { id: 'defer',   label_cs: 'Rozhodnout se později', label_en: 'Decide later' },
        ],
      });
    });

    // Farní životní události (křest/svatba/pohřeb) — sdílený vesnický pool,
    // anonymní jako pocestný (Scriptorium přiřazuje příjmení dynamicky přes
    // regex na "Rodina"/"Snoubenci"/"A family"/"A couple" — text_cs/text_en
    // MUSÍ začínat přesně tímhle slovem). probost_only stejně jako sepultura
    // — farní práva vykonává Probošt. requiredItems musí sedět s klientovou
    // _FARNI_REQUIRED_ITEMS tabulkou (farnost-chronicon-reference.md).
    const FARNI_TEXTS = {
      baptism: {
        icon: '👶',
        title_cs: 'Žádost o křest', title_en: 'Request for a christening',
        text_cs: 'Rodina žádá klášter o křest dítěte.',
        text_en: 'A family asks the monastery to christen their child.',
        requiredItems: [{ id: 'wine', qty: 1 }, { id: 'hostia', qty: 1 }, { id: 'paper', qty: 1 }],
      },
      wedding: {
        icon: '💍',
        title_cs: 'Žádost o oddání', title_en: 'Request for a wedding',
        text_cs: 'Snoubenci žádají klášter o oddání.',
        text_en: 'A couple asks the monastery to wed them.',
        requiredItems: [{ id: 'vellum', qty: 1 }, { id: 'candle', qty: 1 }, { id: 'wine', qty: 1 }],
      },
      funeral: {
        icon: '⚰️',
        title_cs: 'Žádost o pohřeb', title_en: 'Request for a funeral rite',
        text_cs: 'Rodina žádá klášter o pohřeb.',
        text_en: 'A family asks the monastery for a funeral rite.',
        requiredItems: [{ id: 'candle', qty: 2 }, { id: 'paper', qty: 1 }],
      },
    };
    (GameState.pendingFarniEvents || []).forEach(f => {
      const tx = FARNI_TEXTS[f.farniType];
      if (!tx) return;
      events.push({
        id: f.id,
        kind: 'farni',
        farniType: f.farniType,
        probost_only: true,
        icon: tx.icon,
        title_cs: tx.title_cs, title_en: tx.title_en,
        text_cs: tx.text_cs, text_en: tx.text_en,
        requiredItems: tx.requiredItems,
        choices: [
          { id: 'accept',  label_cs: '✝️ Vykonat obřad', label_en: '✝️ Officiate' },
          { id: 'decline', label_cs: '🚪 Odmítnout', label_en: '🚪 Decline' },
        ],
      });
    });

    // Infirmarium/Ubytovna hospités — kandidáti z pendingHospites (aktéři,
    // co vstoupili do krize/zanikající). Bez probost_only — péče o nemocné
    // a útočiště je univerzální, ne výsadní právo jako sepultura. Jméno
    // vždy v nominativu/podmětu — vyhýbá se pádovým koncovkám u
    // dynamickýho jména. war = Vlna 1 / C (ubytovna-mrd.md §8c-C), text
    // plague/poverty beze změny oproti předchozí verzi.
    const HOSPES_ICONS  = { plague: '☣️', war: '🏚️', poverty: '🩺' };
    const HOSPES_TITLES_CS = {
      plague: 'Poutník prchající před morem',
      war: 'Uprchlík z válkou zmítaného kraje',
      poverty: 'Nemocný u brány',
    };
    const HOSPES_TITLES_EN = {
      plague: 'A pilgrim fleeing the plague',
      war: 'A refugee from a war-torn region',
      poverty: 'A sick man at the gate',
    };
    const HOSPES_CHOICES = {
      plague: [
        { id: 'accept',  label_cs: 'Přijmout, i s rizikem',        label_en: 'Take him in, despite the risk' },
        { id: 'decline', label_cs: 'Odmítnout kvůli nákaze',       label_en: 'Turn him away, for fear of contagion' },
        { id: 'defer',   label_cs: 'Rozhodnout se později',        label_en: 'Decide later' },
      ],
      war: [
        { id: 'accept',  label_cs: 'Přijmout do Ubytovny',         label_en: 'Take him into the guesthouse' },
        { id: 'decline', label_cs: 'Nemáme, kam ho dát',           label_en: 'We have nowhere to put him' },
        { id: 'defer',   label_cs: 'Rozhodnout se později',        label_en: 'Decide later' },
      ],
      poverty: [
        { id: 'accept',  label_cs: 'Přijmout do Infirmaria',       label_en: 'Take him into the infirmary' },
        { id: 'decline', label_cs: 'Nemáme místa nazbyt',          label_en: 'We have no beds to spare' },
        { id: 'defer',   label_cs: 'Rozhodnout se později',        label_en: 'Decide later' },
      ],
    };
    (GameState.pendingHospites || []).forEach(h => {
      const cause = h.cause || 'poverty';
      const textCs = {
        plague: `Z kraje, kde řádí mor, dorazil k bráně vyčerpaný poutník. ${h.name} — ${h.profession} — leží v horečkách a prosí o vpuštění. Přijetí není bez rizika, ale i Kristus přijímal malomocné.`,
        war: `${h.name} — ${h.profession} — utekl z kraje zmítaného válkou, dům měl vypálený a rodinu rozehnanou. Prosí jen o střechu nad hlavou, dokud se poměry neuklidní.`,
        poverty: `${h.name} — ${h.profession} — postihla krutá bída a neduh, ulehl na lůžko. Rodina prosí klášter o milosrdenství a útočiště v Infirmariu.`,
      }[cause];
      const textEn = {
        plague: `From the region where plague rages, an exhausted pilgrim has reached the gate. ${h.name} — ${h.profession} — lies feverish and begs to be let in. Taking him in is not without risk, but Christ too received the lepers.`,
        war: `${h.name} — ${h.profession} — has fled a region torn by war, his house burned and his family scattered. He asks only for a roof over his head until things settle.`,
        poverty: `${h.name} — ${h.profession} — has been struck by bitter poverty and illness, and now lies abed. The family begs the monastery for mercy and shelter in the infirmary.`,
      }[cause];
      events.push({
        id: h.id,
        icon: HOSPES_ICONS[cause] || HOSPES_ICONS.poverty,
        kind: 'hospes',
        cause: cause,
        actorId: h.actorId,
        wealth: h.wealth,
        title_cs: HOSPES_TITLES_CS[cause] || HOSPES_TITLES_CS.poverty,
        title_en: HOSPES_TITLES_EN[cause] || HOSPES_TITLES_EN.poverty,
        text_cs: textCs || `${h.name} — ${h.profession} — postihla krutá bída a neduh, ulehl na lůžko. Rodina prosí klášter o milosrdenství a útočiště v Infirmariu.`,
        text_en: textEn || `${h.name} — ${h.profession} — has been struck by bitter poverty and illness, and now lies abed. The family begs the monastery for mercy and shelter in the infirmary.`,
        choices: HOSPES_CHOICES[cause] || HOSPES_CHOICES.poverty,
      });
    });

    // Studovna — žádost Vrchnosti, max 1 aktivní (studovna-vrchnost-mrd.md).
    // Bez rank gate — Vrchnost jedná s klášterem jako institucí.
    if (GameState.pendingStudovna) {
      const s = GameState.pendingStudovna;
      const TEXTS = {
        dispute: {
          title_cs: 'Spor o pozemky',
          title_en: 'A dispute over land',
          text_cs: 'Vrchnost žádá o nahlédnutí do klášterních listin — hraniční spor se sousedním panstvím se vleče už měsíce a staré mapy i darovací listiny by mohly rozhodnout. Studovna by mu poskytla klid a světlo k bádání.',
          text_en: "The Lord requests access to the monastery's charters — a boundary dispute with a neighboring estate has dragged on for months, and old maps and donation deeds could settle it. The study room would offer him quiet and light for his research.",
        },
        lineage: {
          title_cs: 'Otázka rodokmenu',
          title_en: 'A question of lineage',
          text_cs: 'Vrchnost potřebuje doložit svůj rodokmen — nárok na dědictví po vzdáleném příbuzném závisí na klášterních análech a pamětních knihách. Prosí o přístup do Studovny.',
          text_en: "The Lord needs to prove his lineage — a claim to inheritance from a distant relative depends on the monastery's annals and memorial books. He asks for access to the study room.",
        },
        testament: {
          title_cs: 'Sepsání závěti',
          title_en: 'Drafting a testament',
          text_cs: 'Vrchnost stárne a chce v klidu sepsat poslední vůli — s pomocí učeného bratra a přístupem k právním vzorům z klášterní knihovny. Žádá o Studovnu na pár dní.',
          text_en: 'The Lord is growing old and wishes to draft his last will in peace — with the help of a learned brother and access to legal precedents from the monastery library. He asks for the study room for a few days.',
        },
      };
      const tx = TEXTS[s.cause] || TEXTS.dispute;
      events.push({
        id: s.id,
        icon: '📜',
        kind: 'studovna',
        cause: s.cause,
        title_cs: tx.title_cs,
        title_en: tx.title_en,
        text_cs: tx.text_cs,
        text_en: tx.text_en,
        choices: [
          { id: 'accept',  label_cs: 'Otevřít Studovnu',      label_en: 'Open the study room' },
          { id: 'decline', label_cs: 'Zdvořile odmítnout',    label_en: 'Politely decline' },
          { id: 'defer',   label_cs: 'Rozhodnout se později', label_en: 'Decide later' },
        ],
      });
    }

    // Čtenář v Studovně (knihovna-rozsireni-mrd §4C1, 28.8.2026) — mirror
    // studovna výš, ale contactId je libovolný core aktér, ne natvrdo
    // Vrchnost. Kontrakt se Scriptoriem: kind:'ctenar', contactId,
    // choices accept/decline (2, ne 3 — na rozdíl od vypujcka níž).
    if (GameState.pendingCtenar) {
      const c = GameState.pendingCtenar;
      const actor = GameState.actors.find(x => x.id === c.actorId);
      const actorLabel = actor ? actor.label : c.actorId;
      const actorLabelEn = actor ? actor.label_en : c.actorId;
      const CTENAR_TEXTS = {
        recipe: {
          title_cs: 'Zvědavost o starém postupu',
          title_en: 'Curiosity about an old method',
          text_cs: `${actorLabel} slyšel, že klášterní knihovna chová spisy o řemeslech a postupech, jaké se dnes už málokde učí. Rád by si u vás na místě přečetl, co víte.`,
          text_en: `${actorLabelEn} has heard the monastery library holds writings on crafts and methods rarely taught these days. He would like to read what you know, here at the lectern.`,
        },
        faith: {
          title_cs: 'Duchovní útěcha',
          title_en: 'Spiritual comfort',
          text_cs: `${actorLabel} prochází těžkým obdobím a doslechl se, že vaše knihovna chová útěšné spisy. Prosí o chvíli v Studovně, s knihou v ruce.`,
          text_en: `${actorLabelEn} is going through a hard time and has heard your library holds comforting writings. He asks for a while in the study room, book in hand.`,
        },
        curiosity: {
          title_cs: 'Prostá zvědavost',
          title_en: 'Simple curiosity',
          text_cs: `${actorLabel} je v kraji známý svou zvědavostí — doslechl se o vaší knihovně a rád by nahlédl, co ukrývá, aspoň na jedno odpoledne.`,
          text_en: `${actorLabelEn} is known in these parts for his curiosity — word of your library reached him, and he would like to see what it holds, if only for an afternoon.`,
        },
      };
      const tx = CTENAR_TEXTS[c.cause] || CTENAR_TEXTS.curiosity;
      events.push({
        id: c.id,
        icon: '📖',
        kind: 'ctenar',
        contactId: c.actorId,
        title_cs: tx.title_cs,
        title_en: tx.title_en,
        text_cs: tx.text_cs,
        text_en: tx.text_en,
        choices: [
          { id: 'accept',  label_cs: 'Přijmout do Studovny', label_en: 'Receive in the study room' },
          { id: 'decline', label_cs: 'Zdvořile odmítnout',   label_en: 'Politely decline' },
        ],
      });
    }

    // Absenční výpůjčka (knihovna-rozsireni-mrd §4C2, 28.8.2026) — kniha
    // smí opustit klášter. 3 volby (ne 2) — accept_standard/accept_higher/
    // decline, kontrakt se Scriptoriem počítá s vyjednáváním o zástavě.
    // durationDays už rozhodnuto v engine.js (ContactRelationRegisterSystem).
    if (GameState.pendingVypujcka) {
      const v = GameState.pendingVypujcka;
      const actor = GameState.actors.find(x => x.id === v.actorId);
      const actorLabel = actor ? actor.label : v.actorId;
      const actorLabelEn = actor ? actor.label_en : v.actorId;
      const VYPUJCKA_TEXTS = {
        study: {
          title_cs: 'Žádost o výpůjčku ke studiu',
          title_en: 'A request to borrow for study',
          text_cs: `${actorLabel} prosí o zapůjčení jednoho svazku domů, na ${v.durationDays} dní — slibuje pečlivé zacházení a zástavu dle zvyklosti.`,
          text_en: `${actorLabelEn} asks to borrow one volume home, for ${v.durationDays} days — he promises careful handling and a pledge as is customary.`,
        },
        copy: {
          title_cs: 'Žádost o opis',
          title_en: 'A request to copy',
          text_cs: `${actorLabel} by rád nechal knihu opsat vlastním písařem a potřebuje ji na ${v.durationDays} dní mimo klášter. Nabízí zástavu.`,
          text_en: `${actorLabelEn} would like to have the book copied by his own scribe and needs it away from the monastery for ${v.durationDays} days. He offers a pledge.`,
        },
        gift: {
          title_cs: 'Dar pro nemocného příbuzného',
          title_en: 'A gift for a sick relative',
          text_cs: `${actorLabel} má nemocného příbuzného, kterému by kniha přinesla útěchu na ${v.durationDays} dní. Zástavu složí bez váhání.`,
          text_en: `${actorLabelEn} has a sick relative to whom the book would bring comfort for ${v.durationDays} days. He offers the pledge without hesitation.`,
        },
      };
      const tx = VYPUJCKA_TEXTS[v.cause] || VYPUJCKA_TEXTS.study;
      events.push({
        id: v.id,
        icon: '📤',
        kind: 'vypujcka',
        contactId: v.actorId,
        durationDays: v.durationDays,
        title_cs: tx.title_cs,
        title_en: tx.title_en,
        text_cs: tx.text_cs,
        text_en: tx.text_en,
        choices: [
          { id: 'accept_standard', label_cs: 'Přijmout za nabídnutou zástavu', label_en: 'Accept the offered pledge' },
          { id: 'accept_higher',   label_cs: 'Žádat vyšší zástavu',            label_en: 'Demand a higher pledge' },
          { id: 'decline',         label_cs: 'Odmítnout',                     label_en: 'Decline' },
        ],
      });
    }

    // Pocestný u brány — fronta (Vlna 1 / ubytovna-mrd.md §8c-B,
    // rozšíření). Bez actorId, bez rank gate — nejběžnější a nejnižší
    // stakes typ hosta. Víc kandidátů může čekat najednou (mirror
    // pendingHospites forEach vzoru).
    const POCESTNY_TEXTS = {
      poutnik: {
        title_cs: 'Poutník u brány',
        title_en: 'A pilgrim at the gate',
        text_cs: 'K bráně dorazil unavený poutník, prý na cestě ke vzdálenému svatému místu. Prosí jen o jednu noc pod střechou a trochu chleba.',
        text_en: 'A weary pilgrim has reached the gate, bound — he says — for a distant shrine. He asks only for one night under a roof and a little bread.',
      },
      kramar: {
        title_cs: 'Kramář na cestě',
        title_en: 'A peddler on the road',
        text_cs: 'Potulný kramář s těžkým rancem žádá o nocleh výměnou za drobné zboží a novinky z okolních trhů.',
        text_en: 'A wandering peddler with a heavy pack asks for a night\'s lodging in exchange for small wares and news from the nearby markets.',
      },
      zebravy_mnich: {
        title_cs: 'Žebravý bratr',
        title_en: 'A mendicant friar',
        text_cs: 'Bratr z žebravého řádu, na cestě mezi kláštery, prosí o pohostinství na jednu noc — jak velí řehole i zvyk mezi domy stejné víry.',
        text_en: 'A friar of a mendicant order, traveling between monasteries, asks for one night\'s hospitality — as both rule and custom demand between houses of the same faith.',
      },
    };
    (GameState.pendingPocestny || []).forEach(p => {
      const tx = POCESTNY_TEXTS[p.variant] || POCESTNY_TEXTS.poutnik;
      events.push({
        id: p.id,
        icon: '🥾',
        kind: 'pocestny',
        variant: p.variant,
        title_cs: tx.title_cs,
        title_en: tx.title_en,
        text_cs: tx.text_cs,
        text_en: tx.text_en,
        choices: [
          { id: 'accept',  label_cs: 'Přijmout na noc',       label_en: 'Take him in for the night' },
          { id: 'decline', label_cs: 'Zdvořile odmítnout',    label_en: 'Politely decline' },
          { id: 'defer',   label_cs: 'Rozhodnout se později', label_en: 'Decide later' },
        ],
      });
    });

    // Žádost o surovinu na hráče — zakazky-centralizace-mrd Fáze 2 (26.7.2026).
    // Spouštěč = skutečná krize (mrtvý dodavatel), viz core/engine.js.
    if (GameState.pendingMaterialRequest) {
      const m = GameState.pendingMaterialRequest;
      const actor = GameState.actors.find(x => x.id === m.actorId);
      const who_cs = actor ? actor.label : 'Řemeslník';
      const who_en = actor ? (actor.label_en || actor.label) : 'A craftsman';
      events.push({
        kind: 'material',
        id: m.id,
        actorId: m.actorId, itemId: m.itemId, qty: m.qty,
        deadlineDays: m.deadlineDays, rewardGrose: m.rewardGrose,
        icon: '📦',
        title_cs: who_cs + ' potřebuje surovinu',
        title_en: who_en + ' needs a material',
        text_cs: who_cs + ' přišel o dodavatele a nutně potřebuje ' + m.qty + '× ' + m.itemId + '. Klášter by mohl pomoct výměnou za ' + m.rewardGrose + ' grošů, do ' + m.deadlineDays + ' dní.',
        text_en: who_en + ' has lost a supplier and urgently needs ' + m.qty + '× ' + m.itemId + '. The monastery could help in exchange for ' + m.rewardGrose + ' groschen, within ' + m.deadlineDays + ' days.',
        choices: [
          { id: 'accept',  label_cs: 'Pomůžeme',  label_en: 'We shall help' },
          { id: 'decline', label_cs: 'Nemůžeme',  label_en: 'We cannot' },
        ],
      });
    }

    return events;
  },


  // V2: přidat svátky, půsty, církevní kalendář
  _calendar() {
    const t       = GameState.time;
    const dayOfYear = (t.season * t.daysPerSeason) + t.day;

    return {
      day_of_year: dayOfYear,
      season:      StateHelpers.seasonName(),
      season_icon: StateHelpers.seasonIcon(),
      year:        t.year,
      note:        null,   // V2: "Sv. Václav", "Advent", "Velikonoce" atd.
    };
  },

};

module.exports = { Snapshot };
