// ─────────────────────────────────────────────────────────────
// GuildsDB — Cechy: městská regulace mimo klášterní zdi
// MRD: cechy-a-prava-mrd.md v0.1-v0.6 (v0.6, 24.8.2026)
// Cechmistři, Fáze 0 (Opatova brána PER cech×věc — matters[]), Fáze 1
// (Cechmistr), Fáze 2 (Privilegium + 10% poplatek), Sparkline + Trend.
// v0.6: každý cech má pole `matters` — u většiny cechů jedna položka,
// Pekařský má DVĚ (stavba Furnusu, pak samostatně prodej chleba) —
// dvě samostatné petice, dvě samostatné ratifikace (mirror v0.3 §1).
// ─────────────────────────────────────────────────────────────

const GUILDS_BASE_ACTIVE = ['mlynarsky', 'truhlarsky', 'kolarsky', 'kovarsky'];

function getActiveGuilds() {
    if (typeof GameState !== 'undefined') {
        if (!GameState.activeGuilds || !Array.isArray(GameState.activeGuilds)) {
            GameState.activeGuilds = [...GUILDS_BASE_ACTIVE];
        }
        return GameState.activeGuilds;
    }
    return GUILDS_BASE_ACTIVE;
}

const GuildsDB = {
    mlynarsky: {
        id: 'mlynarsky',
        name: 'Mlynářský cech',
        name_en: "The Millers' Guild",
        masterName: 'Vavřinec Otrubka',
        masterIcon: '🌾',
        desc: 'Vychytralejší než liška, počítá každý zrno. Podezírá klášter, že mele pro sebe a šidí ho na mlecím poplatku.',
        desc_en: 'Sharper than a fox, counts every grain. Suspects the monastery grinds for itself and cheats on milling fees.',
        matters: [
            {
                key: 'mlynarsky:mouka',
                label: 'Povolení k jednání o prodeji mouky',
                label_en: 'Permission to negotiate flour sales',
                privilegeType: 'A',
                privilegeLabel: 'Právo prodeje mouky na Trhu bez fušerství (průběžný poplatek 10%)',
                privilegeLabel_en: 'Right to sell flour at Market without botching (10% ongoing fee)',
                affectedGoods: ['flour', 'spelt_flour', 'rye_flour'],
            },
        ],
    },
    truhlarsky: {
        id: 'truhlarsky',
        name: 'Truhlářský cech',
        name_en: "The Cabinetmakers' Guild",
        masterName: 'Ondřej Hoblina',
        masterIcon: '🪑',
        desc: 'Hrdej na jemnou práci, dívá se skrz prsty na hrubé řemeslníky. Rád mluví o kvalitě dřeva a poctivém čepování.',
        desc_en: 'Proud of fine work, looks down on coarse crafts. Loves talking about wood quality and honest joinery.',
        matters: [
            {
                key: 'truhlarsky:truhlarna',
                label: 'Povolení k jednání o stavbě Truhlárny',
                label_en: 'Permission to negotiate Cabinetry Workshop',
                privilegeType: 'B',
                privilegeLabel: 'Stavební povolení na Truhlárnu',
                privilegeLabel_en: 'Building Permit for Cabinetry Workshop',
                affectedGoods: ['plank', 'furniture', 'chest'],
            },
        ],
    },
    kolarsky: {
        id: 'kolarsky',
        name: 'Kolářský cech',
        name_en: "The Wheelwrights' Guild",
        masterName: 'Šimon Loukoť',
        masterIcon: '🛞',
        desc: 'Praktik, nesnáší Hoblinovu parádu — dřevo má sloužit, ne se lesknout. Otevřený rival Truhlářského cechmistra.',
        desc_en: 'Practical, hates Hoblina\'s showiness — wood must serve. Open rival of the Cabinetmakers\' master.',
        matters: [
            {
                key: 'kolarsky:kolarna',
                label: 'Povolení k jednání o stavbě Kolárny',
                label_en: 'Permission to negotiate Wheelwright Workshop',
                privilegeType: 'B',
                privilegeLabel: 'Stavební povolení na Kolárnu',
                privilegeLabel_en: 'Building Permit for Wheelwright Workshop',
                affectedGoods: ['wheel', 'cart', 'axle'],
            },
        ],
    },
    kovarsky: {
        id: 'kovarsky',
        name: 'Kovářský a hamernický cech',
        name_en: "The Smiths' and Forgemasters' Guild",
        masterName: 'Matouš Kladivo',
        masterIcon: '🔨',
        desc: 'Přímej, fyzicky drsnej, netrpělivej na řeči. Chce vidět uhlí a rudu, ne poklony. Respektuje dodržené slovo.',
        desc_en: 'Direct, tough, impatient with talk. Wants to see coal and ore, not bows. Respects a kept word.',
        matters: [
            {
                key: 'kovarsky:hamr',
                label: 'Povolení k jednání o stavbě Hamru',
                label_en: 'Permission to negotiate Forge',
                privilegeType: 'B',
                privilegeLabel: 'Stavební povolení na Hamr',
                privilegeLabel_en: 'Building Permit for Forge',
                affectedGoods: ['iron_ingot', 'iron_pickaxe', 'nails', 'scythe', 'worn_iron_pickaxe'],
            },
        ],
    },
    pekarsky: {
        id: 'pekarsky',
        name: 'Pekařský cech',
        name_en: "The Bakers' Guild",
        masterName: 'Prokop Muka',
        masterIcon: '🥖',
        desc: 'Přísný na váhu chleba a čistotu mouky. Klášterní pec a prodej pečiva hlídá ostřížím zrakem.',
        desc_en: 'Strict on bread weight and flour purity. Watches the monastery oven and pastry sales like a hawk.',
        // ZVLÁŠTNÍ PŘÍPAD (MRD v0.3 §1) — dvě samostatné věci, dvě petice:
        // 1) stavební povolení na Furnus (Typ B, žádné affectedGoods —
        //    neřeší prodej, jen stavbu), 2) až Furnus stojí, samostatně
        //    právo prodeje chleba (Typ A, ovlivňuje Trh). Mouka zůstává
        //    výhradně u Mlynářského cechu — pečivo je jiná komodita.
        matters: [
            {
                key: 'pekarsky:furnus',
                label: 'Povolení k jednání o stavbě Furnusu (Pekárny)',
                label_en: 'Permission to negotiate Bakery Oven (Furnus)',
                privilegeType: 'B',
                privilegeLabel: 'Stavební povolení na Furnus',
                privilegeLabel_en: 'Building Permit for Bakery Oven (Furnus)',
                affectedGoods: [],
            },
            {
                key: 'pekarsky:chleba',
                label: 'Povolení k jednání o prodeji chleba',
                label_en: 'Permission to negotiate bread sales',
                privilegeType: 'A',
                privilegeLabel: 'Právo prodeje chleba na Trhu bez fušerství (průběžný poplatek 10%)',
                privilegeLabel_en: 'Right to sell bread at Market without botching (10% ongoing fee)',
                affectedGoods: ['bread', 'pastry', 'hostia'],
            },
        ],
    },
    reznicky: {
        id: 'reznicky',
        name: 'Řeznický cech',
        name_en: "The Butchers' Guild",
        masterName: 'Bohuslav Sekera',
        masterIcon: '🥩',
        desc: 'Obávaný a vlivný měšťan. Přísně střeží městské masné krámy a porážky zvířat.',
        desc_en: 'Feared and influential burgher. Strictly guards town meat stalls and animal slaughtering.',
        matters: [
            {
                key: 'reznicky:maso',
                label: 'Povolení k jednání o prodeji masa',
                label_en: 'Permission to negotiate meat sales',
                privilegeType: 'A',
                privilegeLabel: 'Právo prodeje masa na Trhu bez fušerství (průběžný poplatek 10%)',
                privilegeLabel_en: 'Right to sell meat at Market without botching (10% ongoing fee)',
                affectedGoods: ['meat', 'sausage', 'lard'],
            },
        ],
    },
    zlatnicky: {
        id: 'zlatnicky',
        name: 'Zlatnický cech',
        name_en: "The Goldsmiths' Guild",
        masterName: 'Krištof Pozlátko',
        masterIcon: '👑',
        desc: 'Precizní zlatník, vyžaduje ryzost kovů a dohliží na exkluzivní klenotové desky vzácných knih.',
        desc_en: 'Precise goldsmith, demands metal purity and oversees exclusive jeweled book covers.',
        matters: [
            {
                key: 'zlatnicky:klenot',
                label: 'Povolení k jednání o prodeji klenotové vazby',
                label_en: 'Permission to negotiate jeweled binding sales',
                privilegeType: 'A',
                privilegeLabel: 'Právo prodeje klenotových vazeb na Trhu (průběžný poplatek 10%)',
                privilegeLabel_en: 'Right to sell jeweled bindings at Market (10% ongoing fee)',
                affectedGoods: ['jeweled_binding', 'gold_leaf', 'silver_ingot'],
            },
        ],
    },
    kozeluzsky: {
        id: 'kozeluzsky',
        name: 'Koželužský cech',
        name_en: "The Tanners' Guild",
        masterName: 'Václav Tříska',
        masterIcon: '📜',
        desc: 'Cítit po třísle a mořidle. Výměnou za respekt a zakázky dodá klášteru nejlepší vydělanou kůži.',
        desc_en: 'Smells of tanbark and mordant. In exchange for respect and orders, supplies fine tanned hides.',
        matters: [
            {
                key: 'kozeluzsky:kuze',
                label: 'Povolení k jednání o dodávkách vydělané kůže',
                label_en: 'Permission to negotiate tanned hide supply',
                privilegeType: 'C',
                privilegeLabel: 'Přístup k celoevropské vydělané kůži pro knižní desky',
                privilegeLabel_en: 'Access to fine tanned hides for bookbinding',
                affectedGoods: ['leather', 'tanned_leather', 'vellum'],
            },
        ],
    },
};

