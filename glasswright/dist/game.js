"use strict";
// ============================================================
// Glasswright — core: RNG, types, config
// Disposable fun-test codebase. No modules; compiled via --outFile.
// ============================================================
const COLORS = ['red', 'blue', 'yellow', 'green', 'purple'];
// ---------- Seeded RNG (mulberry32, string-seedable) ----------
function hashSeed(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return (h ^= h >>> 16) >>> 0;
}
class RNG {
    constructor(seed) {
        this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
        if (this.state === 0)
            this.state = 0x9e3779b9;
    }
    next() {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(maxExclusive) {
        return Math.floor(this.next() * maxExclusive);
    }
    d6() {
        return 1 + this.int(6);
    }
    pick(arr) {
        return arr[this.int(arr.length)];
    }
    shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}
// ---------- Config: every tuning coefficient lives here ----------
const CONFIG = {
    startingBag: { perColor: 2 }, // 2 of each of 5 colors = 10 dice
    roundsPerEncounter: 3,
    encounters: 5, // E1-E4 artisans, E5 Iconoclast
    marketSize: 4, // dice available for the 2+2 draft
    draftPicksPerSide: 2,
    rerollsPerRound: 2,
    prism: {
        'lone': 1, 'pair': 2, 'trips': 3, 'two-pair': 3, 'straight-4': 4,
        'full-house': 4, 'four-kind': 5, 'flush-5': 5, 'straight-5': 5,
        'five-kind': 7, 'straight-6': 8, 'six-kind': 12,
    },
    // Monochrome (all one color) / Spectrum (all distinct colors) hand variants:
    // +floor(n/2) Prism. Spectrum needs 3+ dice; flush-5 is already color-scored.
    colorModBonusPerTwoDice: 1,
    // Artisan pile score = round(warpedPilePips * accrual[encounterIdx])
    artisanAccrual: [6.3, 11.6, 19.2, 29.6], // E1..E4 — steep: the player's bag/relics snowball too
    artisanPickTelegraph: true,
    gold: {
        start: 6,
        encounterReward: [10, 13, 16, 20], // for winning E1..E4 (escalating)
        marginBonusPer50: 1, // +1 gold per 50 points of victory margin
    },
    shop: {
        dieSlots: 2,
        relicSlots: 2,
        priceByRarity: { common: 5, uncommon: 8, rare: 12, legendary: 18 },
        plainDiePrice: 4,
        removeDiePrice: 4,
        priceEscalationPerEncounter: 1, // all prices +1 per encounter index
    },
    tribute: { dieChoices: 3, relicChoices: 3 },
    finale: {
        smashCount: 6, // he smashes your top-N committed hands (by score), chronological order
        claimCap: 3, // reclaim at most this many per smash...
        // ...and at most HALF the hand (floor): big hands give you more glass AND feed him more.
        // Kills the "commit only 3-die hands so he starves" exploit — he always keeps >= half.
        lightScale: 7.5, // his Light = scale * unclaimed pips
        specialPrismWeight: 0.75, // his Prism += weight per unclaimed special
        colorVarietyThreshold: 4, // unique colors among unclaimed...
        colorVarietyBonus: 1, // ...adds this to his Prism
    },
    specials: {
        beaconPerDie: 5, // Beacon: +N Light per other die in its hand
        sparkPrism: 2, // Spark: hand +N Prism
        crescendoPerHand: 1, // Crescendo: +N Prism per prior special-bearing hand this encounter
        lensPerGreen: 4, // Lens: other green dice in hand +N Light each
        rosePerColor: 12, // The Rose: hand +N Light per unique color in hand
        crownLight: 50, // Chromatic Crown: if hand has all 5 colors...
        crownPrism: 2,
        tithePerYellow: 1, // Tithe: +N gold per yellow die in its hand
        cofferPerGold: 0.5, // Coffer: +N Light per gold held...
        cofferCap: 20, // ...capped
        hereticLight: 10, // Heretic: hand ignores artisan warp, +N Light
        chimePrism: 2, // Chime: next hand this round +N Prism
        vigilPerEncounter: 4, // Vigil: +N Light per completed encounter
        keystoneLight: 25, // Keystone: +N Light if hand is exactly 5 dice
    },
    relics: {
        burnishPerDie: 1,
        coinPressPerRound: 1,
        variegatedPerColor: 2,
        tincturePerPair: 4,
        merchantsDiscount: 1,
        rerollerBonus: 1,
        ledgerGold: 2, // Glazier's Ledger: gold on committing prism>=4 hand
        ledgerMinPrism: 4,
        annealerPerCarried: 2, // The Annealer: carried dice +N Light when committed
        pilgrimagePerEncounter: 6, // Pilgrimage: +N Light per completed encounter, every hand
        endowmentGold: 15, // Patron's Endowment: gold on pickup
    },
    bot: {
        earlyCommitMinScore: 40, // rounds 1-2: commit hands scoring at least this
        earlyCommitMinDice: 3, // ...or using at least this many dice
    },
};
// ============================================================
// Hand shape detection + full scoring (pure; engine applies results)
// Shapes x color variants: Monochrome (all one color) and Spectrum
// (all distinct colors) upgrade any shape's Prism by floor(n/2).
// ============================================================
const HAND_LABEL = {
    'lone': 'Lone Die', 'pair': 'Pair', 'trips': 'Three of a Kind', 'two-pair': 'Two Pair',
    'straight-4': 'Straight of 4', 'full-house': 'Full House', 'four-kind': 'Four of a Kind',
    'flush-5': 'Color Flush', 'straight-5': 'Straight of 5', 'five-kind': 'Five of a Kind',
    'straight-6': 'Straight of 6', 'six-kind': 'SIX OF A KIND',
};
const KIND_SHAPES = ['pair', 'trips', 'two-pair', 'full-house', 'four-kind', 'five-kind', 'six-kind'];
function handLabelFull(type, colorMod) {
    const prefix = colorMod === 'mono' ? 'Monochrome ' : colorMod === 'spectrum' ? 'Spectrum ' : '';
    return prefix + HAND_LABEL[type];
}
function isSpecial(d, id) { return d.spec.specialId === id; }
function handHas(dice, id) { return dice.some(d => isSpecial(d, id)); }
// Warp multiplier for a single die's Light. Iris (wild color) always resolves player-favorably.
function warpMult(d, warp) {
    const wild = isSpecial(d, 'iris');
    if (warp.artisanId === 'cardinal') {
        return (wild || d.spec.color === 'red') ? 2 : 0.5;
    }
    if (warp.artisanId === 'triad') {
        return (wild || warp.blessedColors.indexOf(d.spec.color) >= 0) ? 1 : 0.5;
    }
    return 1;
}
// Face-dependent warp (Modulist) — applied with resolved faces.
function faceWarpMult(face, warp) {
    if (warp.artisanId === 'modulist')
        return face % 2 === 1 ? 0.5 : 1;
    return 1;
}
// Distinct colors in a set, counting each Iris as one missing color (favorable).
function uniqueColorCount(dice) {
    const set = new Set();
    let iris = 0;
    for (const d of dice) {
        if (isSpecial(d, 'iris'))
            iris++;
        else
            set.add(d.spec.color);
    }
    return Math.min(5, set.size + iris);
}
function hasAllFiveColors(dice) { return uniqueColorCount(dice) >= 5; }
// All one color? (Iris joins.) All distinct? (Iris fills a gap.)
function detectColorMod(dice, shape) {
    const n = dice.length;
    if (n < 2 || shape === 'flush-5' || shape === 'lone')
        return 'none';
    const real = dice.filter(d => !isSpecial(d, 'iris')).map(d => d.spec.color);
    const distinct = new Set(real).size;
    if (distinct <= 1)
        return 'mono'; // 0 or 1 real colors: irises complete the set
    if (n >= 3 && distinct === real.length && n <= 5)
        return 'spectrum';
    return 'none';
}
// ---------- Shape detection (faces already resolved for wild numbers) ----------
function detectShapes(faces, dice) {
    const n = faces.length;
    const out = [];
    const counts = new Map();
    for (const f of faces)
        counts.set(f, (counts.get(f) || 0) + 1);
    const distinct = Array.from(counts.keys()).sort((a, b) => a - b);
    const isRun = distinct.length === n && distinct[n - 1] - distinct[0] === n - 1;
    const groupSizes = Array.from(counts.values()).sort((a, b) => b - a);
    if (n === 1)
        out.push('lone');
    if (n === 2 && groupSizes[0] === 2)
        out.push('pair');
    if (n === 3 && groupSizes[0] === 3)
        out.push('trips');
    if (n === 4) {
        if (isRun)
            out.push('straight-4');
        if (groupSizes[0] === 4)
            out.push('four-kind');
        if (groupSizes[0] === 2 && groupSizes[1] === 2)
            out.push('two-pair');
    }
    if (n === 5) {
        if (groupSizes[0] === 5)
            out.push('five-kind');
        if (isRun)
            out.push('straight-5');
        if (groupSizes[0] === 3 && groupSizes[1] === 2)
            out.push('full-house');
        // Color flush: 5 dice sharing one color (Iris wild)
        const colorNeed = new Map();
        let iris = 0;
        for (const d of dice) {
            if (isSpecial(d, 'iris'))
                iris++;
            else
                colorNeed.set(d.spec.color, (colorNeed.get(d.spec.color) || 0) + 1);
        }
        const maxColor = Math.max(0, ...Array.from(colorNeed.values()));
        if (maxColor + iris >= 5)
            out.push('flush-5');
    }
    if (n === 6) {
        if (isRun && distinct[0] === 1)
            out.push('straight-6');
        if (groupSizes[0] === 6)
            out.push('six-kind');
    }
    return out;
}
// ---------- Full evaluation ----------
function evaluateHand(dice, ctx) {
    const bad = (reason) => ({
        ok: false, reason, type: null, colorMod: 'none', prism: 0, light: 0, score: 0, perDie: [], notes: [], goldGained: 0,
    });
    if (dice.length === 0)
        return bad('No dice selected.');
    if (dice.length > 6)
        return bad('Hands are at most 6 dice.');
    const heretic = handHas(dice, 'heretic'); // Heretic: hand ignores the Artisan's warp & rules
    // Pedant legality: no two dice of the same color in a hand (Iris counts as any absent color)
    if (!heretic && ctx.warp.artisanId === 'pedant') {
        const seen = new Set();
        let irisCount = 0, dup = false;
        for (const d of dice) {
            if (isSpecial(d, 'iris'))
                irisCount++;
            else {
                if (seen.has(d.spec.color))
                    dup = true;
                seen.add(d.spec.color);
            }
        }
        if (dup || seen.size + irisCount > 5)
            return bad('The Pedant forbids repeated colors in a hand.');
    }
    // Wild numbers (Quicksilver): brute-force face assignments, keep the best-scoring result.
    const wildIdx = dice.map((d, i) => isSpecial(d, 'quicksilver') ? i : -1).filter(i => i >= 0);
    let best = null;
    let lastBad = null;
    const combos = [];
    const build = (acc) => {
        if (acc.length === wildIdx.length) {
            combos.push(acc.slice());
            return;
        }
        for (let f = 1; f <= 6; f++) {
            acc.push(f);
            build(acc);
            acc.pop();
        }
    };
    build([]);
    for (const combo of combos) {
        const faces = dice.map((d, i) => {
            const w = wildIdx.indexOf(i);
            return w >= 0 ? combo[w] : d.face;
        });
        // Brass Architect: every hand must hold at least one EVEN face
        if (!heretic && ctx.warp.artisanId === 'architect' && !faces.some(f => f % 2 === 0)) {
            lastBad = bad('The Brass Architect requires an even face in every hand.');
            continue;
        }
        const shapes = detectShapes(faces, dice);
        for (const shape of shapes) {
            const ev = scoreShape(dice, faces, shape, ctx, heretic);
            if (!best || ev.score > best.score)
                best = ev;
        }
    }
    if (!best)
        return lastBad || bad('Not a valid hand (press H for the hand chart).');
    return best;
}
function scoreShape(dice, faces, shape, ctx, heretic) {
    const cfg = ctx.cfg;
    const S = cfg.specials, R = cfg.relics;
    const notes = [];
    const n = dice.length;
    const has = (id) => handHas(dice, id);
    const relic = (id) => ctx.relics.indexOf(id) >= 0;
    const uniq = uniqueColorCount(dice);
    const warpId = heretic ? null : ctx.warp.artisanId;
    // Per-die light: warped face value
    const perDie = dice.map((d, i) => {
        const mult = heretic ? 1 : warpMult(d, ctx.warp) * faceWarpMult(faces[i], ctx.warp);
        return { die: d, light: faces[i] * mult };
    });
    if (warpId === 'cardinal')
        notes.push('Cardinal: red ×2, others ×½');
    if (warpId === 'triad')
        notes.push('Triad: unblessed ×½');
    if (warpId === 'modulist')
        notes.push('Modulist: odd faces ×½');
    // Special dice — additive Light attached to specific dice (drives float animations)
    for (let i = 0; i < dice.length; i++) {
        const d = dice[i];
        if (isSpecial(d, 'beacon') && n > 1) {
            perDie[i].light += S.beaconPerDie * (n - 1);
            notes.push(`Beacon +${S.beaconPerDie * (n - 1)}`);
        }
        if (isSpecial(d, 'lens')) {
            let greens = 0;
            for (let j = 0; j < dice.length; j++) {
                if (j !== i && (dice[j].spec.color === 'green' || isSpecial(dice[j], 'iris'))) {
                    perDie[j].light += S.lensPerGreen;
                    greens++;
                }
            }
            if (greens > 0)
                notes.push(`Lens +${S.lensPerGreen}×${greens} green`);
        }
        if (isSpecial(d, 'rose')) {
            perDie[i].light += S.rosePerColor * uniq;
            notes.push(`The Rose +${S.rosePerColor}×${uniq} colors`);
        }
        if (isSpecial(d, 'coffer')) {
            const bonus = Math.min(S.cofferCap, Math.floor(ctx.gold * S.cofferPerGold));
            perDie[i].light += bonus;
            if (bonus > 0)
                notes.push(`Coffer +${bonus} (gold)`);
        }
        if (isSpecial(d, 'anchor') && n === 1) {
            perDie[i].light += ctx.trayRestPips;
            notes.push(`Anchor +${ctx.trayRestPips} (tray pips)`);
        }
        if (isSpecial(d, 'heretic')) {
            perDie[i].light += S.hereticLight;
            notes.push(`Heretic +${S.hereticLight}, ignores Artisan`);
        }
        if (isSpecial(d, 'vigil') && ctx.encountersCompleted > 0) {
            perDie[i].light += S.vigilPerEncounter * ctx.encountersCompleted;
            notes.push(`Vigil +${S.vigilPerEncounter * ctx.encountersCompleted}`);
        }
        if (isSpecial(d, 'keystone') && n === 5) {
            perDie[i].light += S.keystoneLight;
            notes.push(`Keystone +${S.keystoneLight}`);
        }
    }
    if (has('crown') && hasAllFiveColors(dice)) {
        perDie[dice.findIndex(d => isSpecial(d, 'crown'))].light += S.crownLight;
        notes.push(`Chromatic Crown +${S.crownLight} Light +${S.crownPrism} Prism`);
    }
    // Relic additive Light (hand-level)
    let flatLight = 0;
    if (relic('burnish')) {
        flatLight += R.burnishPerDie * n;
        notes.push(`Burnish +${R.burnishPerDie * n}`);
    }
    if (relic('variegated')) {
        flatLight += R.variegatedPerColor * uniq;
        notes.push(`Variegated Lens +${R.variegatedPerColor * uniq}`);
    }
    if (relic('tincture')) {
        const byColor = new Map();
        let iris = 0;
        for (const d of dice) {
            if (isSpecial(d, 'iris'))
                iris++;
            else
                byColor.set(d.spec.color, (byColor.get(d.spec.color) || 0) + 1);
        }
        let maxC = null, maxN = 0;
        byColor.forEach((v, k) => { if (v > maxN) {
            maxN = v;
            maxC = k;
        } });
        if (maxC !== null)
            byColor.set(maxC, maxN + iris);
        else if (iris > 0)
            byColor.set('red', iris);
        let pairs = 0;
        byColor.forEach(v => pairs += Math.floor(v / 2));
        if (pairs > 0) {
            flatLight += R.tincturePerPair * pairs;
            notes.push(`Tincture +${R.tincturePerPair * pairs}`);
        }
    }
    if (relic('annealer')) {
        const carried = dice.filter(d => d.carried).length;
        if (carried > 0) {
            flatLight += R.annealerPerCarried * carried;
            notes.push(`The Annealer +${R.annealerPerCarried * carried}`);
        }
    }
    if (relic('pilgrimage') && ctx.encountersCompleted > 0) {
        flatLight += R.pilgrimagePerEncounter * ctx.encountersCompleted;
        notes.push(`Pilgrimage +${R.pilgrimagePerEncounter * ctx.encountersCompleted}`);
    }
    let light = perDie.reduce((a, p) => a + p.light, 0) + flatLight;
    // Hand-level Light warps
    if (warpId === 'numerologist') {
        const rawSum = faces.reduce((a, b) => a + b, 0);
        if (rawSum % 5 !== 0) {
            light *= 0.5;
            notes.push('Numerologist: ×½ (sum not ÷5)');
        }
        else
            notes.push('Numerologist satisfied (÷5)');
    }
    if (warpId === 'iconographer' && n >= 3 && uniq < 3) {
        light *= 0.75;
        notes.push('Iconographer: ×¾ (fewer than 3 colors)');
    }
    // Prism: shape + color variant + specials + relics + artisan adjustments
    let prism = cfg.prism[shape];
    const colorMod = detectColorMod(dice, shape);
    if (colorMod !== 'none') {
        const bonus = Math.floor(n / 2) * cfg.colorModBonusPerTwoDice;
        prism += bonus;
        notes.push(`${colorMod === 'mono' ? 'Monochrome' : 'Spectrum'} +${bonus} Prism`);
    }
    if (has('spark')) {
        prism += S.sparkPrism;
        notes.push(`Spark +${S.sparkPrism} Prism`);
    }
    if (has('crescendo') && ctx.priorSpecialHandsThisEncounter > 0) {
        const b = S.crescendoPerHand * ctx.priorSpecialHandsThisEncounter;
        prism += b;
        notes.push(`Crescendo +${b} Prism`);
    }
    if (has('crown') && hasAllFiveColors(dice))
        prism += S.crownPrism;
    if (ctx.pendingChimePrism > 0) {
        prism += ctx.pendingChimePrism;
        notes.push(`Chime +${ctx.pendingChimePrism} Prism`);
    }
    if (relic('holylight') && ctx.handsCommittedThisRound > 0) {
        prism += 1;
        notes.push('Holy Light +1 Prism');
    }
    if (relic('lightbringer') && ctx.handsCommittedThisRound === 0) {
        prism += 1;
        notes.push('Light-Bringer +1 Prism');
    }
    if (relic('prismcut') && uniq >= 4) {
        prism += 1;
        notes.push('Prism Cut +1 Prism');
    }
    if (warpId === 'statistician' && KIND_SHAPES.indexOf(shape) >= 0) {
        prism = Math.max(1, prism - 1);
        notes.push('Statistician: matched sets −1 Prism');
    }
    if (warpId === 'hereticsaint') {
        prism += 1;
        notes.push('Heretic Saint: +1 Prism (no rules!)');
    }
    // Gold side effects (returned, applied by engine)
    let goldGained = 0;
    const titheIdx = dice.findIndex(d => isSpecial(d, 'tithe'));
    if (titheIdx >= 0) {
        const yellows = dice.filter(d => d.spec.color === 'yellow' || isSpecial(d, 'iris')).length;
        goldGained += cfg.specials.tithePerYellow * yellows;
        if (goldGained > 0)
            notes.push(`Tithe +${goldGained}g`);
    }
    if (relic('ledger') && prism >= R.ledgerMinPrism) {
        goldGained += R.ledgerGold;
        notes.push(`Glazier's Ledger +${R.ledgerGold}g`);
    }
    const lightR = Math.max(0, Math.round(light));
    const score = lightR * prism;
    return {
        ok: true, reason: '', type: shape, colorMod, prism, light: lightR, score,
        perDie: perDie.map(p => ({ die: p.die, light: Math.round(p.light) })),
        notes, goldGained,
    };
}
// ---------- Best-hand finder (bot policy + UI hint) ----------
function pickMembers(group, k) {
    const variants = [];
    const byValue = group.slice().sort((a, b) => b.face - a.face).slice(0, k);
    variants.push(byValue);
    // color-diverse (Pedant / Spectrum)
    const seen = new Set();
    const diverse = [];
    for (const d of group.slice().sort((a, b) => b.face - a.face)) {
        const c = d.spec.color;
        if (!seen.has(c) || isSpecial(d, 'iris')) {
            diverse.push(d);
            seen.add(c);
        }
        if (diverse.length === k)
            break;
    }
    if (diverse.length === k)
        variants.push(diverse);
    // same-color (Monochrome)
    const byColor = new Map();
    for (const d of group) {
        const key = isSpecial(d, 'iris') ? '*' : d.spec.color;
        if (!byColor.has(key))
            byColor.set(key, []);
        byColor.get(key).push(d);
    }
    const irises = byColor.get('*') || [];
    byColor.forEach((v, key) => {
        if (key === '*')
            return;
        const pool = v.concat(irises);
        if (pool.length >= k)
            variants.push(pool.slice(0, k));
    });
    return variants;
}
function findBestHand(tray, ctx) {
    const candidates = [];
    const byFace = new Map();
    for (const d of tray) {
        if (!byFace.has(d.face))
            byFace.set(d.face, []);
        byFace.get(d.face).push(d);
    }
    const facesWith = (min) => Array.from(byFace.entries()).filter(([, v]) => v.length >= min).map(([f]) => f);
    // n-of-a-kind shapes
    for (const f of facesWith(6))
        for (const v of pickMembers(byFace.get(f), 6))
            candidates.push(v);
    for (const f of facesWith(5))
        for (const v of pickMembers(byFace.get(f), 5))
            candidates.push(v);
    for (const f of facesWith(4))
        for (const v of pickMembers(byFace.get(f), 4))
            candidates.push(v);
    for (const f of facesWith(3))
        for (const v of pickMembers(byFace.get(f), 3))
            candidates.push(v);
    for (const f of facesWith(2))
        for (const v of pickMembers(byFace.get(f), 2))
            candidates.push(v);
    // full house / two pair
    for (const a of facesWith(3))
        for (const b of facesWith(2)) {
            if (a === b)
                continue;
            for (const va of pickMembers(byFace.get(a), 3))
                for (const vb of pickMembers(byFace.get(b), 2))
                    candidates.push(va.concat(vb));
        }
    const pairFaces = facesWith(2);
    for (let i = 0; i < pairFaces.length; i++)
        for (let j = i + 1; j < pairFaces.length; j++) {
            for (const va of pickMembers(byFace.get(pairFaces[i]), 2))
                for (const vb of pickMembers(byFace.get(pairFaces[j]), 2))
                    candidates.push(va.concat(vb));
        }
    // straights: best-warp pick and color-diverse pick per face
    const straightFrom = (lo, len, diverse) => {
        const picked = [];
        const used = new Set();
        for (let f = lo; f < lo + len; f++) {
            const g = byFace.get(f);
            if (!g || g.length === 0)
                return null;
            let pick;
            if (diverse) {
                pick = g.find(d => !used.has(d.spec.color)) || g[0];
                used.add(pick.spec.color);
            }
            else {
                pick = g.slice().sort((a, b) => warpMult(b, ctx.warp) - warpMult(a, ctx.warp))[0];
            }
            picked.push(pick);
        }
        return picked;
    };
    for (const dv of [false, true]) {
        const s6 = straightFrom(1, 6, dv);
        if (s6)
            candidates.push(s6);
        for (const lo of [1, 2]) {
            const s = straightFrom(lo, 5, dv);
            if (s)
                candidates.push(s);
        }
        for (const lo of [1, 2, 3]) {
            const s = straightFrom(lo, 4, dv);
            if (s)
                candidates.push(s);
        }
    }
    // flushes
    for (const c of COLORS) {
        const g = tray.filter(d => d.spec.color === c || isSpecial(d, 'iris'));
        if (g.length >= 5)
            candidates.push(g.slice().sort((a, b) => b.face - a.face).slice(0, 5));
    }
    // lone dice (all, so bot can dump in round 3)
    for (const d of tray)
        candidates.push([d]);
    let best = null;
    for (const cand of candidates) {
        const ev = evaluateHand(cand, ctx);
        if (!ev.ok)
            continue;
        if (!best || ev.score > best.ev.score)
            best = { dice: cand, ev };
    }
    return best;
}
// ============================================================
// Content: Artisans (market scripts, warps, pile scoring), Specials, Relics
// Adapted from Glasswright design docs (appendices A/B/C) to the hands core.
// ============================================================
const SPECIALS = [
    { id: 'beacon', name: 'Beacon', color: 'red', rarity: 'common', desc: '+5 Light for each other die in its hand.' },
    { id: 'spark', name: 'Spark', color: 'purple', rarity: 'common', desc: 'Its hand gains +2 Prism.' },
    { id: 'tithe', name: 'Tithe', color: 'yellow', rarity: 'common', desc: 'When committed: +1 gold per yellow die in its hand.' },
    { id: 'lens', name: 'Lens', color: 'green', rarity: 'uncommon', desc: 'Other green dice in its hand gain +4 Light each.' },
    { id: 'anchor', name: 'Anchor', color: 'blue', rarity: 'uncommon', desc: 'Committed alone: +1 Light per pip still in your tray.' },
    { id: 'coffer', name: 'Coffer', color: 'yellow', rarity: 'uncommon', desc: 'When committed: +1 Light per 2 gold you hold (max +20).' },
    { id: 'iris', name: 'Iris', color: 'green', rarity: 'uncommon', desc: 'Counts as any color (flushes, Artisan rules — always in your favor).' },
    { id: 'crescendo', name: 'Crescendo', color: 'purple', rarity: 'rare', desc: 'Its hand gains +1 Prism per special-bearing hand committed earlier this encounter.' },
    { id: 'heretic', name: 'Heretic', color: 'purple', rarity: 'rare', desc: 'Its hand ignores the Artisan’s rule warp entirely. +10 Light.' },
    { id: 'quicksilver', name: 'Quicksilver', color: 'blue', rarity: 'rare', desc: 'Counts as any number when forming a hand (Light = the number it plays as).' },
    { id: 'crown', name: 'Chromatic Crown', color: 'yellow', rarity: 'rare', desc: 'If its hand holds all 5 colors: +50 Light and +2 Prism.' },
    { id: 'rose', name: 'The Rose', color: 'red', rarity: 'legendary', desc: 'Its hand gains +12 Light per unique color in the hand.' },
    // Unlockable specials
    { id: 'chime', name: 'Chime', color: 'yellow', rarity: 'uncommon', desc: 'When committed: your NEXT hand this round gains +2 Prism.' },
    { id: 'vigil', name: 'Vigil', color: 'purple', rarity: 'rare', desc: '+4 Light per encounter you have completed this run.' },
    { id: 'keystone', name: 'Keystone', color: 'blue', rarity: 'rare', desc: 'If its hand is exactly 5 dice: +25 Light.' },
];
const RELICS = [
    { id: 'burnish', name: 'Burnish', rarity: 'common', desc: '+1 Light per die in every hand you commit.' },
    { id: 'coinpress', name: 'Coin Press', rarity: 'common', desc: '+1 gold at the end of every round.' },
    { id: 'variegated', name: 'Variegated Lens', rarity: 'common', desc: '+2 Light per unique color in each committed hand.' },
    { id: 'tincture', name: 'Tincture', rarity: 'common', desc: '+4 Light per same-color pair inside each committed hand.' },
    { id: 'prismcut', name: 'Prism Cut', rarity: 'uncommon', desc: 'Hands with 4+ unique colors gain +1 Prism.' },
    { id: 'merchants', name: 'Merchant’s Brand', rarity: 'uncommon', desc: 'Everything in the shop costs 1 less gold (min 1).' },
    { id: 'reroller', name: 'Reroller’s Token', rarity: 'uncommon', desc: '+1 reroll every round.' },
    { id: 'ledger', name: 'Glazier’s Ledger', rarity: 'uncommon', desc: '+2 gold whenever you commit a hand with Prism 4 or higher.' },
    { id: 'holylight', name: 'Holy Light', rarity: 'rare', desc: 'Every hand after your first each round gains +1 Prism.' },
    { id: 'annealer', name: 'The Annealer', rarity: 'rare', desc: 'Dice carried over from last round gain +2 Light when committed.' },
    // Unlockable relics
    { id: 'lightbringer', name: 'The Light-Bringer', rarity: 'rare', desc: 'Your FIRST hand each round gains +1 Prism.' },
    { id: 'pilgrimage', name: 'Pilgrimage', rarity: 'rare', desc: 'Every hand gains +6 Light per encounter you have completed.' },
    { id: 'endowment', name: 'Patron’s Endowment', rarity: 'common', desc: '+15 gold the moment you take it.' },
];
function highestBy(market, score) {
    let bi = -1, bs = -Infinity;
    market.forEach((d, i) => { const s = score(d); if (s > bs) {
        bs = s;
        bi = i;
    } });
    return bi;
}
function pipSum(pile) { return pile.reduce((a, d) => a + d.face, 0); }
const ARTISANS = [
    {
        id: 'cardinal',
        name: 'The Cardinal in Crimson',
        flavor: 'Severe, dogmatic. Only red is sacred; everything else is vanity.',
        quip: '“Every pane that is not red is a small apostasy.”',
        warpText: 'Your red dice score DOUBLE Light. All other colors score HALF.',
        scriptText: 'Takes the highest red die; if no red, the highest pip.',
        removalText: null,
        pick(market) {
            const reds = market.map((d, i) => ({ d, i })).filter(x => x.d.spec.color === 'red');
            if (reds.length > 0) {
                reds.sort((a, b) => b.d.face - a.d.face);
                return reds[0].i;
            }
            return highestBy(market, d => d.face);
        },
        pileWarpedPips(pile) {
            return pile.reduce((a, d) => a + d.face * (d.spec.color === 'red' ? 2 : 1), 0);
        },
        pileScoreText: 'His red dice count double pips.',
    },
    {
        id: 'numerologist',
        name: 'The Numerologist',
        flavor: 'Sees divinity only in fives. Everything else is noise.',
        quip: '“Count again. The glass always counts to five.”',
        warpText: 'Hands whose face total is NOT a multiple of 5 score HALF Light.',
        scriptText: 'Takes the die that makes her pile a multiple of 5; else the highest pip.',
        removalText: null,
        pick(market, pile) {
            const pips = pile.reduce((a, d) => a + d.face, 0);
            const fits = market.map((d, i) => ({ d, i })).filter(x => (pips + x.d.face) % 5 === 0);
            if (fits.length > 0) {
                fits.sort((a, b) => b.d.face - a.d.face);
                return fits[0].i;
            }
            return highestBy(market, d => d.face);
        },
        pileWarpedPips(pile) {
            const pips = pile.reduce((a, d) => a + d.face, 0);
            return pips % 5 === 0 ? Math.round(pips * 1.5) : pips;
        },
        pileScoreText: 'Her pile counts ×1.5 while its total divides by 5.',
    },
    {
        id: 'pedant',
        name: 'The Pedant',
        flavor: 'Corrects everyone. Repetition of color is, to him, an error.',
        quip: '“You have made this mistake before. I keep a list.”',
        warpText: 'Hands may NOT contain two dice of the same color.',
        scriptText: 'Takes the highest die of a color missing from his pile; else the highest pip.',
        removalText: 'Strikes one market die that duplicates another’s number ("a typo").',
        pick(market, pile) {
            const owned = new Set(pile.map(d => d.spec.color));
            const fresh = market.map((d, i) => ({ d, i })).filter(x => !owned.has(x.d.spec.color));
            if (fresh.length > 0) {
                fresh.sort((a, b) => b.d.face - a.d.face);
                return fresh[0].i;
            }
            return highestBy(market, d => d.face);
        },
        removal(market) {
            const counts = new Map();
            for (const d of market)
                counts.set(d.face, (counts.get(d.face) || 0) + 1);
            let bi = -1, bf = 0;
            market.forEach((d, i) => {
                if ((counts.get(d.face) || 0) >= 2 && d.face > bf) {
                    bf = d.face;
                    bi = i;
                }
            });
            return bi;
        },
        pileWarpedPips(pile) {
            const colors = new Set(pile.map(d => d.spec.color)).size;
            return pile.reduce((a, d) => a + d.face, 0) + 2 * colors;
        },
        pileScoreText: 'His pile gains +2 pips per distinct color he holds.',
    },
    {
        id: 'triad',
        name: 'The Triad',
        flavor: 'Three masked judges. They bless three colors; the rest are refuse.',
        quip: '“Three voices. One verdict. Choose your colors well.”',
        warpText: 'Two colors are UNBLESSED this encounter: they score HALF Light.',
        scriptText: 'Takes the highest blessed die; else the highest pip.',
        removalText: 'Purges the highest UNBLESSED die from the market.',
        pick(market, _pile, blessed) {
            const b = market.map((d, i) => ({ d, i })).filter(x => blessed.indexOf(x.d.spec.color) >= 0);
            if (b.length > 0) {
                b.sort((a, b2) => b2.d.face - a.d.face);
                return b[0].i;
            }
            return highestBy(market, d => d.face);
        },
        removal(market, blessed) {
            let bi = -1, bf = 0;
            market.forEach((d, i) => {
                if (blessed.indexOf(d.spec.color) < 0 && d.face > bf) {
                    bf = d.face;
                    bi = i;
                }
            });
            return bi;
        },
        pileWarpedPips(pile, blessed) {
            return Math.round(pile.reduce((a, d) => a + d.face * (blessed.indexOf(d.spec.color) >= 0 ? 1.5 : 1), 0));
        },
        pileScoreText: 'Their blessed dice count ×1.5 pips.',
    },
    // ---------- Unlockable Greater Artisans ----------
    {
        id: 'architect',
        name: 'The Brass Architect',
        flavor: 'Ruler-and-compass perfectionist. Believes geometry is divinity.',
        quip: '“Symmetry, child. Even numbers or nothing.”',
        warpText: 'Every hand must contain at least one EVEN face.',
        scriptText: 'Takes the highest even die; else the highest pip.',
        removalText: 'Strikes the lowest ODD market die ("imprecision").',
        pick(market) {
            const evens = market.map((d, i) => ({ d, i })).filter(x => x.d.face % 2 === 0);
            if (evens.length > 0) {
                evens.sort((a, b) => b.d.face - a.d.face);
                return evens[0].i;
            }
            return highestBy(market, d => d.face);
        },
        removal(market) {
            let bi = -1, bf = 7;
            market.forEach((d, i) => { if (d.face % 2 === 1 && d.face < bf) {
                bf = d.face;
                bi = i;
            } });
            return bi;
        },
        pileWarpedPips(pile) { return pipSum(pile) + 3 * pile.filter(d => d.face % 2 === 0).length; },
        pileScoreText: 'His even dice earn +3 pips each.',
    },
    {
        id: 'widow',
        name: 'The Glassmaker’s Widow',
        flavor: 'Cold-eyed merchant. Counts every coin. Wears black.',
        quip: '“Take what you like from the market, dear. I bill by the die.”',
        warpText: 'Every market die you draft costs 1 gold (she pockets it). Her pile grows with YOUR wealth.',
        scriptText: 'Takes the highest pip. Money prefers certainty.',
        removalText: null,
        pick(market) { return highestBy(market, d => d.face); },
        pileWarpedPips(pile, _b, ctx) { return Math.round(pipSum(pile) * (1 + ctx.gold / 55)); },
        pileScoreText: 'Her pile scales ×(1 + your gold ÷ 55).',
    },
    {
        id: 'timekeeper',
        name: 'The Time-Keeper',
        flavor: 'Old, patient, methodical. Nothing worthy is rushed.',
        quip: '“One grain at a time. You may have ONE.”',
        warpText: 'You may draft only ONE market die per round. He still takes two.',
        scriptText: 'Takes the highest pip, unhurried.',
        removalText: null,
        playerPicks: 1,
        pick(market) { return highestBy(market, d => d.face); },
        pileWarpedPips(pile) { return Math.round(pipSum(pile) * 1.35); },
        pileScoreText: 'Patience: his pile counts ×1.35.',
    },
    {
        id: 'echochoir',
        name: 'The Echo Choir',
        flavor: 'Twin sisters who never speak. They finish each other’s work.',
        quip: 'The sisters say nothing. The glass hums back everything you do.',
        warpText: 'Every SPECIAL die you commit echoes: +5 pips to their pile.',
        scriptText: 'Take the highest pip, in unison.',
        removalText: null,
        pick(market) { return highestBy(market, d => d.face); },
        pileWarpedPips(pile, _b, ctx) { return pipSum(pile) + ctx.echoPips; },
        pileScoreText: 'Their pile holds every echo (+5 pips per special you commit).',
    },
    {
        id: 'hereticsaint',
        name: 'The Heretic Saint',
        flavor: 'Rule-breaker turned martyr. Mocks discipline. Smiles wickedly.',
        quip: '“No rules today, glasswright. Only the race. Try to keep up.”',
        warpText: 'NO warp — and every hand you commit gains +1 Prism. But her pile burns twice as hot.',
        scriptText: 'Takes the highest pip, laughing.',
        removalText: null,
        pick(market) { return highestBy(market, d => d.face); },
        pileWarpedPips(pile) { return Math.round(pipSum(pile) * 1.95); },
        pileScoreText: 'Her pile counts ×1.95.',
    },
    {
        id: 'modulist',
        name: 'The Modulist',
        flavor: 'Sees the world in twos. Odd numbers are... unresolved.',
        quip: '“One, three, five — unfinished thoughts. Bring me twos.”',
        warpText: 'ODD faces score HALF Light.',
        scriptText: 'Takes the highest even die; else the highest pip.',
        removalText: null,
        pick(market) {
            const evens = market.map((d, i) => ({ d, i })).filter(x => x.d.face % 2 === 0);
            if (evens.length > 0) {
                evens.sort((a, b) => b.d.face - a.d.face);
                return evens[0].i;
            }
            return highestBy(market, d => d.face);
        },
        pileWarpedPips(pile) {
            return Math.round(pile.reduce((a, d) => a + d.face * (d.face % 2 === 0 ? 1.6 : 1), 0));
        },
        pileScoreText: 'His even dice count ×1.6 pips.',
    },
    {
        id: 'statistician',
        name: 'The Statistician',
        flavor: 'Dry as vellum. Repetition is noise, not signal.',
        quip: '“Pairs? Triples? Regression to the mean, all of it.”',
        warpText: 'Matched-set hands (pairs, trips, full houses…) lose 1 Prism. Straights are exempt.',
        scriptText: 'Takes the highest pip. The data is clear.',
        removalText: null,
        pick(market) { return highestBy(market, d => d.face); },
        pileWarpedPips(pile) {
            const distinct = new Set(pile.map(d => d.face)).size;
            return pipSum(pile) + 3 * distinct;
        },
        pileScoreText: 'His pile earns +3 pips per distinct face (he values variety).',
    },
    {
        id: 'iconographer',
        name: 'The Iconographer',
        flavor: 'Sees god in variety. Every color is a prayer; omit none.',
        quip: '“Show me all five, or show me nothing.”',
        warpText: 'Hands of 3+ dice using fewer than 3 colors score ¾ Light.',
        scriptText: 'Takes the highest die of a color missing from his pile.',
        removalText: null,
        pick(market, pile) {
            const owned = new Set(pile.map(d => d.spec.color));
            const fresh = market.map((d, i) => ({ d, i })).filter(x => !owned.has(x.d.spec.color));
            if (fresh.length > 0) {
                fresh.sort((a, b) => b.d.face - a.d.face);
                return fresh[0].i;
            }
            return highestBy(market, d => d.face);
        },
        pileWarpedPips(pile) {
            const colors = new Set(pile.map(d => d.spec.color)).size;
            return Math.round(pipSum(pile) * (colors >= 4 ? 1.45 : 1.1));
        },
        pileScoreText: 'His pile counts ×1.1, or ×1.45 once he holds 4+ colors.',
    },
    {
        id: 'apprentice',
        name: 'The Apprentice',
        flavor: 'Young, eager, lucky. Sometimes brilliant, sometimes foolish.',
        quip: '“Master says I’m ready! I borrowed one of their rules. Probably correctly.”',
        warpText: 'Mimics a random master’s warp each encounter (shown below).',
        scriptText: 'Picks on gut feeling (randomly).',
        removalText: null,
        mimic: true,
        pick(market, _p, _b, rng) { return rng ? rng.int(market.length) : 0; },
        pileWarpedPips(pile) { return Math.round(pipSum(pile) * 0.9); },
        pileScoreText: 'Green: her pile counts only ×0.9.',
    },
];
// Warps the Apprentice can borrow (simple per-die / hand-level ones)
const APPRENTICE_MIMIC_POOL = ['cardinal', 'numerologist', 'pedant', 'triad', 'modulist', 'architect', 'iconographer'];
// Always available from the first run; the rest come from the unlock ladder (meta.ts)
const BASE_ARTISAN_IDS = ['cardinal', 'numerologist', 'pedant', 'triad'];
const ICONOCLAST = {
    id: 'iconoclast',
    name: 'The Iconoclast',
    flavor: 'The Reformer. He shatters what you made and weighs the shards you abandon.',
    quip: '“You made six beautiful things. Watch.”',
};
// ============================================================
// Meta-progression: persistent unlocks (localStorage, browser only).
// Rungs climb with wins (1 per win) and persistence (1 per 4 runs).
// The sim ignores all of this; tuning always uses the base roster.
// ============================================================
const UNLOCK_LADDER = [
    { kind: 'artisan', id: 'architect', label: 'The Brass Architect (artisan)' },
    { kind: 'special', id: 'chime', label: 'Chime (die)' },
    { kind: 'artisan', id: 'widow', label: 'The Glassmaker’s Widow (artisan)' },
    { kind: 'relic', id: 'lightbringer', label: 'The Light-Bringer (relic)' },
    { kind: 'artisan', id: 'timekeeper', label: 'The Time-Keeper (artisan)' },
    { kind: 'special', id: 'vigil', label: 'Vigil (die)' },
    { kind: 'artisan', id: 'echochoir', label: 'The Echo Choir (artisan)' },
    { kind: 'relic', id: 'pilgrimage', label: 'Pilgrimage (relic)' },
    { kind: 'artisan', id: 'hereticsaint', label: 'The Heretic Saint (artisan)' },
    { kind: 'special', id: 'keystone', label: 'Keystone (die)' },
    { kind: 'artisan', id: 'modulist', label: 'The Modulist (artisan)' },
    { kind: 'relic', id: 'endowment', label: 'Patron’s Endowment (relic)' },
    { kind: 'artisan', id: 'statistician', label: 'The Statistician (artisan)' },
    { kind: 'artisan', id: 'iconographer', label: 'The Iconographer (artisan)' },
    { kind: 'artisan', id: 'apprentice', label: 'The Apprentice (artisan)' },
];
const META_KEY = 'glasswright-meta';
function metaLoad() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(META_KEY);
            if (raw) {
                const m = JSON.parse(raw);
                return { runs: m.runs | 0, wins: m.wins | 0 };
            }
        }
    }
    catch { /* private mode etc. */ }
    return { runs: 0, wins: 0 };
}
function metaSave(m) {
    try {
        if (typeof localStorage !== 'undefined')
            localStorage.setItem(META_KEY, JSON.stringify(m));
    }
    catch { /* ignore */ }
}
function metaRungs(m) {
    return m.wins + Math.floor(m.runs / 4);
}
function metaUnlocked(m) {
    return UNLOCK_LADDER.slice(0, Math.min(UNLOCK_LADDER.length, metaRungs(m)));
}
function metaNext(m) {
    const r = metaRungs(m);
    return r < UNLOCK_LADDER.length ? UNLOCK_LADDER[r] : null;
}
function metaUnlockedIds(m, kind) {
    return metaUnlocked(m).filter(u => u.kind === kind).map(u => u.id);
}
// Record a finished run; returns anything newly unlocked (for the end-screen toast).
function metaRecordRun(m, won) {
    const before = metaRungs(m);
    m.runs++;
    if (won)
        m.wins++;
    metaSave(m);
    const after = metaRungs(m);
    return UNLOCK_LADDER.slice(Math.min(before, UNLOCK_LADDER.length), Math.min(after, UNLOCK_LADDER.length));
}
// ============================================================
// Artisan portraits — hand-built stained-glass SVGs.
// Shared visual language: gothic arch, faceted glass, heavy lead lines.
// ============================================================
const LEAD = '#141721'; // lead came color
const SW = 2.5; // lead line width
function svgFrame(inner, glowColor) {
    return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g stroke="${LEAD}" stroke-width="${SW}" stroke-linejoin="round">
    ${inner}
  </g>
  <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="url(#glow)" stroke="${LEAD}" stroke-width="5"/>
</svg>`;
}
const ARTISAN_ART = {
    // Severe red churchman: tall mitre with gold cross, gaunt pale face, crimson robes.
    cardinal: svgFrame(`
    <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="#3a0f16"/>
    <polygon points="8,56 40,80 8,110" fill="#571622"/>
    <polygon points="112,56 82,84 112,116" fill="#571622"/>
    <polygon points="20,14 48,30 8,56" fill="#4a121c"/>
    <polygon points="100,14 74,32 112,56" fill="#4a121c"/>
    <polygon points="60,10 44,52 76,52" fill="#a41f2b"/>
    <polygon points="44,52 76,52 80,62 40,62" fill="#c8a028"/>
    <rect x="57" y="22" width="6" height="18" fill="#e8c85a"/>
    <rect x="51" y="27" width="18" height="6" fill="#e8c85a"/>
    <polygon points="44,62 76,62 74,92 60,100 46,92" fill="#e8cdb0"/>
    <polyline points="48,74 57,74" fill="none" stroke-width="3"/>
    <polyline points="63,74 72,74" fill="none" stroke-width="3"/>
    <polyline points="52,90 68,90" fill="none" stroke-width="3"/>
    <polygon points="30,134 44,96 60,104 76,96 90,134" fill="#a41f2b"/>
    <polygon points="52,106 68,106 66,134 54,134" fill="#7d1620"/>
    <polygon points="30,134 44,96 50,102 40,134" fill="#c0392b"/>
    <polygon points="90,134 76,96 70,102 80,134" fill="#c0392b"/>
  `, '#ff5c47'),
    // Hooded numerologist: shadowed face, glowing eyes, brass spectacles, floating 5s.
    numerologist: svgFrame(`
    <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="#191d3a"/>
    <polygon points="8,60 36,86 8,118" fill="#232a52"/>
    <polygon points="112,60 86,88 112,120" fill="#232a52"/>
    <polygon points="24,16 52,28 12,58" fill="#20264a"/>
    <polygon points="96,16 70,30 108,58" fill="#20264a"/>
    <path d="M60 24 Q30 34 34 84 L46 134 L74 134 L86 84 Q90 34 60 24 Z" fill="#3a2f63"/>
    <path d="M60 36 Q44 42 46 76 L60 92 L74 76 Q76 42 60 36 Z" fill="#120e22"/>
    <circle cx="52" cy="62" r="7" fill="none" stroke="#c8a028" stroke-width="2.5"/>
    <circle cx="70" cy="62" r="7" fill="none" stroke="#c8a028" stroke-width="2.5"/>
    <line x1="59" y1="62" x2="63" y2="62" stroke="#c8a028" stroke-width="2.5"/>
    <circle cx="52" cy="62" r="2.6" fill="#bfe0ff" stroke="none"/>
    <circle cx="70" cy="62" r="2.6" fill="#bfe0ff" stroke="none"/>
    <text x="22" y="42" font-size="15" fill="#8fa4ff" stroke="none" font-family="Georgia,serif" font-weight="bold">5</text>
    <text x="90" y="50" font-size="12" fill="#8fa4ff" stroke="none" font-family="Georgia,serif" font-weight="bold">5</text>
    <text x="86" y="112" font-size="17" fill="#6c7fd8" stroke="none" font-family="Georgia,serif" font-weight="bold">5</text>
    <polygon points="18,96 26,90 34,96 31,105 21,105" fill="none" stroke="#6c7fd8" stroke-width="2"/>
  `, '#7c8fff'),
    // The Pedant: long pale face, monocle and chain, high collar, raised correcting finger.
    pedant: svgFrame(`
    <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="#3c3627"/>
    <polygon points="8,56 38,82 8,112" fill="#4d452f"/>
    <polygon points="112,56 84,84 112,114" fill="#4d452f"/>
    <polygon points="22,16 50,28 10,58" fill="#453e2b"/>
    <polygon points="98,16 72,30 110,58" fill="#453e2b"/>
    <polygon points="46,26 74,26 78,44 42,44" fill="#57503b"/>
    <polygon points="46,44 74,44 72,84 60,94 48,84" fill="#e6d9c2"/>
    <polyline points="50,58 58,58" fill="none" stroke-width="3"/>
    <circle cx="66" cy="58" r="8" fill="#f4ecd8" stroke="#c8a028" stroke-width="2.5"/>
    <circle cx="66" cy="58" r="2.4" fill="${LEAD}" stroke="none"/>
    <path d="M72 64 Q84 76 80 92" fill="none" stroke="#c8a028" stroke-width="1.8"/>
    <polyline points="54,82 66,82" fill="none" stroke-width="2.5"/>
    <polygon points="34,134 48,92 60,98 72,92 86,134" fill="#57503b"/>
    <polygon points="54,98 66,98 64,134 56,134" fill="#2e2a1e"/>
    <polygon points="86,108 94,72 100,74 94,110" fill="#e6d9c2"/>
    <polygon points="92,66 98,58 102,62 98,74 92,72" fill="#e6d9c2"/>
    <path d="M20 128 L34 96 L38 100 L26 130 Z" fill="#d8d2c0"/>
    <path d="M18 132 L22 124 L26 128 Z" fill="#8a836c"/>
  `, '#e0d5a8'),
    // The Triad: three judges' masks — gold, silver, bronze — over deep teal glass.
    triad: svgFrame(`
    <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="#12302e"/>
    <polygon points="8,58 36,84 8,116" fill="#1a4341"/>
    <polygon points="112,58 86,86 112,118" fill="#1a4341"/>
    <polygon points="26,14 56,26 12,60" fill="#173a38"/>
    <polygon points="94,14 66,28 108,60" fill="#173a38"/>
    <path d="M24 58 Q24 42 38 42 Q52 42 52 58 Q52 76 38 82 Q24 76 24 58 Z" fill="#b9c2cc"/>
    <polyline points="30,58 36,58" fill="none" stroke-width="3.5"/>
    <polyline points="41,58 47,58" fill="none" stroke-width="3.5"/>
    <path d="M33 70 Q38 66 43 70" fill="none" stroke-width="2.5"/>
    <path d="M68 58 Q68 42 82 42 Q96 42 96 58 Q96 76 82 82 Q68 76 68 58 Z" fill="#b0713a"/>
    <polyline points="74,58 80,58" fill="none" stroke-width="3.5"/>
    <polyline points="85,58 91,58" fill="none" stroke-width="3.5"/>
    <path d="M77 68 Q82 73 87 68" fill="none" stroke-width="2.5"/>
    <path d="M42 84 Q42 62 60 62 Q78 62 78 84 Q78 108 60 116 Q42 108 42 84 Z" fill="#d4a017"/>
    <polyline points="49,82 57,82" fill="none" stroke-width="4"/>
    <polyline points="63,82 71,82" fill="none" stroke-width="4"/>
    <polyline points="53,98 67,98" fill="none" stroke-width="3"/>
    <polygon points="20,134 60,120 100,134" fill="#0d2422"/>
  `, '#3fd6c0'),
    // The Iconoclast: black-iron hood, void face, warhammer, shattered red glass at his feet.
    iconoclast: svgFrame(`
    <path d="M8 134 L8 56 Q8 12 60 8 Q112 12 112 56 L112 134 Z" fill="#15171f"/>
    <polygon points="8,58 34,86 8,118" fill="#1d2029"/>
    <polygon points="112,58 88,88 112,120" fill="#1d2029"/>
    <polygon points="26,14 56,24 12,58" fill="#191c25"/>
    <polygon points="94,14 66,26 108,58" fill="#191c25"/>
    <path d="M60 20 Q32 30 36 78 L48 96 L72 96 L84 78 Q88 30 60 20 Z" fill="#272b38"/>
    <path d="M60 32 Q46 38 48 70 L60 82 L72 70 Q74 38 60 32 Z" fill="#07080d"/>
    <polyline points="51,58 58,56" fill="none" stroke="#9fb4cc" stroke-width="2.5"/>
    <polyline points="62,56 69,58" fill="none" stroke="#9fb4cc" stroke-width="2.5"/>
    <polygon points="36,134 48,98 60,104 72,98 84,134" fill="#20242e"/>
    <rect x="24" y="52" width="8" height="74" fill="#5c4d3a" transform="rotate(-18 28 89)"/>
    <polygon points="6,44 44,32 48,52 10,64" fill="#8f98a6"/>
    <polygon points="6,44 44,32 42,26 10,38" fill="#6e7684"/>
    <polygon points="86,120 96,104 100,122" fill="#a41f2b"/>
    <polygon points="98,126 108,112 110,130" fill="#c0392b"/>
    <polygon points="90,130 98,126 96,134 88,134" fill="#7d1620"/>
    <polygon points="14,122 22,112 26,126 16,130" fill="#a41f2b"/>
  `, '#8fa8c8'),
};
// ============================================================
// Audio — all WebAudio-synthesized: SFX + a soft generative organ pad.
// Starts on first user gesture (autoplay policy). Toggleable in the topbar.
// ============================================================
const AUDIO = {
    ctx: null, master: null, musicBus: null,
    sfxOn: true, musicOn: true, started: false, musicTimer: null, chordIdx: 0,
};
function audioEnsure() {
    if (AUDIO.started)
        return;
    AUDIO.started = true;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        AUDIO.ctx = new AC();
        AUDIO.master = AUDIO.ctx.createGain();
        AUDIO.master.gain.value = 0.5;
        AUDIO.master.connect(AUDIO.ctx.destination);
        AUDIO.musicBus = AUDIO.ctx.createGain();
        AUDIO.musicBus.gain.value = AUDIO.musicOn ? 1 : 0;
        AUDIO.musicBus.connect(AUDIO.master);
        if (AUDIO.musicOn)
            musicStart();
    }
    catch {
        AUDIO.ctx = null;
    }
}
function tone(freq, dur, opts = {}) {
    if (!AUDIO.ctx || !AUDIO.master)
        return;
    const c = AUDIO.ctx;
    const t0 = c.currentTime + (opts.when || 0);
    const osc = c.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo)
        osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
    const g = c.createGain();
    const v = opts.vol !== undefined ? opts.vol : 0.15;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    g.connect(opts.bus || AUDIO.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}
function noiseBurst(dur, vol, filterFreq, when = 0) {
    if (!AUDIO.ctx || !AUDIO.master)
        return;
    const c = AUDIO.ctx;
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(AUDIO.master);
    src.start(t0);
}
// ---------- SFX ----------
function sfxRoll(count) {
    if (!AUDIO.sfxOn)
        return;
    const bursts = Math.min(7, 3 + Math.floor(count / 4));
    for (let i = 0; i < bursts; i++)
        noiseBurst(0.06, 0.20, 900 + Math.random() * 1500, i * 0.07 + Math.random() * 0.03);
}
function sfxSettle(i) {
    if (!AUDIO.sfxOn)
        return;
    tone(650 + Math.random() * 500, 0.05, { type: 'triangle', vol: 0.05 });
}
function sfxPick() {
    if (!AUDIO.sfxOn)
        return;
    tone(520, 0.09, { type: 'triangle', vol: 0.12 });
    tone(780, 0.09, { type: 'triangle', vol: 0.08, when: 0.05 });
}
function sfxTake() {
    if (!AUDIO.sfxOn)
        return;
    tone(150, 0.22, { type: 'sawtooth', vol: 0.10, glideTo: 95 });
}
function sfxStrike() {
    if (!AUDIO.sfxOn)
        return;
    noiseBurst(0.12, 0.28, 2600);
    tone(300, 0.25, { type: 'square', vol: 0.07, glideTo: 90 });
}
function sfxCommit(prism, score) {
    if (!AUDIO.sfxOn)
        return;
    const steps = Math.min(8, 1 + prism);
    for (let i = 0; i < steps; i++) {
        tone(392 * Math.pow(1.1892, i), 0.16, { type: 'triangle', vol: 0.10, when: i * 0.06 });
    }
    if (score >= 200) { // big hand: bell on top
        tone(1568, 1.1, { type: 'sine', vol: 0.10, when: steps * 0.06 });
        tone(2093, 0.9, { type: 'sine', vol: 0.06, when: steps * 0.06 + 0.03 });
    }
}
function sfxGold() {
    if (!AUDIO.sfxOn)
        return;
    tone(1319, 0.10, { type: 'sine', vol: 0.09 });
    tone(1760, 0.14, { type: 'sine', vol: 0.09, when: 0.06 });
}
function sfxSmash() {
    if (!AUDIO.sfxOn)
        return;
    noiseBurst(0.28, 0.34, 3400);
    noiseBurst(0.18, 0.22, 5200, 0.04);
    tone(220, 0.4, { type: 'sawtooth', vol: 0.09, glideTo: 60 });
    for (let i = 0; i < 5; i++)
        tone(2200 + Math.random() * 2400, 0.22, { type: 'sine', vol: 0.035, when: 0.05 + i * 0.045 });
}
function sfxWin() {
    if (!AUDIO.sfxOn)
        return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.12, when: i * 0.16 }));
    tone(1568, 1.8, { type: 'sine', vol: 0.08, when: 0.7 });
}
function sfxLoss() {
    if (!AUDIO.sfxOn)
        return;
    tone(196, 1.6, { type: 'sawtooth', vol: 0.09, glideTo: 92 });
    tone(233, 1.6, { type: 'sawtooth', vol: 0.07, when: 0.1, glideTo: 110 });
}
// ---------- Music: slow modal organ pad, D-minor-ish, chord every 8s ----------
const PAD_CHORDS = [
    [73.42, 146.83, 220.00, 293.66], // D
    [58.27, 116.54, 174.61, 233.08], // Bb
    [65.41, 130.81, 196.00, 261.63], // C
    [55.00, 110.00, 164.81, 220.00], // A
];
function padNote(freq, dur) {
    if (!AUDIO.ctx || !AUDIO.musicBus)
        return;
    const c = AUDIO.ctx;
    const t0 = c.currentTime;
    for (const det of [-1.5, 1.5]) {
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = det;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.028, t0 + 2.4);
        g.gain.setValueAtTime(0.028, t0 + dur - 3);
        g.gain.linearRampToValueAtTime(0, t0 + dur);
        osc.connect(f);
        f.connect(g);
        g.connect(AUDIO.musicBus);
        osc.start(t0);
        osc.stop(t0 + dur + 0.1);
    }
}
function musicTick() {
    const chord = PAD_CHORDS[AUDIO.chordIdx % PAD_CHORDS.length];
    AUDIO.chordIdx++;
    for (const f of chord)
        padNote(f, 9.5);
    if (AUDIO.chordIdx % 2 === 0) { // distant bell
        tone(chord[3] * 4, 3.5, { type: 'sine', vol: 0.018, when: 3.5, bus: AUDIO.musicBus });
    }
}
function musicStart() {
    if (!AUDIO.ctx || AUDIO.musicTimer !== null)
        return;
    musicTick();
    AUDIO.musicTimer = setInterval(musicTick, 8000);
}
function musicStop() {
    if (AUDIO.musicTimer !== null) {
        clearInterval(AUDIO.musicTimer);
        AUDIO.musicTimer = null;
    }
}
function toggleSfx() { AUDIO.sfxOn = !AUDIO.sfxOn; }
function toggleMusic() {
    AUDIO.musicOn = !AUDIO.musicOn;
    if (AUDIO.musicBus)
        AUDIO.musicBus.gain.value = AUDIO.musicOn ? 1 : 0;
    if (AUDIO.musicOn)
        musicStart();
    else
        musicStop();
}
// ============================================================
// Run engine — pure state machine shared by browser UI and headless sim.
// UI/bot call methods; methods return rich results for animation.
// ============================================================
class GWRun {
    constructor(seed, cfgPatch, opts) {
        this.screen = 'encounter';
        this.encounterIdx = 0;
        this.ownedDice = [];
        this.relics = [];
        this.nextDieId = 1;
        this.enc = null;
        this.tribute = null;
        this.shop = null;
        this.finale = null;
        this.committedHistory = [];
        this.result = null;
        this.lossReason = '';
        this.stats = { biggestHand: null, encounterResults: [], handsCommitted: 0, goldEarned: 0 };
        this.seed = seed;
        this.rng = new RNG(seed);
        this.cfg = JSON.parse(JSON.stringify(CONFIG));
        if (cfgPatch)
            deepMerge(this.cfg, cfgPatch);
        this.gold = this.cfg.gold.start;
        for (const c of COLORS) {
            for (let i = 0; i < this.cfg.startingBag.perColor; i++) {
                this.ownedDice.push({ id: this.nextDieId++, color: c, specialId: null });
            }
        }
        const ladder = typeof UNLOCK_LADDER !== 'undefined' ? UNLOCK_LADDER : [];
        const ladderIds = (kind) => ladder.filter(u => u.kind === kind).map(u => u.id);
        const poolIds = (opts && opts.artisanPool) || BASE_ARTISAN_IDS;
        const pool = ARTISANS.filter(a => poolIds.indexOf(a.id) >= 0);
        this.artisanOrder = this.rng.shuffle(pool).slice(0, this.cfg.encounters - 1);
        this.allowedSpecials = (opts && opts.specialPool)
            || SPECIALS.map(s => s.id).filter(id => ladderIds('special').indexOf(id) < 0);
        this.allowedRelics = (opts && opts.relicPool)
            || RELICS.map(r => r.id).filter(id => ladderIds('relic').indexOf(id) < 0);
        this.startEncounter();
    }
    // ---------- Encounter lifecycle ----------
    startEncounter() {
        const artisan = this.artisanOrder[this.encounterIdx];
        const blessed = this.rng.shuffle(COLORS).slice(0, 3);
        const mimic = artisan.mimic ? this.rng.pick(APPRENTICE_MIMIC_POOL) : null;
        this.enc = {
            artisan, blessed, round: 0, phase: 'draft', tray: [], market: [],
            removedDie: null, removalPending: false, removalIdx: -1,
            draftTurn: 'player', playerPicksLeft: 0, artisanPicksLeft: 0, telegraphIdx: -1,
            rerollsLeft: 0, playerScore: 0, pile: [], artisanScore: 0,
            handsThisRound: 0, specialHandsThisEncounter: 0, lastRolledIds: [],
            echoPips: 0, chimeNext: 0, apprenticeWarpId: mimic,
        };
        this.screen = 'encounter';
        this.startRound();
    }
    // Effective warp id (the Apprentice mimics another master's warp)
    effectiveWarpId() {
        const e = this.enc;
        return e.apprenticeWarpId || e.artisan.id;
    }
    startRound() {
        const e = this.enc;
        e.round++;
        e.handsThisRound = 0;
        e.chimeNext = 0;
        // Carry rule: uncommitted dice keep their faces between rounds
        const rolled = [];
        for (const d of e.tray)
            d.carried = true;
        // Round 1: the whole bag rolls into the tray
        if (e.round === 1) {
            for (const spec of this.ownedDice) {
                e.tray.push({ spec, face: this.rng.d6(), carried: false, fromMarket: false });
                rolled.push(spec.id);
            }
        }
        // Market rolls (one extra die if this artisan strikes one)
        const size = this.cfg.marketSize + (e.artisan.removal ? 1 : 0);
        e.market = [];
        for (let i = 0; i < size; i++) {
            e.market.push({
                spec: { id: this.nextDieId++, color: this.rng.pick(COLORS), specialId: null },
                face: this.rng.d6(), carried: false, fromMarket: true,
            });
            rolled.push(e.market[e.market.length - 1].spec.id);
        }
        e.lastRolledIds = rolled;
        // Telegraph the removal (executes when the draft begins)
        e.removedDie = null;
        e.removalIdx = e.artisan.removal ? e.artisan.removal(e.market, e.blessed) : -1;
        e.removalPending = e.removalIdx >= 0;
        e.phase = 'draft';
        e.draftTurn = 'player';
        e.playerPicksLeft = e.artisan.playerPicks !== undefined ? e.artisan.playerPicks : this.cfg.draftPicksPerSide;
        e.artisanPicksLeft = this.cfg.draftPicksPerSide;
        e.rerollsLeft = this.cfg.rerollsPerRound + (this.relics.indexOf('reroller') >= 0 ? this.cfg.relics.rerollerBonus : 0);
        // Telegraph first: the strike lands when drafting begins (UI animates it; bot triggers it)
        if (!e.removalPending)
            this.updateTelegraph();
        else
            e.telegraphIdx = -1;
    }
    executeRemoval() {
        const e = this.enc;
        if (e.removalPending && e.removalIdx >= 0) {
            e.removedDie = e.market.splice(e.removalIdx, 1)[0];
            e.removalPending = false;
            e.removalIdx = -1;
            this.updateTelegraph();
            return e.removedDie;
        }
        return null;
    }
    updateTelegraph() {
        const e = this.enc;
        e.telegraphIdx = (e.artisanPicksLeft > 0 && e.market.length > 0)
            ? e.artisan.pick(e.market, e.pile, e.blessed, this.rng) : -1;
    }
    artisanTakeOne() {
        const e = this.enc;
        if (e.artisanPicksLeft <= 0 || e.market.length === 0)
            return null;
        this.updateTelegraph();
        const took = e.market.splice(e.telegraphIdx, 1)[0];
        e.pile.push(took);
        e.artisanPicksLeft--;
        this.refreshArtisanScore();
        return took;
    }
    // Player drafts market die i. The artisan follows up; if the player is out of
    // picks (Time-Keeper), the artisan takes ALL their remaining picks.
    draftPick(i) {
        const e = this.enc;
        if (e.phase !== 'draft' || e.draftTurn !== 'player' || e.playerPicksLeft <= 0)
            throw new Error('bad draft');
        if (e.removalPending)
            this.executeRemoval(); // safety: the strike always lands before picks
        const taken = e.market.splice(i, 1)[0];
        e.tray.push(taken);
        e.playerPicksLeft--;
        // The Widow charges for every draft
        if (e.artisan.id === 'widow' && this.gold > 0)
            this.gold--;
        const artisanTook = [];
        const t1 = this.artisanTakeOne();
        if (t1)
            artisanTook.push(t1);
        while (e.playerPicksLeft <= 0 && e.artisanPicksLeft > 0 && e.market.length > 0) {
            const t = this.artisanTakeOne();
            if (t)
                artisanTook.push(t);
            else
                break;
        }
        this.updateTelegraph();
        if (e.playerPicksLeft <= 0 || e.market.length === 0) {
            e.phase = 'reroll';
        }
        return { taken, artisanTook };
    }
    refreshArtisanScore() {
        const e = this.enc;
        const accrual = this.cfg.artisanAccrual[Math.min(this.encounterIdx, this.cfg.artisanAccrual.length - 1)];
        const pileCtx = { gold: this.gold, echoPips: e.echoPips };
        e.artisanScore = Math.round(e.artisan.pileWarpedPips(e.pile, e.blessed, pileCtx) * accrual);
    }
    evalCtx(selected) {
        const e = this.enc;
        const inFinale = this.screen === 'finale';
        const tray = inFinale ? this.finale.finalTray : e.tray;
        const rest = tray.filter(d => selected.indexOf(d) < 0).reduce((a, d) => a + d.face, 0);
        return {
            warp: inFinale
                ? { artisanId: null, blessedColors: [] }
                : { artisanId: this.effectiveWarpId(), blessedColors: e.blessed },
            relics: this.relics,
            gold: this.gold,
            priorSpecialHandsThisEncounter: inFinale ? this.finale.specialHands : e.specialHandsThisEncounter,
            handsCommittedThisRound: inFinale ? this.finale.handsThisRound : e.handsThisRound,
            trayRestPips: rest,
            pendingChimePrism: inFinale ? 0 : e.chimeNext,
            encountersCompleted: this.encounterIdx,
            cfg: this.cfg,
        };
    }
    reroll(dice) {
        const e = this.enc;
        if ((e.phase !== 'reroll' && e.phase !== 'commit') || e.rerollsLeft <= 0 || dice.length === 0)
            throw new Error('bad reroll');
        for (const d of dice) {
            d.face = this.rng.d6();
            d.carried = false; // a rerolled die is no longer "carried glass" (DECISIONS.md)
        }
        e.rerollsLeft--;
        e.phase = 'reroll';
        e.lastRolledIds = dice.map(d => d.spec.id);
    }
    // Sort the tray for legibility. Consumes no RNG.
    organizeTray(mode = 'face') {
        const colorIdx = (c) => COLORS.indexOf(c);
        const cmp = mode === 'face'
            ? (a, b) => a.face - b.face || colorIdx(a.spec.color) - colorIdx(b.spec.color) || a.spec.id - b.spec.id
            : (a, b) => colorIdx(a.spec.color) - colorIdx(b.spec.color) || a.face - b.face || a.spec.id - b.spec.id;
        if (this.enc)
            this.enc.tray.sort(cmp);
        if (this.finale)
            this.finale.finalTray.sort(cmp);
    }
    toCommitPhase() { this.enc.phase = 'commit'; }
    commitHand(dice) {
        const e = this.enc;
        const ev = evaluateHand(dice, this.evalCtx(dice));
        if (!ev.ok)
            return ev;
        e.phase = 'commit';
        e.playerScore += ev.score;
        this.gold += ev.goldGained;
        this.stats.goldEarned += ev.goldGained;
        e.tray = e.tray.filter(d => dice.indexOf(d) < 0);
        e.handsThisRound++;
        // Chime: consume the armed bonus, then re-arm if this hand carried a Chime
        e.chimeNext = 0;
        if (dice.some(d => d.spec.specialId === 'chime'))
            e.chimeNext = this.cfg.specials.chimePrism;
        // Echo Choir: committed specials echo into their pile
        const specialsInHand = dice.filter(d => d.spec.specialId !== null).length;
        if (e.artisan.id === 'echochoir' && specialsInHand > 0) {
            e.echoPips += 5 * specialsInHand;
            this.refreshArtisanScore();
        }
        if (specialsInHand > 0)
            e.specialHandsThisEncounter++;
        const snap = {
            encounterIdx: this.encounterIdx, round: e.round,
            dice: dice.map(d => ({ color: d.spec.color, specialId: d.spec.specialId, face: d.face })),
            type: ev.type, colorMod: ev.colorMod, light: ev.light, prism: ev.prism, score: ev.score,
        };
        this.committedHistory.push(snap);
        this.stats.handsCommitted++;
        if (!this.stats.biggestHand || snap.score > this.stats.biggestHand.score)
            this.stats.biggestHand = snap;
        return ev;
    }
    // Ends the round; returns 'round' | 'won' | 'lost' so callers can route.
    endRound() {
        const e = this.enc;
        if (this.relics.indexOf('coinpress') >= 0)
            this.gold += this.cfg.relics.coinPressPerRound;
        if (e.round < this.cfg.roundsPerEncounter) {
            this.startRound();
            return 'round';
        }
        // Encounter resolution (tie goes to the player)
        this.refreshArtisanScore();
        this.stats.encounterResults.push({ name: e.artisan.name, player: e.playerScore, artisan: e.artisanScore });
        if (e.playerScore >= e.artisanScore) {
            const reward = this.cfg.gold.encounterReward[Math.min(this.encounterIdx, 3)]
                + Math.floor(Math.max(0, e.playerScore - e.artisanScore) / 50) * this.cfg.gold.marginBonusPer50;
            this.gold += reward;
            this.stats.goldEarned += reward;
            this.openTribute();
            return 'won';
        }
        else {
            this.result = 'loss';
            this.lossReason = `${e.artisan.name} out-scored you ${e.artisanScore} to ${e.playerScore} in encounter ${this.encounterIdx + 1}.`;
            this.screen = 'end';
            return 'lost';
        }
    }
    // ---------- Tribute ----------
    randomRarity() {
        const r = this.rng.next();
        return r < 0.45 ? 'common' : r < 0.75 ? 'uncommon' : 0.95 > r ? 'rare' : 'legendary';
    }
    makeDieOffer(priced) {
        const ownedSpecials = new Set(this.ownedDice.map(d => d.specialId).filter(x => x));
        const esc = this.cfg.shop.priceEscalationPerEncounter * this.encounterIdx;
        const available = SPECIALS.filter(s => !ownedSpecials.has(s.id) && this.allowedSpecials.indexOf(s.id) >= 0);
        if (this.rng.next() < 0.62) {
            const rarity = this.randomRarity();
            const pool = available.filter(s => s.rarity === rarity);
            const anyPool = pool.length ? pool : available;
            if (anyPool.length > 0) {
                const s = this.rng.pick(anyPool);
                return { color: s.color, specialId: s.id, price: priced ? this.cfg.shop.priceByRarity[s.rarity] + esc : 0 };
            }
        }
        return { color: this.rng.pick(COLORS), specialId: null, price: priced ? this.cfg.shop.plainDiePrice + esc : 0 };
    }
    openTribute() {
        const relicPool = this.rng.shuffle(RELICS.filter(r => this.relics.indexOf(r.id) < 0 && this.allowedRelics.indexOf(r.id) >= 0));
        const dieOffers = [];
        for (let i = 0; i < this.cfg.tribute.dieChoices; i++) {
            let offer = this.makeDieOffer(false);
            // avoid duplicate special offers within one tribute
            let guard = 0;
            while (offer.specialId && dieOffers.some(o => o.specialId === offer.specialId) && guard++ < 10) {
                offer = this.makeDieOffer(false);
            }
            dieOffers.push(offer);
        }
        this.tribute = {
            dieOffers,
            relicOffers: relicPool.slice(0, this.cfg.tribute.relicChoices).map(r => r.id),
            diePicked: false, relicPicked: false,
        };
        this.screen = 'tribute';
    }
    pickTributeDie(i) {
        const t = this.tribute;
        if (t.diePicked)
            return;
        const o = t.dieOffers[i];
        this.ownedDice.push({ id: this.nextDieId++, color: o.color, specialId: o.specialId });
        t.diePicked = true;
        this.maybeCloseTribute();
    }
    pickTributeRelic(i) {
        const t = this.tribute;
        if (t.relicPicked)
            return;
        if (t.relicOffers.length === 0) {
            t.relicPicked = true;
            this.maybeCloseTribute();
            return;
        }
        this.acquireRelic(t.relicOffers[i]);
        t.relicPicked = true;
        this.maybeCloseTribute();
    }
    acquireRelic(id) {
        this.relics.push(id);
        if (id === 'endowment') {
            this.gold += this.cfg.relics.endowmentGold;
            this.stats.goldEarned += this.cfg.relics.endowmentGold;
        }
    }
    maybeCloseTribute() {
        const t = this.tribute;
        if (t.diePicked && (t.relicPicked || t.relicOffers.length === 0))
            this.openShop();
    }
    // ---------- Shop ----------
    shopDiscount() {
        return this.relics.indexOf('merchants') >= 0 ? this.cfg.relics.merchantsDiscount : 0;
    }
    openShop() {
        const esc = this.cfg.shop.priceEscalationPerEncounter * this.encounterIdx;
        const relicPool = this.rng.shuffle(RELICS.filter(r => this.relics.indexOf(r.id) < 0 && this.allowedRelics.indexOf(r.id) >= 0));
        const dieOffers = [];
        for (let i = 0; i < this.cfg.shop.dieSlots; i++)
            dieOffers.push(this.makeDieOffer(true));
        this.shop = {
            dieOffers,
            relicOffers: relicPool.slice(0, this.cfg.shop.relicSlots)
                .map(r => ({ id: r.id, price: this.cfg.shop.priceByRarity[r.rarity] + esc })),
            removePrice: this.cfg.shop.removeDiePrice + esc,
        };
        this.screen = 'shop';
    }
    priceOf(base) { return Math.max(1, base - this.shopDiscount()); }
    buyShopDie(i) {
        const s = this.shop;
        const o = s.dieOffers[i];
        if (!o)
            return false;
        const p = this.priceOf(o.price);
        if (this.gold < p)
            return false;
        this.gold -= p;
        this.ownedDice.push({ id: this.nextDieId++, color: o.color, specialId: o.specialId });
        s.dieOffers[i] = null;
        return true;
    }
    buyShopRelic(i) {
        const s = this.shop;
        const o = s.relicOffers[i];
        if (!o)
            return false;
        const p = this.priceOf(o.price);
        if (this.gold < p)
            return false;
        this.gold -= p;
        this.acquireRelic(o.id);
        s.relicOffers[i] = null;
        return true;
    }
    removeOwnedDie(dieId) {
        const s = this.shop;
        const p = this.priceOf(s.removePrice);
        if (this.gold < p || this.ownedDice.length <= 5)
            return false;
        const idx = this.ownedDice.findIndex(d => d.id === dieId);
        if (idx < 0)
            return false;
        this.gold -= p;
        this.ownedDice.splice(idx, 1);
        s.removePrice += 2; // each removal costs more
        return true;
    }
    leaveShop() {
        this.encounterIdx++;
        if (this.encounterIdx < this.cfg.encounters - 1)
            this.startEncounter();
        else
            this.startFinale();
    }
    // ---------- Finale: the Iconoclast ----------
    // He targets your best hands only — committing MORE hands never feeds him.
    smashTargets() {
        const sorted = this.committedHistory.slice().sort((a, b) => b.score - a.score);
        return sorted.slice(0, this.cfg.finale.smashCount);
    }
    // You reclaim at most claimCap dice AND at most half the hand (floor).
    // He always keeps at least half — small-hand starvation doesn't work.
    claimAllowance(hand) {
        return Math.min(this.cfg.finale.claimCap, Math.floor(hand.dice.length / 2));
    }
    startFinale() {
        const chosen = this.smashTargets();
        // chronological presentation
        chosen.sort((a, b) => this.committedHistory.indexOf(a) - this.committedHistory.indexOf(b));
        this.finale = {
            smashQueue: chosen, smashIdx: 0, finalTray: [],
            unclaimedPips: 0, unclaimedSpecials: 0, unclaimedColors: [],
            iconoScore: 0, iconoLight: 0, iconoPrism: 1, playerScore: 0,
            phase: chosen.length > 0 ? 'smash' : 'commit',
            handsThisRound: 0, specialHands: 0,
        };
        this.screen = 'finale';
    }
    // Claim up to claimAllowance(hand) dice (indices into the current hand); the rest feed him.
    claimFromSmash(indices) {
        const f = this.finale;
        const F = this.cfg.finale;
        const hand = f.smashQueue[f.smashIdx];
        const take = indices.slice(0, this.claimAllowance(hand));
        hand.dice.forEach((d, i) => {
            if (take.indexOf(i) >= 0) {
                // Pip preservation: reclaimed glass keeps the face it was committed with
                f.finalTray.push({
                    spec: { id: this.nextDieId++, color: d.color, specialId: d.specialId },
                    face: d.face, carried: false, fromMarket: false,
                });
            }
            else {
                f.unclaimedPips += d.face;
                if (d.specialId)
                    f.unclaimedSpecials++;
                if (f.unclaimedColors.indexOf(d.color) < 0)
                    f.unclaimedColors.push(d.color);
            }
        });
        f.iconoLight = Math.round(F.lightScale * f.unclaimedPips);
        f.iconoPrism = 1 + f.unclaimedSpecials * F.specialPrismWeight
            + (f.unclaimedColors.length >= F.colorVarietyThreshold ? F.colorVarietyBonus : 0);
        f.iconoScore = Math.round(f.iconoLight * f.iconoPrism);
        f.smashIdx++;
        if (f.smashIdx >= f.smashQueue.length)
            f.phase = 'commit';
    }
    finaleCommit(dice) {
        const f = this.finale;
        const ev = evaluateHand(dice, this.evalCtx(dice));
        if (!ev.ok)
            return ev;
        f.playerScore += ev.score;
        this.gold += ev.goldGained;
        f.finalTray = f.finalTray.filter(d => dice.indexOf(d) < 0);
        f.handsThisRound++;
        if (dice.some(d => d.spec.specialId !== null))
            f.specialHands++;
        const snap = {
            encounterIdx: this.encounterIdx, round: 1,
            dice: dice.map(d => ({ color: d.spec.color, specialId: d.spec.specialId, face: d.face })),
            type: ev.type, colorMod: ev.colorMod, light: ev.light, prism: ev.prism, score: ev.score,
        };
        this.stats.handsCommitted++;
        if (!this.stats.biggestHand || snap.score > this.stats.biggestHand.score)
            this.stats.biggestHand = snap;
        return ev;
    }
    finishFinale() {
        const f = this.finale;
        this.stats.encounterResults.push({ name: ICONOCLAST.name, player: f.playerScore, artisan: f.iconoScore });
        if (f.playerScore >= f.iconoScore) {
            this.result = 'win';
        }
        else {
            this.result = 'loss';
            this.lossReason = `The Iconoclast weighed your abandoned shards: ${f.iconoScore} against your ${f.playerScore}.`;
        }
        this.screen = 'end';
    }
}
function deepMerge(target, patch) {
    for (const k of Object.keys(patch)) {
        const v = patch[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
            deepMerge(target[k], v);
        }
        else {
            target[k] = v;
        }
    }
}
// ============================================================
// Simple bot policies — used by the headless sim to tune balance.
// Deliberately dumb-but-reasonable; a human should beat it.
// ============================================================
function botDraftValue(run, d) {
    const e = run.enc;
    const warp = { artisanId: run.effectiveWarpId(), blessedColors: e.blessed };
    let v = d.face * warpMult(d, warp) * faceWarpMult(d.face, warp);
    if (e.tray.some(t => t.face === d.face))
        v += 2; // pair potential
    return v;
}
function botReroll(run) {
    const e = run.enc;
    while (e.rerollsLeft > 0) {
        const counts = new Map();
        for (const d of e.tray)
            counts.set(d.face, (counts.get(d.face) || 0) + 1);
        const junk = e.tray.filter(d => (counts.get(d.face) || 0) < 2 && d.face < 5 && d.spec.specialId === null);
        if (junk.length < 2)
            break;
        run.reroll(junk);
    }
}
function botCommit(run) {
    const e = run.enc;
    run.toCommitPhase();
    const lastRound = e.round >= run.cfg.roundsPerEncounter;
    for (let guard = 0; guard < 40; guard++) {
        if (e.tray.length === 0)
            break;
        const best = findBestHand(e.tray, run.evalCtx([]));
        if (!best)
            break;
        const isLone = best.dice.length === 1;
        if (!lastRound) {
            const worth = best.ev.prism >= 3 || best.ev.score >= run.cfg.bot.earlyCommitMinScore;
            if (isLone || !worth)
                break;
        }
        if (best.ev.score <= 0 && !lastRound)
            break;
        run.commitHand(best.dice);
    }
}
function botPlayEncounter(run) {
    const e = run.enc;
    for (;;) {
        run.executeRemoval();
        // draft
        while (e.phase === 'draft' && e.playerPicksLeft > 0 && e.market.length > 0) {
            let bi = 0, bv = -Infinity;
            e.market.forEach((d, i) => { const v = botDraftValue(run, d); if (v > bv) {
                bv = v;
                bi = i;
            } });
            run.draftPick(bi);
        }
        botReroll(run);
        botCommit(run);
        const r = run.endRound();
        if (r === 'won')
            return 'won';
        if (r === 'lost')
            return 'lost';
    }
}
function botTributeAndShop(run) {
    const rarityRank = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
    const t = run.tribute;
    let bi = 0, bv = -1;
    t.dieOffers.forEach((o, i) => {
        const v = o.specialId ? 1 + rarityRank[SPECIALS.find(s => s.id === o.specialId).rarity] : 0;
        if (v > bv) {
            bv = v;
            bi = i;
        }
    });
    run.pickTributeDie(bi);
    if (run.tribute && !run.tribute.relicPicked)
        run.pickTributeRelic(0);
    const s = run.shop;
    s.relicOffers.forEach((o, i) => { if (o && run.gold >= run.priceOf(o.price))
        run.buyShopRelic(i); });
    s.dieOffers.forEach((o, i) => { if (o && o.specialId && run.gold >= run.priceOf(o.price))
        run.buyShopDie(i); });
    run.leaveShop();
}
function botPlayFinale(run) {
    const f = run.finale;
    while (f.phase === 'smash') {
        const hand = f.smashQueue[f.smashIdx];
        const scored = hand.dice.map((d, i) => ({ i, v: d.face + (d.specialId ? 10 : 0) }));
        scored.sort((a, b) => b.v - a.v);
        run.claimFromSmash(scored.slice(0, run.claimAllowance(hand)).map(x => x.i));
    }
    for (let guard = 0; guard < 40; guard++) {
        if (f.finalTray.length === 0)
            break;
        const best = findBestHand(f.finalTray, run.evalCtx([]));
        if (!best || best.ev.score <= 0)
            break;
        run.finaleCommit(best.dice);
    }
    run.finishFinale();
}
function playBotRun(seed, patch, opts) {
    const run = new GWRun(seed, patch, opts);
    for (;;) {
        if (run.screen === 'encounter') {
            const r = botPlayEncounter(run);
            if (r === 'lost')
                break;
        }
        else if (run.screen === 'tribute') {
            botTributeAndShop(run);
        }
        else if (run.screen === 'finale') {
            botPlayFinale(run);
            break;
        }
        else
            break;
    }
    return {
        result: run.result === 'win' ? 'win' : 'loss',
        lostAt: run.result === 'win' ? -1 : run.stats.encounterResults.length - 1,
        encounterResults: run.stats.encounterResults,
        biggestHand: run.stats.biggestHand ? run.stats.biggestHand.score : 0,
        finalGold: run.gold,
        bagSize: run.ownedDice.length,
    };
}
// ============================================================
// Headless sim — run under node:  node dist/game.js sim <N> [baseSeed]
// Prints win rates and score distributions for balance tuning.
// ============================================================
function runSim(n, baseSeed, patch, quiet, opts) {
    let wins = 0;
    const lostAt = [0, 0, 0, 0, 0];
    const encPlayer = [[], [], [], [], []];
    const encArtisan = [[], [], [], [], []];
    const biggest = [];
    const bags = [];
    for (let i = 0; i < n; i++) {
        const r = playBotRun(`${baseSeed}-${i}`, patch, opts);
        if (r.result === 'win')
            wins++;
        else
            lostAt[Math.max(0, r.lostAt)]++;
        r.encounterResults.forEach((er, idx) => {
            encPlayer[idx].push(er.player);
            encArtisan[idx].push(er.artisan);
        });
        biggest.push(r.biggestHand);
        bags.push(r.bagSize);
    }
    const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    const med = (a) => {
        if (!a.length)
            return 0;
        const s = a.slice().sort((x, y) => x - y);
        return s[Math.floor(s.length / 2)];
    };
    const winrate = wins / n;
    if (!quiet) {
        console.log(`\n=== ${n} runs, seed base "${baseSeed}" ===`);
        console.log(`WIN RATE: ${(winrate * 100).toFixed(1)}%   (target 40-60%)`);
        console.log(`Losses by encounter: ${lostAt.map((v, i) => `E${i + 1}:${v}`).join('  ')}`);
        for (let e = 0; e < 5; e++) {
            if (encPlayer[e].length === 0)
                continue;
            const label = e === 4 ? 'FINALE' : `E${e + 1}  `;
            console.log(`${label} n=${String(encPlayer[e].length).padStart(4)}  player avg ${String(avg(encPlayer[e])).padStart(4)} med ${String(med(encPlayer[e])).padStart(4)}  | artisan avg ${String(avg(encArtisan[e])).padStart(4)} med ${String(med(encArtisan[e])).padStart(4)}`);
        }
        console.log(`Biggest hand: avg ${avg(biggest)} med ${med(biggest)} max ${Math.max(...biggest)}`);
        console.log(`Final bag size: avg ${(bags.reduce((a, b) => a + b, 0) / bags.length).toFixed(1)}`);
    }
    return winrate;
}
function simMain() {
    const argv = process.argv.slice(2);
    const mode = argv[0] || 'sim';
    if (mode === 'sim') {
        const n = parseInt(argv[1] || '500', 10);
        const baseSeed = argv[2] || 'tune';
        // 'all' = every artisan/special/relic unlocked (late-meta balance check)
        const opts = argv[3] === 'all' ? {
            artisanPool: ARTISANS.map(a => a.id),
            specialPool: SPECIALS.map(s => s.id),
            relicPool: RELICS.map(r => r.id),
        } : undefined;
        if (opts)
            console.log('(all content unlocked)');
        runSim(n, baseSeed, undefined, false, opts);
    }
    else if (mode === 'sweep') {
        // Sweep artisan accrual scale and finale light scale
        const n = parseInt(argv[1] || '300', 10);
        for (const scale of [0.7, 0.85, 1.0, 1.15, 1.3]) {
            const base = CONFIG.artisanAccrual;
            const patch = { artisanAccrual: base.map(a => +(a * scale).toFixed(2)) };
            const wr = runSim(n, 'sweep', patch, true);
            console.log(`accrual x${scale}  [${patch.artisanAccrual.join(', ')}]  winrate ${(wr * 100).toFixed(1)}%`);
        }
        for (const fs of [1.0, 1.3, 1.6, 2.0, 2.4]) {
            const patch = { finale: { lightScale: fs } };
            const wr = runSim(n, 'sweep-f', patch, true);
            console.log(`finale lightScale ${fs}  winrate ${(wr * 100).toFixed(1)}%`);
        }
    }
}
if (typeof process !== 'undefined' && typeof window === 'undefined') {
    simMain();
}
// ============================================================
// Browser UI — DOM rendering, animations, input. Legibility over beauty.
// ============================================================
const UI = {
    run: null, sel: new Set(), smashSel: new Set(), removalKey: '',
    log: [], displayed: {}, popIds: [],
    animLock: false, showRules: false, sortMode: 'face', fastAnim: false,
    meta: { runs: 0, wins: 0 }, newUnlocks: [], metaRecorded: null,
};
const COLOR_HEX = {
    red: '#c0392b', blue: '#2f6fb3', yellow: '#d4a017', green: '#2e9e5b', purple: '#8e44ad',
};
// Colorblind support: every die carries a shape glyph for its color
const COLOR_GLYPH = {
    red: '▲', blue: '●', yellow: '■', green: '✚', purple: '◆',
};
// One symbol per special die (plus a CSS effect class sp-<id>)
const SP_GLYPH = {
    beacon: '☀', spark: '✦', tithe: '¢', lens: '◎', anchor: '⚓', coffer: '⛁',
    iris: '◈', crescendo: '♬', heretic: '✠', quicksilver: '≈', crown: '♛', rose: '✿',
    chime: '♪', vigil: '†', keystone: '⌂',
};
// Artisans with painted portraits (assets/); others fall back to the built-in SVG art
const ARTISAN_IMG = ['cardinal', 'numerologist', 'pedant', 'triad', 'iconoclast', 'architect', 'widow',
    'timekeeper', 'echochoir', 'hereticsaint', 'apprentice', 'statistician', 'modulist', 'iconographer'];
function portraitNode(id, cls = '') {
    const wrap = el('div', 'portrait ' + cls);
    if (ARTISAN_IMG.indexOf(id) >= 0) {
        wrap.innerHTML = `<img src="assets/${id}.png" alt="${id}">`;
    }
    else {
        wrap.innerHTML = ARTISAN_ART[id] || ARTISAN_ART['iconoclast'];
    }
    return wrap;
}
function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls)
        e.className = cls;
    if (html !== undefined)
        e.innerHTML = html;
    return e;
}
function uiLog(msg) {
    UI.log.unshift(msg);
    if (UI.log.length > 5)
        UI.log.pop();
}
function isFast() { return UI.fastAnim || !!window.GW_FASTANIM; }
// ---------- FX layer ----------
function fxLayer() { return document.getElementById('fx'); }
function spawnFloat(x, y, text, cls = '') {
    const f = el('div', 'floatie ' + cls, text);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    fxLayer().appendChild(f);
    setTimeout(() => f.remove(), 1600);
}
function spawnBanner(text, cls = '') {
    const b = el('div', 'banner ' + cls, text);
    const existing = fxLayer().querySelectorAll('.banner').length;
    b.style.top = `${26 + existing * 8}%`;
    fxLayer().appendChild(b);
    setTimeout(() => b.remove(), isFast() ? 900 : 2000);
}
function spawnShards(x, y, big = false) {
    const n = big ? 16 : 10;
    for (let i = 0; i < n; i++) {
        const s = el('div', 'shard');
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        s.style.setProperty('--dx', `${(Math.random() - 0.5) * (big ? 420 : 260)}px`);
        s.style.setProperty('--dy', `${-40 - Math.random() * (big ? 240 : 160)}px`);
        s.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
        s.style.background = Math.random() < 0.5 ? '#a41f2b' : (Math.random() < 0.5 ? '#c0392b' : '#8f98a6');
        fxLayer().appendChild(s);
        setTimeout(() => s.remove(), 1100);
    }
}
function screenShake() {
    if (isFast())
        return;
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 450);
}
function dieRect(specId) {
    const n = document.querySelector(`[data-die-id="${specId}"]`);
    if (!n)
        return null;
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
}
function animateCounter(id, target) {
    const node = document.getElementById(id);
    if (!node)
        return;
    const cur = UI.displayed[id] !== undefined ? UI.displayed[id] : target;
    if (target <= cur) {
        UI.displayed[id] = target;
        node.textContent = String(target);
        return;
    }
    const start = cur, t0 = performance.now(), dur = 550;
    const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const v = Math.round(start + (target - start) * p);
        UI.displayed[id] = v;
        node.textContent = String(v);
        if (p < 1)
            requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
}
// ---------- Die rendering ----------
function specialOf(d) {
    return d.specialId ? SPECIALS.find(s => s.id === d.specialId) || null : null;
}
function dieNode(d, opts = {}) {
    const sp = specialOf(d.spec);
    const n = el('div', 'die' + (opts.mini ? ' mini' : ''));
    n.style.background = COLOR_HEX[d.spec.color];
    if (d.spec.color === 'yellow')
        n.classList.add('darktext');
    n.dataset.dieId = String(d.spec.id);
    if (opts.clickable)
        n.classList.add('clickable');
    if (opts.selected)
        n.classList.add('selected');
    if (opts.telegraph)
        n.classList.add('telegraph');
    if (opts.doomed)
        n.classList.add('doomed');
    if (opts.cracked)
        n.classList.add('cracked');
    if (UI.popIds.indexOf(d.spec.id) >= 0)
        n.classList.add('pop');
    if (sp)
        n.classList.add('sp-' + sp.id);
    let inner = `<div class="face">${d.face}</div>`;
    inner += `<div class="cglyph">${COLOR_GLYPH[d.spec.color]}</div>`;
    if (sp)
        inner += `<div class="spmark">${SP_GLYPH[sp.id] || '★'}</div><div class="sptag">${sp.name.replace('The ', '').slice(0, 6)}</div>`;
    if (d.carried)
        inner += `<div class="carrydot" title="Carried from last round"></div>`;
    n.innerHTML = inner;
    n.title = (sp ? `${sp.name} (${sp.rarity}) — ${sp.desc}` : `${d.spec.color} die`)
        + (d.carried ? ' [carried]' : '') + (d.fromMarket ? ' [market glass — leaves after this encounter]' : '');
    return n;
}
function offerDieNode(o) {
    return dieNode({ spec: { id: -1, color: o.color, specialId: o.specialId }, face: 6, carried: false, fromMarket: false });
}
function snapshotDieNode(d, opts = {}) {
    const inst = { spec: { id: -1, color: d.color, specialId: d.specialId }, face: d.face, carried: false, fromMarket: false };
    const n = dieNode(inst, opts);
    n.removeAttribute('data-die-id');
    return n;
}
// ---------- Selection helpers ----------
function currentTray() {
    const r = UI.run;
    if (r.screen === 'encounter')
        return r.enc.tray;
    if (r.screen === 'finale')
        return r.finale.finalTray;
    return [];
}
function selectedDice() {
    return currentTray().filter(d => UI.sel.has(d.spec.id));
}
function clearSel() { UI.sel.clear(); UI.smashSel.clear(); }
// ---------- Roll animation: tumble with cycling faces, settle, then organize ----------
function findDieById(id) {
    const r = UI.run;
    if (!r)
        return null;
    const pools = [];
    if (r.enc)
        pools.push(r.enc.tray, r.enc.market, r.enc.pile);
    if (r.finale)
        pools.push(r.finale.finalTray);
    for (const p of pools)
        for (const d of p)
            if (d.spec.id === id)
                return d;
    return null;
}
function capturePositions() {
    const m = new Map();
    document.querySelectorAll('[data-die-id]').forEach(n => {
        m.set(+n.dataset.dieId, n.getBoundingClientRect());
    });
    return m;
}
function flipFrom(before) {
    document.querySelectorAll('[data-die-id]').forEach(node => {
        const n = node;
        const b = before.get(+n.dataset.dieId);
        if (!b)
            return;
        const a = n.getBoundingClientRect();
        const dx = b.left - a.left, dy = b.top - a.top;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2)
            return;
        n.style.transition = 'none';
        n.style.transform = `translate(${dx}px,${dy}px)`;
        requestAnimationFrame(() => {
            n.style.transition = 'transform .38s cubic-bezier(.2,.8,.3,1)';
            n.style.transform = '';
            setTimeout(() => { n.style.transition = ''; }, 420);
        });
    });
}
function playRollAnimation() {
    const r = UI.run;
    if (!r || !r.enc)
        return;
    const e = r.enc;
    const ids = e.lastRolledIds;
    e.lastRolledIds = [];
    if (ids.length === 0)
        return;
    if (isFast()) {
        r.organizeTray(UI.sortMode);
        render();
        return;
    }
    UI.animLock = true;
    render();
    sfxRoll(ids.length);
    const nodes = ids
        .map(id => document.querySelector(`[data-die-id="${id}"]`))
        .filter((n) => !!n);
    nodes.forEach(n => n.classList.add('rolling'));
    const cycler = setInterval(() => {
        nodes.forEach(n => {
            if (!n.classList.contains('rolling'))
                return;
            const f = n.querySelector('.face');
            if (f)
                f.textContent = String(1 + Math.floor(Math.random() * 6));
        });
    }, 75);
    nodes.forEach((n, i) => setTimeout(() => {
        n.classList.remove('rolling');
        const die = findDieById(+n.dataset.dieId);
        const f = n.querySelector('.face');
        if (f && die)
            f.textContent = String(die.face);
        sfxSettle(i);
    }, 480 + i * 42));
    const total = 480 + nodes.length * 42 + 180;
    setTimeout(() => {
        clearInterval(cycler);
        const before = capturePositions();
        r.organizeTray(UI.sortMode);
        render();
        flipFrom(before);
        UI.animLock = false;
    }, total);
}
function resortTray(mode) {
    UI.sortMode = mode;
    const r = UI.run;
    if (!r)
        return;
    const before = capturePositions();
    r.organizeTray(mode);
    render();
    flipFrom(before);
}
// ---------- Actions ----------
function actDraft(i) {
    const r = UI.run;
    const e = r.enc;
    if (UI.animLock || e.phase !== 'draft' || e.removalPending)
        return;
    const res = r.draftPick(i);
    UI.popIds = [res.taken.spec.id, ...res.artisanTook.map(d => d.spec.id)];
    uiLog(`You drafted a ${res.taken.spec.color} ${res.taken.face}.`);
    for (const t of res.artisanTook)
        uiLog(`${e.artisan.name} took the ${t.spec.color} ${t.face}.`);
    sfxPick();
    render();
    animateCounter('artisanScore', e.artisanScore);
    res.artisanTook.forEach((t, k) => {
        sfxTake();
        const p = dieRect(t.spec.id);
        if (p)
            setTimeout(() => spawnFloat(p.x, p.y, 'claimed', 'artisanfloat'), k * 150);
    });
}
// Selection = the dice you KEEP. Everything unselected rerolls.
function actReroll() {
    const r = UI.run;
    if (r.screen !== 'encounter')
        return;
    const e = r.enc;
    if (UI.animLock || e.phase === 'draft' || e.rerollsLeft <= 0)
        return;
    const toReroll = e.tray.filter(d => !UI.sel.has(d.spec.id));
    if (toReroll.length === 0) {
        spawnBanner('Everything is kept — nothing to reroll', 'bad');
        return;
    }
    r.reroll(toReroll);
    uiLog(`Kept ${UI.sel.size}, rerolled ${toReroll.length} (${e.rerollsLeft} rerolls left).`);
    render();
    playRollAnimation();
}
// Highlight the best hand findBestHand can see (learning tool; X key)
function actSuggest() {
    const r = UI.run;
    if (!r || UI.animLock)
        return;
    if (r.screen === 'encounter' && r.enc.phase === 'draft')
        return;
    const tray = currentTray();
    if (tray.length === 0)
        return;
    const best = findBestHand(tray, r.evalCtx([]));
    if (!best) {
        spawnBanner('No legal hand in the tray', 'bad');
        return;
    }
    UI.sel = new Set(best.dice.map(d => d.spec.id));
    uiLog(`Suggested: ${handLabelFull(best.ev.type, best.ev.colorMod)} for ${best.ev.score}.`);
    render();
}
// Greedy-commit the whole tray as best splits (final round / finale dump; A key)
let autoCommitting = false;
function actAutoCommit() {
    const r = UI.run;
    if (!r || UI.animLock)
        return;
    const inFinaleCommit = r.screen === 'finale' && r.finale.phase === 'commit';
    const inLastRound = r.screen === 'encounter' && r.enc.phase !== 'draft'
        && r.enc.round >= r.cfg.roundsPerEncounter;
    if (!inFinaleCommit && !inLastRound)
        return;
    autoCommitting = true;
    let hands = 0, total = 0;
    for (let guard = 0; guard < 40; guard++) {
        const tray = currentTray();
        if (tray.length === 0)
            break;
        const best = findBestHand(tray, r.evalCtx([]));
        if (!best)
            break;
        UI.sel = new Set(best.dice.map(d => d.spec.id));
        const before = inFinaleCommit ? r.finale.playerScore : r.enc.playerScore;
        actCommit();
        const after = inFinaleCommit ? r.finale.playerScore : r.enc.playerScore;
        if (after === before && currentTray().length === tray.length)
            break; // commit failed
        hands++;
        total += after - before;
    }
    autoCommitting = false;
    if (hands > 0)
        spawnBanner(`Committed ${hands} hands — +${total}`, 'good');
    render();
}
function actCommit() {
    const r = UI.run;
    if (UI.animLock)
        return;
    const dice = selectedDice();
    if (dice.length === 0)
        return;
    const positions = new Map(dice.map(d => [d.spec.id, dieRect(d.spec.id)]));
    const prevGold = r.gold;
    const ev = r.screen === 'finale' ? r.finaleCommit(dice) : r.commitHand(dice);
    if (!ev.ok) {
        spawnBanner(ev.reason, 'bad');
        return;
    }
    let delay = 0;
    for (const pd of ev.perDie) {
        const p = positions.get(pd.die.spec.id);
        if (p) {
            const light = pd.light;
            setTimeout(() => spawnFloat(p.x, p.y, `+${light}`, 'lightfloat'), delay);
            delay += 90;
        }
    }
    const label = handLabelFull(ev.type, ev.colorMod);
    if (!autoCommitting) {
        setTimeout(() => {
            spawnBanner(`${label} — ${ev.light} Light × ${ev.prism} Prism = ${ev.score}`);
        }, delay + 60);
    }
    sfxCommit(ev.prism, ev.score);
    if (ev.goldGained > 0)
        setTimeout(sfxGold, delay + 150);
    uiLog(`Committed ${label}: ${ev.light} × ${ev.prism} = ${ev.score}${ev.goldGained ? ` (+${ev.goldGained}g)` : ''}.`);
    clearSel();
    render();
    animateCounter(r.screen === 'finale' ? 'finalePlayerScore' : 'playerScore', r.screen === 'finale' ? r.finale.playerScore : r.enc.playerScore);
    if (r.gold !== prevGold)
        animateCounter('goldCounter', r.gold);
}
function recordMetaOnce() {
    const r = UI.run;
    if (!r || !r.result || UI.metaRecorded === r)
        return;
    UI.metaRecorded = r;
    UI.newUnlocks = metaRecordRun(UI.meta, r.result === 'win');
}
function actEndRound() {
    const r = UI.run;
    if (r.screen !== 'encounter' || UI.animLock)
        return;
    const e = r.enc;
    if (e.phase === 'draft') {
        spawnBanner('Finish the draft first', 'bad');
        return;
    }
    clearSel();
    const res = r.endRound();
    if (res === 'round') {
        spawnBanner(`Round ${e.round} of ${r.cfg.roundsPerEncounter}`);
        uiLog(`— Round ${e.round} —`);
    }
    else if (res === 'won') {
        spawnBanner(`You beat ${e.artisan.name}!`, 'good');
        uiLog(`Won encounter ${r.encounterIdx + 1}. +gold.`);
        sfxWin();
    }
    else {
        spawnBanner('Defeat.', 'bad');
        sfxLoss();
        recordMetaOnce();
    }
    render();
    animateCounter('goldCounter', r.gold);
    if (res === 'round')
        playRollAnimation();
}
// Claim: unclaimed dice CRACK first, then shatter into his tally.
function actClaim() {
    const r = UI.run;
    const f = r.finale;
    if (f.phase !== 'smash' || UI.animLock)
        return;
    const hand = f.smashQueue[f.smashIdx];
    const idx = Array.from(UI.smashSel);
    const crackDelay = isFast() ? 60 : 700;
    // phase 1: mark the doomed dice cracked
    UI.animLock = true;
    const zone = document.querySelector('.smashzone .dicerow');
    if (zone) {
        zone.querySelectorAll('.die').forEach((n, i) => {
            if (idx.indexOf(i) < 0)
                n.classList.add('cracked');
        });
    }
    sfxStrike();
    setTimeout(() => {
        if (zone) {
            const rect = zone.getBoundingClientRect();
            spawnShards(rect.left + rect.width / 2, rect.top + rect.height / 2, true);
        }
        screenShake();
        sfxSmash();
        const claimed = idx.length;
        r.claimFromSmash(idx);
        r.organizeTray(UI.sortMode);
        uiLog(`Reclaimed ${claimed} dice; ${hand.dice.length - claimed} shards fed the Iconoclast.`);
        UI.smashSel.clear();
        UI.animLock = false;
        render();
        animateCounter('iconoScore', f.iconoScore);
        if (f.phase === 'commit')
            spawnBanner('The last window falls. Build your answer.', 'good');
    }, crackDelay);
}
function actAdvance() {
    const r = UI.run;
    if (UI.animLock)
        return;
    if (!r) {
        startRunFromMenu();
        return;
    }
    if (r.screen === 'encounter')
        actEndRound();
    else if (r.screen === 'shop') {
        r.leaveShop();
        clearSel();
        UI.displayed = {};
        const isFinale = r.screen === 'finale';
        spawnBanner(isFinale ? 'THE ICONOCLAST' : `Encounter ${r.encounterIdx + 1} — ${r.enc.artisan.name}`, isFinale ? 'bad' : '');
        if (isFinale) {
            sfxSmash();
            screenShake();
        }
        render();
        playRollAnimation();
    }
    else if (r.screen === 'finale') {
        const f = r.finale;
        if (f.phase === 'smash')
            actClaim();
        else {
            finishFinaleWithSound();
        }
    }
    else if (r.screen === 'end') {
        UI.run = null;
        render();
    }
}
function finishFinaleWithSound() {
    const r = UI.run;
    r.finishFinale();
    if (r.result === 'win')
        sfxWin();
    else
        sfxLoss();
    recordMetaOnce();
    render();
}
function currentPools() {
    const ladderIds = (k) => UNLOCK_LADDER.filter(u => u.kind === k).map(u => u.id);
    return {
        artisanPool: BASE_ARTISAN_IDS.concat(metaUnlockedIds(UI.meta, 'artisan')),
        specialPool: SPECIALS.map(s => s.id).filter(id => ladderIds('special').indexOf(id) < 0)
            .concat(metaUnlockedIds(UI.meta, 'special')),
        relicPool: RELICS.map(r => r.id).filter(id => ladderIds('relic').indexOf(id) < 0)
            .concat(metaUnlockedIds(UI.meta, 'relic')),
    };
}
function startRunFromMenu() {
    const seedBox = document.getElementById('seedbox');
    const seed = (seedBox && seedBox.value.trim()) || Math.random().toString(36).slice(2, 8);
    UI.run = new GWRun(seed, undefined, currentPools());
    UI.log = [];
    UI.displayed = {};
    UI.newUnlocks = [];
    clearSel();
    uiLog(`Run started. Seed: ${seed}.`);
    const a = UI.run.enc.artisan;
    spawnBanner(`Encounter 1 — ${a.name}`);
    uiLog(a.quip);
    render();
    playRollAnimation();
}
// ---------- Renderers ----------
let lastScreen = '';
function render() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const r = UI.run;
    const scr = r ? r.screen : 'menu';
    if (scr !== lastScreen) {
        fxLayer().innerHTML = '';
        lastScreen = scr;
    }
    updateBackdrop(scr);
    if (!r) {
        app.appendChild(renderMenu());
    }
    else if (r.screen === 'encounter')
        app.appendChild(renderEncounter());
    else if (r.screen === 'tribute')
        app.appendChild(renderTribute());
    else if (r.screen === 'shop')
        app.appendChild(renderShop());
    else if (r.screen === 'finale')
        app.appendChild(renderFinale());
    else if (r.screen === 'end')
        app.appendChild(renderEnd());
    if (UI.showRules)
        app.appendChild(rulesModal());
    UI.popIds = [];
    scheduleRemoval();
}
// The backdrop is always the artisan you face — or the one waiting for you.
function updateBackdrop(scr) {
    const bg = document.getElementById('bgart');
    const r = UI.run;
    const artImg = (id) => ARTISAN_IMG.indexOf(id) >= 0 ? `assets/${id}.png` : 'assets/bg1.png';
    let img = 'assets/bg1.png';
    if (scr === 'encounter' && r)
        img = artImg(r.enc.artisan.id);
    else if (scr === 'finale')
        img = 'assets/smash.png';
    else if ((scr === 'tribute' || scr === 'shop') && r) {
        // between encounters: the NEXT opponent looms
        const nextIdx = r.encounterIdx + 1;
        img = nextIdx < r.cfg.encounters - 1 ? artImg(r.artisanOrder[nextIdx].id) : 'assets/iconoclast.png';
    }
    else if (scr === 'end' && r) {
        img = r.result === 'win' ? 'assets/bg1.png' : 'assets/smash.png';
    }
    bg.style.backgroundImage = `url("${img}")`;
    bg.className = scr === 'menu' ? 'menu-bg' : '';
}
function scheduleRemoval() {
    const r = UI.run;
    if (!r || r.screen !== 'encounter')
        return;
    const e = r.enc;
    if (!e.removalPending)
        return;
    const key = `${r.encounterIdx}:${e.round}`;
    if (UI.removalKey === key)
        return;
    UI.removalKey = key;
    const delay = isFast() ? 300 : 2200;
    setTimeout(() => {
        if (!UI.run || UI.run.enc !== e || !e.removalPending)
            return;
        const doomed = e.market[e.removalIdx];
        const p = doomed ? dieRect(doomed.spec.id) : null;
        const removed = UI.run.executeRemoval();
        if (removed && p) {
            spawnFloat(p.x, p.y, '✕ struck', 'artisanfloat');
            spawnShards(p.x, p.y + 20);
        }
        if (removed) {
            uiLog(`${e.artisan.name} struck the ${removed.spec.color} ${removed.face} from the market.`);
            sfxStrike();
        }
        render();
    }, delay);
}
function handChartNode() {
    const rows = Object.keys(CONFIG.prism)
        .map(k => `<span class="chartitem"><b>${HAND_LABEL[k]}</b> ×${CONFIG.prism[k]}</span>`).join(' ');
    return el('div', 'handchart', `<b>Prism chart:</b> ${rows} <span class="dim">· all-one-color or all-different-colors: +1 to +3 (press H)</span>`);
}
function topBar() {
    const r = UI.run;
    const bar = el('div', 'topbar');
    const encLabel = r.screen === 'finale' ? 'FINALE' : `Encounter ${r.encounterIdx + 1}/${r.cfg.encounters}`;
    const roundLabel = r.screen === 'encounter' ? ` · Round ${r.enc.round}/${r.cfg.roundsPerEncounter}` : '';
    bar.appendChild(el('div', 'title', `GLASSWRIGHT <span class="dim">seed ${r.seed}</span>`));
    bar.appendChild(el('div', '', `${encLabel}${roundLabel}`));
    const gold = el('div', 'gold', `⬤ <span id="goldCounter">${r.gold}</span> gold`);
    bar.appendChild(gold);
    const relics = el('div', 'relicbar');
    for (const id of r.relics) {
        const def = RELICS.find(x => x.id === id);
        const chip = el('span', 'relicchip', def.name);
        chip.title = `${def.name} (${def.rarity}) — ${def.desc}`;
        relics.appendChild(chip);
    }
    bar.appendChild(relics);
    bar.appendChild(uiToggles());
    UI.displayed['goldCounter'] = r.gold;
    return bar;
}
function uiToggles() {
    const wrap = el('div', 'toggles');
    const mk = (label, title, on, fn) => {
        const b = el('button', 'toggle' + (on ? ' on' : ''), label);
        b.title = title;
        b.onclick = fn;
        wrap.appendChild(b);
    };
    mk('? rules', 'Full rules (H)', false, () => { UI.showRules = !UI.showRules; render(); });
    mk('⏩', 'Fast mode — skip roll/crack animations', UI.fastAnim, () => { UI.fastAnim = !UI.fastAnim; render(); });
    mk(AUDIO.sfxOn ? '🔊' : '🔇', 'Sound effects', AUDIO.sfxOn, () => { audioEnsure(); toggleSfx(); render(); });
    mk('♪', 'Music', AUDIO.musicOn, () => { audioEnsure(); toggleMusic(); render(); });
    return wrap;
}
function rulesModal() {
    const wrap = el('div', 'modal');
    wrap.onclick = (ev) => { if (ev.target === wrap) {
        UI.showRules = false;
        render();
    } };
    const card = el('div', 'modalcard');
    const need = {
        'lone': '1 die', 'pair': '2 equal', 'trips': '3 equal', 'two-pair': '2+2 equal',
        'straight-4': '4 in a row', 'full-house': '3 equal + 2 equal', 'four-kind': '4 equal',
        'flush-5': '5 of one color, any faces', 'straight-5': '5 in a row', 'five-kind': '5 equal',
        'straight-6': '1-2-3-4-5-6', 'six-kind': '6 equal',
    };
    const chartRows = Object.keys(CONFIG.prism).map(k => `<tr><td>${HAND_LABEL[k]}</td><td>${need[k]}</td><td>×${CONFIG.prism[k]}</td></tr>`).join('');
    card.innerHTML = `
    <div class="modalhead"><b>RULES OF THE GLASS</b><button class="closex">✕ close (H)</button></div>
    <h3>The Round <span class="dim">(3 per encounter)</span></h3>
    <ol>
      <li><b>ROLL</b> — your whole bag rolls into your tray. A market of neutral dice rolls beside it.</li>
      <li><b>DRAFT</b> — alternating picks, you first. The Artisan <i>announces</i> their pick before you choose; strikes are telegraphed too. Market dice are yours for this encounter only.</li>
      <li><b>REROLL</b> — up to 2 times: <b>select the dice to KEEP</b>; everything else rerolls.</li>
      <li><b>COMMIT</b> — group dice into hands (each die in at most one hand). Each hand scores <b>Light × Prism</b>.</li>
    </ol>
    <p><b>Light</b> = pip sum, warped by the Artisan's rule, plus special dice and relics.<br>
    <b>Prism</b> = the hand type (table below), plus color variants and bonuses.</p>
    <p>Uncommitted dice <b>carry</b> to the next round with faces kept. <b>Committed dice are spent</b> until the encounter ends — the bag is your budget for all 3 rounds.</p>
    <h3>Hands</h3>
    <table class="rulechart"><tr><th>Hand</th><th>Needs</th><th>Prism</th></tr>${chartRows}</table>
    <p><b>Color variants:</b> a hand entirely in ONE color is <b>Monochrome</b>; a hand where every die is a DIFFERENT color (3+ dice) is <b>Spectrum</b>. Both add <b>+1 Prism per 2 dice</b> in the hand (pair +1 … six dice +3). A Spectrum Five of a Kind (×9) beats a plain one (×7).</p>
    <p class="dim">Straights need distinct faces; Iris is any color; Quicksilver is any number.</p>
    <h3>The Artisan</h3>
    <p>Their pile scores <b>pips × accrual</b> (shown on the scoreboard), growing every draft. Beat their total after 3 rounds — <b>ties go to you</b>. Each Artisan warps your scoring differently; the warp is posted in their panel.</p>
    <h3>Between encounters</h3>
    <p><b>Tribute</b>: take 1 die and 1 relic, free. <b>Shop</b>: buy dice and relics, or pay to remove a die from your bag. Prices climb each encounter.</p>
    <h3>The Finale — the Iconoclast</h3>
    <ol>
      <li>He takes your <b>6 highest-scoring hands</b> of the run (only your best matter — extra small hands never feed him).</li>
      <li>He smashes them one at a time. From each you <b>reclaim up to HALF the dice (max 3)</b> — faces preserved exactly.</li>
      <li>Every die you DON'T reclaim: its pips fuel his Light, its specialness fuels his Prism.</li>
      <li>Then build hands from your reclaimed glass — no rerolls, no market — and out-score him. Ties go to you.</li>
    </ol>
    <h3>Unlocks</h3>
    <p class="dim">Wins (and every 4th run) unlock new Artisans, dice, and relics — permanently, on this machine.</p>
    <h3>Controls</h3>
    <p class="dim">Click dice or press <b>1-9, 0</b> to select · <b>R</b> keep selected &amp; reroll the rest · <b>C</b> commit · <b>X</b> suggest the best hand · <b>A</b> commit-all (last round / finale) · <b>S</b> toggle sort · <b>E</b>/<b>Enter</b> advance · <b>H</b> rules · <b>Esc</b> clear.</p>`;
    card.querySelector('.closex').onclick = () => { UI.showRules = false; render(); };
    wrap.appendChild(card);
    return wrap;
}
function selectionPreview() {
    const r = UI.run;
    const box = el('div', 'preview');
    const dice = selectedDice();
    if (dice.length === 0) {
        box.innerHTML = `<span class="dim">Select dice — they form your hand on commit, and are KEPT on reroll.</span>`;
        return box;
    }
    const ev = evaluateHand(dice, r.evalCtx(dice));
    if (!ev.ok) {
        box.innerHTML = `<span class="bad">${ev.reason}</span>`;
    }
    else {
        box.innerHTML = `<b>${handLabelFull(ev.type, ev.colorMod)}</b> — <span class="lightnum">${ev.light} Light</span> × <span class="prismnum">${ev.prism} Prism</span> = <b class="scorenum">${ev.score}</b>`
            + (ev.goldGained ? ` <span class="gold">+${ev.goldGained}g</span>` : '')
            + (ev.notes.length ? `<div class="notes">${ev.notes.join(' · ')}</div>` : '');
    }
    return box;
}
// Rough projection of the artisan's end-of-encounter score (min-maxer aid)
function artisanPace(r) {
    const e = r.enc;
    const remainingPicks = e.artisanPicksLeft + r.cfg.draftPicksPerSide * (r.cfg.roundsPerEncounter - e.round);
    const accrual = r.cfg.artisanAccrual[Math.min(r.encounterIdx, 3)];
    return e.artisanScore + Math.round(remainingPicks * 5.5 * accrual);
}
function sortButtons() {
    const wrap = el('span', 'sortbtns');
    const byNum = el('button', 'toggle' + (UI.sortMode === 'face' ? ' on' : ''), 'sort: 123');
    byNum.onclick = () => resortTray('face');
    const byCol = el('button', 'toggle' + (UI.sortMode === 'color' ? ' on' : ''), 'sort: color');
    byCol.onclick = () => resortTray('color');
    wrap.appendChild(byNum);
    wrap.appendChild(byCol);
    return wrap;
}
function watchlistNode(r) {
    const targets = r.smashTargets();
    if (targets.length === 0)
        return null;
    const line = el('div', 'watchlist');
    line.innerHTML = `<span class="dim" title="In the finale, the Iconoclast smashes your 6 best hands. These are currently his targets.">☠ The Iconoclast eyes:</span> ` +
        targets.map(t => `<span class="queuechip">${handLabelFull(t.type, t.colorMod)} (${t.score})</span>`).join(' ');
    return line;
}
// This encounter's commits — Crescendo/Chime planning + a sense of tempo
function committedStrip(r) {
    const mine = r.committedHistory.filter(h => h.encounterIdx === r.encounterIdx);
    if (mine.length === 0)
        return null;
    const line = el('div', 'watchlist');
    line.innerHTML = `<span class="dim">Committed this encounter:</span> ` +
        mine.map(h => `<span class="queuechip">R${h.round} ${handLabelFull(h.type, h.colorMod)} ${h.score}</span>`).join(' ');
    return line;
}
function bagRow(r) {
    const zone = el('div', 'zone');
    zone.appendChild(el('div', 'zonelabel', `YOUR BAG (${r.ownedDice.length} dice)`));
    const row = el('div', 'dicerow mini');
    for (const spec of r.ownedDice) {
        const node = dieNode({ spec, face: 0, carried: false, fromMarket: false }, { mini: true });
        node.querySelector('.face').textContent = '•';
        node.removeAttribute('data-die-id');
        row.appendChild(node);
    }
    zone.appendChild(row);
    return zone;
}
function renderEncounter() {
    const r = UI.run;
    const e = r.enc;
    const root = el('div', 'screen');
    root.appendChild(topBar());
    // Artisan panel (portrait + info)
    const ap = el('div', 'artisanpanel');
    const body = el('div', 'apbody');
    body.appendChild(portraitNode(e.artisan.id));
    const info = el('div', 'apinfo');
    const warpExtra = r.effectiveWarpId() === 'triad'
        ? ` Blessed: ${e.blessed.map(c => `<span class="ctag" style="background:${COLOR_HEX[c]}">${c}</span>`).join(' ')}` : '';
    const nameLine = el('div', 'artisanname', `${e.artisan.name} <span class="quip">${e.artisan.quip}</span>`);
    nameLine.title = e.artisan.flavor;
    info.appendChild(nameLine);
    let warpText = e.artisan.warpText;
    if (e.apprenticeWarpId) {
        const m = ARTISANS.find(a => a.id === e.apprenticeWarpId);
        warpText = `Mimicking ${m.name}: ${m.warpText}`;
    }
    info.appendChild(el('div', 'warpbox', `⚠ ${warpText}${warpExtra}`));
    info.appendChild(el('div', 'scriptline', `Takes: ${e.artisan.scriptText} · Pile: ${e.artisan.pileScoreText}`));
    if (e.removalPending && e.artisan.removalText) {
        info.appendChild(el('div', 'removalbanner', `☞ TELEGRAPH: ${e.artisan.removalText}`));
    }
    else if (e.removedDie) {
        info.appendChild(el('div', 'removaldone', `✕ Struck this round: ${e.removedDie.spec.color} ${e.removedDie.face}`));
    }
    const pileRow = el('div', 'pilerow');
    pileRow.appendChild(el('span', 'dim', `Their pile (${e.pile.length}):`));
    for (const d of e.pile)
        pileRow.appendChild(dieNode(d, { mini: true }));
    info.appendChild(pileRow);
    body.appendChild(info);
    ap.appendChild(body);
    root.appendChild(ap);
    // Scoreboard (warped pips shown so the artisan's math is checkable)
    const accrual = r.cfg.artisanAccrual[Math.min(r.encounterIdx, 3)];
    const warpedPips = e.artisan.pileWarpedPips(e.pile, e.blessed, { gold: r.gold, echoPips: e.echoPips });
    const lastRound = e.round >= r.cfg.roundsPerEncounter;
    const trailing = lastRound && e.phase !== 'draft' && e.playerScore < e.artisanScore;
    const sb = el('div', 'scoreboard');
    sb.innerHTML = `
    <div class="side you"><div class="lbl">YOU</div><div class="num" id="playerScore">${e.playerScore}</div></div>
    <div class="vs">vs</div>
    <div class="side them"><div class="lbl">${e.artisan.name.toUpperCase()}</div><div class="num" id="artisanScore">${e.artisanScore}</div>
    <div class="dim small">${warpedPips} warped pips × ${accrual} · on pace ≈ ${artisanPace(r)}</div></div>`;
    root.appendChild(sb);
    if (trailing) {
        root.appendChild(el('div', 'watchlist', `<span class="trailwarn">FINAL ROUND — you trail by ${e.artisanScore - e.playerScore}. Lose and the run ends.</span>`));
    }
    UI.displayed['playerScore'] = UI.displayed['playerScore'] !== undefined ? UI.displayed['playerScore'] : e.playerScore;
    UI.displayed['artisanScore'] = UI.displayed['artisanScore'] !== undefined ? UI.displayed['artisanScore'] : e.artisanScore;
    if (UI.displayed['playerScore'] > e.playerScore)
        UI.displayed['playerScore'] = e.playerScore;
    if (UI.displayed['artisanScore'] > e.artisanScore)
        UI.displayed['artisanScore'] = e.artisanScore;
    const intel = el('div', 'intel');
    const wl = watchlistNode(r);
    if (wl)
        intel.appendChild(wl);
    const cs = committedStrip(r);
    if (cs)
        intel.appendChild(cs);
    if (intel.childNodes.length > 0)
        root.appendChild(intel);
    // Market
    const mk = el('div', 'zone');
    const draftInfo = e.phase === 'draft'
        ? (e.removalPending ? 'The Artisan makes their move…' : `Draft — your pick (${e.playerPicksLeft} left; they get ${e.artisanPicksLeft})`)
        : 'Market (closed)';
    mk.appendChild(el('div', 'zonelabel', `MARKET · ${draftInfo}`));
    const mrow = el('div', 'dicerow');
    e.market.forEach((d, i) => {
        const isTele = i === e.telegraphIdx && e.phase === 'draft';
        const isDoomed = e.removalPending && i === e.removalIdx;
        const node = dieNode(d, { clickable: e.phase === 'draft' && !e.removalPending, telegraph: isTele, doomed: isDoomed });
        if (isTele)
            node.appendChild(el('div', 'telelabel', 'their pick'));
        if (isDoomed)
            node.appendChild(el('div', 'doomlabel', 'will strike'));
        node.onclick = () => actDraft(i);
        mrow.appendChild(node);
    });
    if (e.market.length === 0)
        mrow.appendChild(el('span', 'dim', 'empty'));
    mk.appendChild(mrow);
    root.appendChild(mk);
    // Tray
    const tz = el('div', 'zone');
    const tlabel = el('div', 'zonelabel');
    tlabel.appendChild(el('span', '', `YOUR TRAY (${e.tray.length}) · rerolls left: ${e.rerollsLeft} · `));
    tlabel.appendChild(sortButtons());
    tz.appendChild(tlabel);
    const trow = el('div', 'dicerow');
    const selectable = e.phase !== 'draft';
    for (const d of e.tray) {
        const node = dieNode(d, { clickable: selectable, selected: UI.sel.has(d.spec.id) });
        node.onclick = () => {
            if (!selectable)
                return;
            if (UI.sel.has(d.spec.id))
                UI.sel.delete(d.spec.id);
            else
                UI.sel.add(d.spec.id);
            render();
        };
        trow.appendChild(node);
    }
    if (e.tray.length === 0)
        trow.appendChild(el('span', 'dim', 'empty — everything committed'));
    tz.appendChild(trow);
    root.appendChild(tz);
    root.appendChild(selectionPreview());
    // Actions
    const act = el('div', 'actions');
    const chip = el('span', 'phasechip', e.phase === 'draft' ? 'PHASE: DRAFT' : 'PHASE: REROLL & COMMIT');
    act.appendChild(chip);
    if (e.phase === 'draft') {
        act.appendChild(el('div', 'dim', e.removalPending ? 'Watch the telegraph…' : 'Click a market die to draft it. You pick first; the marked die is their announced pick.'));
    }
    else {
        const rerollCount = e.tray.length - UI.sel.size;
        const rr = el('button', '', UI.sel.size === 0
            ? `Reroll ALL ${e.tray.length} (R) · ${e.rerollsLeft} left`
            : `Keep ${UI.sel.size}, reroll ${rerollCount} (R) · ${e.rerollsLeft} left`);
        rr.disabled = e.rerollsLeft <= 0 || rerollCount === 0 || e.tray.length === 0;
        rr.onclick = actReroll;
        act.appendChild(rr);
        const cm = el('button', 'primary', 'Commit hand (C)');
        cm.disabled = UI.sel.size === 0;
        cm.onclick = actCommit;
        act.appendChild(cm);
        const sg = el('button', '', 'Suggest (X)');
        sg.disabled = e.tray.length === 0;
        sg.title = 'Highlight the highest-scoring hand in your tray';
        sg.onclick = actSuggest;
        act.appendChild(sg);
        if (e.round >= r.cfg.roundsPerEncounter) {
            const ac = el('button', '', 'Commit all (A)');
            ac.disabled = e.tray.length === 0;
            ac.title = 'Last round: greedily commit the whole tray as its best splits';
            ac.onclick = actAutoCommit;
            act.appendChild(ac);
        }
        const er = el('button', 'warn', `End round (E)${e.tray.length > 0 ? ` · ${e.tray.length} carry` : ''}`);
        er.title = 'Uncommitted dice carry to the next round with faces kept';
        er.onclick = actEndRound;
        act.appendChild(er);
    }
    root.appendChild(act);
    root.appendChild(handChartNode());
    root.appendChild(renderLog());
    return root;
}
function renderLog() {
    const lg = el('div', 'log');
    lg.innerHTML = UI.log.map(l => `<div>${l}</div>`).join('');
    return lg;
}
function renderTribute() {
    const r = UI.run;
    const t = r.tribute;
    const root = el('div', 'screen');
    root.appendChild(topBar());
    root.appendChild(el('h2', '', 'TRIBUTE — take one die and one relic'));
    const dz = el('div', 'zone');
    dz.appendChild(el('div', 'zonelabel', t.diePicked ? 'DIE — taken' : 'CHOOSE A DIE'));
    const drow = el('div', 'cardrow');
    t.dieOffers.forEach((o, i) => {
        const sp = o.specialId ? SPECIALS.find(s => s.id === o.specialId) : null;
        const card = el('div', 'card' + (t.diePicked ? ' spent' : ' clickable'));
        card.appendChild(offerDieNode(o));
        card.appendChild(el('div', 'cardname', sp ? `${sp.name} <span class="rarity ${sp.rarity}">${sp.rarity}</span>` : `${o.color} die`));
        card.appendChild(el('div', 'carddesc', sp ? sp.desc : 'Plain glass. Rolls 1-6.'));
        card.onclick = () => { if (!t.diePicked) {
            r.pickTributeDie(i);
            sfxPick();
            uiLog(`Tribute die: ${sp ? sp.name : o.color}.`);
            render();
        } };
        drow.appendChild(card);
    });
    dz.appendChild(drow);
    root.appendChild(dz);
    const rz = el('div', 'zone');
    rz.appendChild(el('div', 'zonelabel', t.relicPicked ? 'RELIC — taken' : 'CHOOSE A RELIC'));
    const rrow = el('div', 'cardrow');
    t.relicOffers.forEach((id, i) => {
        const def = RELICS.find(x => x.id === id);
        const card = el('div', 'card' + (t.relicPicked ? ' spent' : ' clickable'));
        card.appendChild(el('div', 'cardname', `${def.name} <span class="rarity ${def.rarity}">${def.rarity}</span>`));
        card.appendChild(el('div', 'carddesc', def.desc));
        card.onclick = () => { if (!t.relicPicked) {
            r.pickTributeRelic(i);
            sfxGold();
            uiLog(`Tribute relic: ${def.name}.`);
            render();
        } };
        rrow.appendChild(card);
    });
    if (t.relicOffers.length === 0)
        rrow.appendChild(el('span', 'dim', 'No relics left in the world.'));
    rz.appendChild(rrow);
    root.appendChild(rz);
    root.appendChild(bagRow(r)); // choose with your whole bag in view
    root.appendChild(renderLog());
    return root;
}
function renderShop() {
    const r = UI.run;
    const s = r.shop;
    const root = el('div', 'screen');
    root.appendChild(topBar());
    root.appendChild(el('h2', '', 'SHOP'));
    const dz = el('div', 'zone');
    dz.appendChild(el('div', 'zonelabel', 'DICE'));
    const drow = el('div', 'cardrow');
    s.dieOffers.forEach((o, i) => {
        const card = el('div', 'card');
        if (!o) {
            card.classList.add('spent');
            card.appendChild(el('div', 'cardname', 'SOLD'));
            drow.appendChild(card);
            return;
        }
        const sp = o.specialId ? SPECIALS.find(x => x.id === o.specialId) : null;
        card.appendChild(offerDieNode(o));
        card.appendChild(el('div', 'cardname', sp ? `${sp.name} <span class="rarity ${sp.rarity}">${sp.rarity}</span>` : `${o.color} die`));
        card.appendChild(el('div', 'carddesc', sp ? sp.desc : 'Plain glass.'));
        const price = r.priceOf(o.price);
        const buy = el('button', '', `Buy · ${price}g`);
        buy.disabled = r.gold < price;
        buy.onclick = () => { if (r.buyShopDie(i)) {
            sfxGold();
            uiLog(`Bought ${sp ? sp.name : o.color + ' die'}.`);
            render();
        } };
        card.appendChild(buy);
        drow.appendChild(card);
    });
    dz.appendChild(drow);
    root.appendChild(dz);
    const rz = el('div', 'zone');
    rz.appendChild(el('div', 'zonelabel', 'RELICS'));
    const rrow = el('div', 'cardrow');
    s.relicOffers.forEach((o, i) => {
        const card = el('div', 'card');
        if (!o) {
            card.classList.add('spent');
            card.appendChild(el('div', 'cardname', 'SOLD'));
            rrow.appendChild(card);
            return;
        }
        const def = RELICS.find(x => x.id === o.id);
        card.appendChild(el('div', 'cardname', `${def.name} <span class="rarity ${def.rarity}">${def.rarity}</span>`));
        card.appendChild(el('div', 'carddesc', def.desc));
        const price = r.priceOf(o.price);
        const buy = el('button', '', `Buy · ${price}g`);
        buy.disabled = r.gold < price;
        buy.onclick = () => { if (r.buyShopRelic(i)) {
            sfxGold();
            uiLog(`Bought ${def.name}.`);
            render();
        } };
        card.appendChild(buy);
        rrow.appendChild(card);
    });
    if (s.relicOffers.length === 0)
        rrow.appendChild(el('span', 'dim', 'Nothing left.'));
    rz.appendChild(rrow);
    root.appendChild(rz);
    // Bag + remove service
    const bz = el('div', 'zone');
    const removePrice = r.priceOf(s.removePrice);
    bz.appendChild(el('div', 'zonelabel', `YOUR BAG (${r.ownedDice.length} dice) · click a die to REMOVE it for ${removePrice}g (min bag 6)`));
    const brow = el('div', 'dicerow');
    for (const spec of r.ownedDice) {
        const node = dieNode({ spec, face: 0, carried: false, fromMarket: false }, { clickable: true });
        node.querySelector('.face').textContent = '•';
        node.onclick = () => {
            if (r.gold < removePrice || r.ownedDice.length <= 6) {
                spawnBanner(r.ownedDice.length <= 6 ? 'Bag cannot go below 6' : 'Not enough gold', 'bad');
                return;
            }
            const sp = specialOf(spec);
            if (r.removeOwnedDie(spec.id)) {
                sfxStrike();
                uiLog(`Removed ${sp ? sp.name : spec.color + ' die'} from the bag.`);
                render();
            }
        };
        brow.appendChild(node);
    }
    bz.appendChild(brow);
    root.appendChild(bz);
    const act = el('div', 'actions');
    const next = r.encounterIdx + 1 < r.cfg.encounters - 1 ? `Encounter ${r.encounterIdx + 2}` : 'THE ICONOCLAST';
    const leave = el('button', 'primary', `Leave shop → ${next} (E)`);
    leave.onclick = actAdvance;
    act.appendChild(leave);
    root.appendChild(act);
    root.appendChild(renderLog());
    return root;
}
function renderFinale() {
    const r = UI.run;
    const f = r.finale;
    const root = el('div', 'screen');
    root.appendChild(topBar());
    const ap = el('div', 'artisanpanel');
    const body = el('div', 'apbody');
    body.appendChild(portraitNode('iconoclast'));
    const info = el('div', 'apinfo');
    info.appendChild(el('div', 'artisanname', `${ICONOCLAST.name} <span class="dim">— ${ICONOCLAST.flavor}</span>`));
    info.appendChild(el('div', 'quip', ICONOCLAST.quip));
    info.appendChild(el('div', 'warpbox', `⚠ HOW THIS WORKS: <b>1.</b> He smashes your ${f.smashQueue.length} best hands, one at a time. ` +
        `<b>2.</b> From each, RECLAIM up to HALF the dice (max ${r.cfg.finale.claimCap}) — faces frozen as committed. ` +
        `<b>3.</b> Everything you abandon fuels him. <b>4.</b> Then build hands from your reclaimed glass and beat his total.`));
    info.appendChild(el('div', 'scriptline', `His Light = ${r.cfg.finale.lightScale} × abandoned pips (${f.unclaimedPips} so far). His Prism = 1 + ${r.cfg.finale.specialPrismWeight} per abandoned special (${f.unclaimedSpecials}) + ${r.cfg.finale.colorVarietyBonus} if ${r.cfg.finale.colorVarietyThreshold}+ colors abandoned (${f.unclaimedColors.length}).`));
    body.appendChild(info);
    ap.appendChild(body);
    root.appendChild(ap);
    const sb = el('div', 'scoreboard');
    sb.innerHTML = `
    <div class="side you"><div class="lbl">YOU</div><div class="num" id="finalePlayerScore">${f.playerScore}</div></div>
    <div class="vs">vs</div>
    <div class="side them"><div class="lbl">THE ICONOCLAST</div><div class="num" id="iconoScore">${f.iconoScore}</div>
    <div class="dim small">${f.iconoLight} Light × ${f.iconoPrism.toFixed(1)} Prism</div></div>`;
    root.appendChild(sb);
    UI.displayed['finalePlayerScore'] = UI.displayed['finalePlayerScore'] !== undefined ? UI.displayed['finalePlayerScore'] : f.playerScore;
    UI.displayed['iconoScore'] = UI.displayed['iconoScore'] !== undefined ? UI.displayed['iconoScore'] : f.iconoScore;
    if (f.phase === 'smash') {
        const hand = f.smashQueue[f.smashIdx];
        const allow = r.claimAllowance(hand);
        const hz = el('div', 'zone smashzone');
        hz.appendChild(el('div', 'zonelabel', `SMASH ${f.smashIdx + 1}/${f.smashQueue.length} — your ${HAND_LABEL[hand.type]} from encounter ${hand.encounterIdx + 1} (scored ${hand.score}). RECLAIM up to ${allow} of its ${hand.dice.length} dice; he keeps the rest.`));
        const hrow = el('div', 'dicerow');
        hand.dice.forEach((d, i) => {
            const node = snapshotDieNode(d, { clickable: true, selected: UI.smashSel.has(i) });
            node.onclick = () => {
                if (UI.animLock)
                    return;
                if (UI.smashSel.has(i))
                    UI.smashSel.delete(i);
                else if (UI.smashSel.size < allow)
                    UI.smashSel.add(i);
                render();
            };
            hrow.appendChild(node);
        });
        hz.appendChild(hrow);
        const act = el('div', 'actions');
        const claim = el('button', 'primary', `Reclaim ${UI.smashSel.size}/${allow} — he smashes ${hand.dice.length - UI.smashSel.size} (E)`);
        claim.onclick = actClaim;
        act.appendChild(claim);
        hz.appendChild(act);
        root.appendChild(hz);
        const up = el('div', 'zone');
        up.appendChild(el('div', 'zonelabel', 'STILL STANDING (he comes for these next)'));
        const uprow = el('div', 'queuerow');
        f.smashQueue.slice(f.smashIdx + 1).forEach(h => {
            uprow.appendChild(el('span', 'queuechip', `${handLabelFull(h.type, h.colorMod)} (${h.score})`));
        });
        if (f.smashIdx + 1 >= f.smashQueue.length)
            uprow.appendChild(el('span', 'dim', 'nothing — this is the last'));
        up.appendChild(uprow);
        root.appendChild(up);
    }
    const tz = el('div', 'zone');
    const tl = el('div', 'zonelabel');
    tl.appendChild(el('span', '', `RECLAIMED GLASS (${f.finalTray.length}) — faces preserved · `));
    tl.appendChild(sortButtons());
    tz.appendChild(tl);
    const trow = el('div', 'dicerow');
    for (const d of f.finalTray) {
        const node = dieNode(d, { clickable: f.phase === 'commit', selected: UI.sel.has(d.spec.id) });
        node.onclick = () => {
            if (f.phase !== 'commit')
                return;
            if (UI.sel.has(d.spec.id))
                UI.sel.delete(d.spec.id);
            else
                UI.sel.add(d.spec.id);
            render();
        };
        trow.appendChild(node);
    }
    if (f.finalTray.length === 0)
        trow.appendChild(el('span', 'dim', 'nothing reclaimed yet'));
    tz.appendChild(trow);
    root.appendChild(tz);
    if (f.phase === 'commit') {
        if (f.playerScore < f.iconoScore) {
            root.appendChild(el('div', 'watchlist', `<span class="trailwarn">He stands at ${f.iconoScore} — you need ${f.iconoScore - f.playerScore} more. Ties go to you.</span>`));
        }
        root.appendChild(selectionPreview());
        const act = el('div', 'actions');
        const cm = el('button', 'primary', 'Commit hand (C)');
        cm.disabled = UI.sel.size === 0;
        cm.onclick = actCommit;
        act.appendChild(cm);
        const sg = el('button', '', 'Suggest (X)');
        sg.disabled = f.finalTray.length === 0;
        sg.onclick = actSuggest;
        act.appendChild(sg);
        const ac = el('button', '', 'Commit all (A)');
        ac.disabled = f.finalTray.length === 0;
        ac.title = 'Greedily commit all reclaimed glass as its best splits';
        ac.onclick = actAutoCommit;
        act.appendChild(ac);
        const done = el('button', 'warn', 'Face judgment (E)');
        done.onclick = finishFinaleWithSound;
        act.appendChild(done);
        root.appendChild(act);
        root.appendChild(handChartNode());
    }
    root.appendChild(renderLog());
    return root;
}
function renderEnd() {
    const r = UI.run;
    const root = el('div', 'screen');
    const win = r.result === 'win';
    const head = el('div', 'endhead');
    const killer = win ? 'iconoclast'
        : (ARTISANS.find(a => r.lossReason.indexOf(a.name) >= 0) || ICONOCLAST).id;
    head.appendChild(portraitNode(killer, win ? 'defeated' : ''));
    const headtx = el('div', '');
    headtx.appendChild(el('h1', win ? 'endwin' : 'endloss', win ? 'THE CATHEDRAL STANDS' : 'SHATTERED'));
    headtx.appendChild(el('div', 'lossreason', win ? 'The Iconoclast lowers his hammer.' : r.lossReason));
    head.appendChild(headtx);
    root.appendChild(head);
    if (UI.newUnlocks.length > 0) {
        const un = el('div', 'unlocktoast');
        un.innerHTML = `<b>UNLOCKED:</b> ` + UI.newUnlocks.map(u => `<span class="queuechip gold">${u.label}</span>`).join(' ');
        root.appendChild(un);
    }
    const next = metaNext(UI.meta);
    if (next)
        root.appendChild(el('div', 'dim', `Next unlock: ${next.label} — win a run (or keep playing) to earn it.`));
    const pm = el('div', 'zone');
    pm.appendChild(el('div', 'zonelabel', 'POST-MORTEM'));
    const table = el('table', 'pmtable');
    table.innerHTML = `<tr><th></th><th>You</th><th>Them</th><th></th><th></th></tr>` +
        r.stats.encounterResults.map((er, i) => {
            const total = Math.max(1, er.player + er.artisan);
            const pct = Math.round(100 * er.player / total);
            return `<tr><td>${i + 1}. ${er.name}</td><td>${er.player}</td><td>${er.artisan}</td>` +
                `<td>${er.player >= er.artisan ? '<span class="good">WON</span>' : '<span class="bad">LOST</span>'}</td>` +
                `<td><div class="marginbar"><div class="you" style="width:${pct}%"></div></div></td></tr>`;
        }).join('');
    pm.appendChild(table);
    if (r.stats.biggestHand) {
        const bh = r.stats.biggestHand;
        pm.appendChild(el('div', 'zonelabel', `BIGGEST HAND — ${handLabelFull(bh.type, bh.colorMod)}, ${bh.light} × ${bh.prism} = ${bh.score}`));
        const row = el('div', 'dicerow');
        bh.dice.forEach(d => row.appendChild(snapshotDieNode(d)));
        pm.appendChild(row);
    }
    pm.appendChild(el('div', 'dim', `Hands committed: ${r.stats.handsCommitted} · Gold earned: ${r.stats.goldEarned} · Final bag: ${r.ownedDice.length} dice · Seed: ${r.seed} · Career: ${UI.meta.wins}W / ${UI.meta.runs} runs`));
    root.appendChild(pm);
    const act = el('div', 'actions');
    const again = el('button', 'primary', 'New run (E)');
    again.onclick = () => { UI.run = null; render(); };
    act.appendChild(again);
    const replay = el('button', '', 'Replay this seed');
    replay.onclick = () => {
        UI.run = new GWRun(r.seed, undefined, currentPools());
        UI.log = [];
        UI.displayed = {};
        UI.newUnlocks = [];
        clearSel();
        render();
        playRollAnimation();
    };
    act.appendChild(replay);
    root.appendChild(act);
    return root;
}
function renderMenu() {
    const root = el('div', 'screen menu');
    root.appendChild(el('h1', '', 'GLASSWRIGHT'));
    root.appendChild(el('div', 'menudesc', `Roll your bag. Draft against Artisans who announce every move. Commit <b>hands</b> — each scores <b>Light × Prism</b>. Survive four masters; the fifth is the Iconoclast, who smashes your finest work and weighs what you abandon.`));
    // Roster gallery: unlocked artisans show their face; locked show a shadow
    const unlockedArtisans = new Set(BASE_ARTISAN_IDS.concat(metaUnlockedIds(UI.meta, 'artisan')));
    const gallery = el('div', 'gallery');
    const roster = ARTISANS.map(a => ({ id: a.id, name: a.name })).concat([{ id: 'iconoclast', name: ICONOCLAST.name }]);
    for (const a of roster) {
        const isUnlocked = a.id === 'iconoclast' || unlockedArtisans.has(a.id);
        const fig = el('div', 'galleryfig');
        fig.appendChild(portraitNode(a.id, 'small' + (isUnlocked ? '' : ' locked')));
        fig.appendChild(el('div', 'galleryname', isUnlocked ? a.name : '???'));
        gallery.appendChild(fig);
    }
    root.appendChild(gallery);
    const rungs = metaRungs(UI.meta);
    const next = metaNext(UI.meta);
    root.appendChild(el('div', 'unlockline', `Unlocked ${Math.min(rungs, UNLOCK_LADDER.length)}/${UNLOCK_LADDER.length}` +
        (next ? ` · next: <b>${next.label}</b> (win a run, or every 4th run)` : ' · everything is unlocked. The cathedral is yours.') +
        ` · career ${UI.meta.wins}W/${UI.meta.runs}`));
    const form = el('div', 'menuform');
    const seed = Math.random().toString(36).slice(2, 8);
    form.innerHTML = `<label>Seed <input id="seedbox" value="${seed}" spellcheck="false"></label>`;
    const start = el('button', 'primary big', 'Begin the run (Enter)');
    start.onclick = startRunFromMenu;
    form.appendChild(start);
    root.appendChild(form);
    root.appendChild(handChartNode());
    root.appendChild(el('div', 'menudesc dim small', 'Keys: 1-9 select · R keep &amp; reroll rest · C commit · X suggest · S sort · E advance · H full rules.'));
    return root;
}
// ---------- Keyboard ----------
function onKey(ev) {
    if (ev.target.tagName === 'INPUT') {
        if (ev.key === 'Enter')
            startRunFromMenu();
        return;
    }
    const r = UI.run;
    const k = ev.key.toLowerCase();
    if (k === 'h' || k === '?') {
        UI.showRules = !UI.showRules;
        render();
        return;
    }
    if (k === 'escape' && UI.showRules) {
        UI.showRules = false;
        render();
        return;
    }
    if (k === 'enter' || k === 'e') {
        actAdvance();
        return;
    }
    if (!r)
        return;
    if (k === 'escape') {
        clearSel();
        render();
        return;
    }
    if (k === 's') {
        resortTray(UI.sortMode === 'face' ? 'color' : 'face');
        return;
    }
    if (UI.animLock)
        return;
    if (k === 'r') {
        actReroll();
        return;
    }
    if (k === 'c') {
        actCommit();
        return;
    }
    if (k === 'x') {
        actSuggest();
        return;
    }
    if (k === 'a') {
        actAutoCommit();
        return;
    }
    if (k >= '0' && k <= '9') {
        const idx = k === '0' ? 9 : parseInt(k, 10) - 1;
        if (r.screen === 'encounter' && r.enc.phase === 'draft') {
            if (idx < r.enc.market.length)
                actDraft(idx);
            return;
        }
        if (r.screen === 'finale' && r.finale.phase === 'smash') {
            const f = r.finale;
            const hand = f.smashQueue[f.smashIdx];
            const allow = r.claimAllowance(hand);
            if (idx < hand.dice.length) {
                if (UI.smashSel.has(idx))
                    UI.smashSel.delete(idx);
                else if (UI.smashSel.size < allow)
                    UI.smashSel.add(idx);
                render();
            }
            return;
        }
        const tray = currentTray();
        if (idx < tray.length) {
            const id = tray[idx].spec.id;
            if (UI.sel.has(id))
                UI.sel.delete(id);
            else
                UI.sel.add(id);
            render();
        }
    }
}
// ---------- Boot ----------
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        UI.meta = metaLoad();
        // honor the OS reduced-motion preference
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                UI.fastAnim = true;
        }
        catch { /* ignore */ }
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', audioEnsure);
        document.addEventListener('keydown', audioEnsure);
        render();
    });
    // an accidental F5/close should not silently kill a live run
    window.addEventListener('beforeunload', (ev) => {
        if (UI.run && !UI.run.result) {
            ev.preventDefault();
            ev.returnValue = '';
        }
    });
}