// Najde { guild, matter } podle ID položky — jedna položka spadá vždy
// nejvýš pod jednu "věc" jednoho cechu (v0.6 — matter-level granularita).
function getItemGuildMatter(itemId) {
    if (!itemId) return null;
    for (const g of Object.values(GuildsDB)) {
        if (!g.matters) continue;
        for (const m of g.matters) {
            if (m.affectedGoods && m.affectedGoods.includes(itemId)) {
                return { guild: g, matter: m };
            }
        }
    }
    return null;
}

// Zpětně kompatibilní helper — jen cech (bez matter), pro místa, co matter
// nepotřebují.
function getItemGuild(itemId) {
    const found = getItemGuildMatter(itemId);
    return found ? found.guild : null;
}

// Sparklines helper (` ▂▃▄▅▆▇█`)
function getGuildSparkline(guildId) {
    if (typeof GameState === 'undefined' || !GameState.guildRelationHistory) return '──────';
    const history = GameState.guildRelationHistory[guildId];
    if (!history || !Array.isArray(history) || history.length === 0) return '──────';

    const SPARK_CHARS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const values = history.slice(-14).map(h => (typeof h === 'object' ? h.value : h));

    return values.map(v => {
        const clamped = Math.max(0, Math.min(100, v));
        const idx = Math.min(7, Math.floor((clamped / 100) * 8));
        return SPARK_CHARS[idx];
    }).join('');
}

// Trend helper (porovnání dneška s hodnotou před 7 dny)
function getGuildTrend(guildId) {
    if (typeof GameState === 'undefined' || !GameState.guildRelationHistory) {
        return { arrow: '→', delta: 0, color: 'opacity:0.6;' };
    }
    const history = GameState.guildRelationHistory[guildId];
    if (!history || !Array.isArray(history) || history.length === 0) {
        return { arrow: '→', delta: 0, color: 'opacity:0.6;' };
    }

    const currentRel = (GameState.guildRelation && GameState.guildRelation[guildId]) || 0;
    const pastEntry = history.length >= 7 ? history[history.length - 7] : history[0];
    const pastVal = typeof pastEntry === 'object' ? pastEntry.value : pastEntry;

    const delta = currentRel - pastVal;
    if (delta > 0) {
        return { arrow: '▲', delta: `+${delta}`, color: 'color:#4CAF50; font-weight:bold;' };
    } else if (delta < 0) {
        return { arrow: '▼', delta: `${delta}`, color: 'color:#F44336; font-weight:bold;' };
    } else {
        return { arrow: '→', delta: '0', color: 'opacity:0.6;' };
    }
}

// Záznam denního snapshotu vztahu
function recordGuildRelationSnapshot(gameDay) {
    if (typeof GameState === 'undefined') return;
    if (!GameState.guildRelationHistory) GameState.guildRelationHistory = {};

    const active = getActiveGuilds();
    active.forEach(id => {
        if (!GameState.guildRelationHistory[id]) GameState.guildRelationHistory[id] = [];
        const curRel = (GameState.guildRelation && GameState.guildRelation[id]) || 0;
        const list = GameState.guildRelationHistory[id];

        // Zamezit duplicitu v ten samý den
        const last = list[list.length - 1];
        if (last && last.day === gameDay) {
            last.value = curRel;
        } else {
            list.push({ day: gameDay, value: curRel });
            if (list.length > 14) list.shift();
        }
    });
}
