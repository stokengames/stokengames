/* Cardwright — duel AI. Per spec: play highest-value legal card,
 * attack when favorable. Shared by NPC opponents and the sim harness. */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  // Static card value: used for play priority and deck building.
  CW.cardValue = function (def) {
    let v = def.cost * 2;
    v += CW.RARITIES[def.rarity].weight * 0.75;
    if (def.type === 'creature') {
      v += (def.power + def.health) * 0.35;
      if (def.kw.includes('swift')) v += 0.8;
      if (def.kw.includes('shadow')) v += 1.1;
      if (def.kw.includes('venom')) v += 1.0;
      v += def.armor * 0.9;
    }
    for (const fx of def.fx) {
      switch (fx.k) {
        case 'dmg': v += fx.n * (fx.t === 'allEnemy' ? 1.0 : 0.55); break;
        case 'heal': v += fx.n * 0.3; break;
        case 'buff': v += (fx.p + fx.h) * (fx.t === 'allFriendly' ? 0.8 : 0.45); break;
        case 'debuff': v += (fx.p + fx.h) * (fx.t === 'allEnemy' ? 1.1 : 0.55); break;
        case 'destroy': v += fx.maxCost !== undefined ? 1.6 : (fx.maxPower !== undefined ? 2.4 : 3.4); break;
        case 'draw': v += fx.n * 1.4; break;
        case 'token': v += (fx.p + fx.h) * 0.5 + 0.5; break;
        case 'ready': v += 0.4; break;
      }
    }
    if (def.type === 'enchant') v += 1.2;
    return v;
  };

  // Pick the best play for the active player. Returns {handIndex, targets} or null.
  CW.aiChoosePlay = function (duel, pIdx) {
    const p = duel.players[pIdx], foe = duel.players[1 - pIdx];
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < p.hand.length; i++) {
      if (!duel.canPlay(pIdx, i)) continue;
      const def = CW.CARDS[p.hand[i]];
      const plan = planTargets(duel, pIdx, def);
      if (!plan) continue; // no worthwhile use right now
      let score = CW.cardValue(def) + plan.bonus;
      // Spend mana efficiently late; prefer curve plays.
      score += Math.min(def.cost, p.mana) * 0.15;
      if (score > bestScore) { bestScore = score; best = { handIndex: i, targets: plan.targets }; }
    }
    return best;
  };

  // Decide targets for a card's effects; returns {targets, bonus} or null to skip.
  function planTargets(duel, pIdx, def) {
    const p = duel.players[pIdx], foe = duel.players[1 - pIdx];
    const targets = {};
    let bonus = 0;
    for (const fx of def.fx) {
      switch (fx.k) {
        case 'dmg': {
          if (fx.t === 'allEnemy') {
            const kills = foe.board.filter(c => duel.health(c) <= fx.n).length;
            if (def.type === 'instant' && kills === 0 && foe.board.length < 2) return null;
            bonus += kills * 2 + foe.board.length * 0.5;
          } else if (fx.t === 'face') {
            if (foe.life <= fx.n) bonus += 100; // lethal!
            else bonus += fx.n * 0.4;
          } else { // ecreature / any
            const kill = pickBest(foe.board.filter(c => duel.health(c) <= fx.n), c => threat(duel, c));
            if (kill) { targets.creature = kill.uid; bonus += threat(duel, kill) + 1.5; }
            else if (fx.t === 'any') {
              if (foe.life <= fx.n) { bonus += 100; } // burn for lethal, leave target empty
              else if (def.type === 'instant') {
                const dent = pickBest(foe.board.filter(c => duel.health(c) > fx.n && threat(duel, c) >= 4), c => threat(duel, c));
                if (dent) { targets.creature = dent.uid; bonus += 1; }
                else bonus += fx.n * 0.3; // chip the face
              }
            } else if (fx.t === 'ecreature') {
              const dent = pickBest(foe.board, c => threat(duel, c));
              if (!dent) return null;
              targets.creature = dent.uid; bonus += Math.min(fx.n, duel.health(dent)) * 0.6;
            }
          }
          break;
        }
        case 'heal': {
          const maxLife = CW.RULES ? CW.RULES.life : 15;
          if (def.type === 'instant' && p.life >= maxLife - 2) return null; // don't waste it
          bonus += Math.min(fx.n, maxLife - p.life) * 0.45;
          break;
        }
        case 'buff': {
          if (fx.t === 'allFriendly') {
            if (def.type === 'instant' && p.board.length < 2) return null;
            bonus += p.board.length * (fx.p + fx.h) * 0.4;
          } else {
            const c = pickBest(p.board, c => duel.power(c) + duel.health(c));
            if (!c) { if (def.type === 'instant') return null; break; }
            targets.creature = c.uid; bonus += (fx.p + fx.h) * 0.5;
          }
          break;
        }
        case 'debuff': {
          if (fx.t === 'allEnemy') { bonus += foe.board.length * 1.2; break; }
          const c = pickBest(foe.board.filter(x => duel.power(x) > 0), c => duel.power(c));
          if (!c) { if (def.type === 'instant') return null; break; }
          targets.creature = c.uid; bonus += Math.min(fx.p, duel.power(c)) * 0.7;
          break;
        }
        case 'destroy': {
          const pool = foe.board.filter(c =>
            (fx.maxCost === undefined || c.token || c.def.cost <= fx.maxCost) &&
            (fx.maxPower === undefined || duel.power(c) <= fx.maxPower));
          const c = pickBest(pool, c => threat(duel, c));
          if (!c) return null;
          // Don't burn unconditional removal on chaff unless pressured.
          if (def.type === 'instant' && fx.maxCost === undefined && fx.maxPower === undefined
            && threat(duel, c) < 4 && p.life > 10) return null;
          targets.creature = c.uid; bonus += threat(duel, c) + 1;
          break;
        }
        case 'token': bonus += 1.2; break;
        case 'draw': bonus += 1.0; break;
        case 'ready': bonus += 0.5; break;
      }
    }
    return { targets, bonus };
  }

  // Shadow can't be blocked and venom trades up infinitely — both demand answers.
  // For UI: sensible automatic targets for a card's on-play effects.
  CW.aiPlanTargets = function (duel, pIdx, def) {
    const plan = planTargets(duel, pIdx, def);
    return plan ? plan.targets : {};
  };

  function threat(duel, c) {
    return duel.power(c) * 1.2 + duel.health(c) * 0.5 + duel.armor(c)
      + (c.def.kw.includes('shadow') ? 3 : 0)
      + (c.def.kw.includes('venom') ? 2.5 : 0);
  }
  function pickBest(arr, fn) {
    let best = null, bs = -Infinity;
    for (const x of arr) { const s = fn(x); if (s > bs) { bs = s; best = x; } }
    return best;
  }

  // Attack when favorable: predict the defender's best response per attacker.
  CW.aiChooseAttackers = function (duel, pIdx) {
    const p = duel.players[pIdx], foe = duel.players[1 - pIdx];
    const ready = duel.validAttackers().filter(c => c.owner === pIdx);
    if (!ready.length) return [];

    // If everything connects (or trades) and totals lethal, go all in.
    const totalPow = ready.reduce((s, c) => s + duel.power(c), 0);
    const blockersAvail = foe.board.length;
    if (totalPow >= foe.life && ready.length > blockersAvail) return ready.map(c => c.uid);

    const out = [];
    for (const a of ready) {
      const aPow = duel.power(a), aHp = duel.health(a), aArm = duel.armor(a);
      const canBeBlockedBy = foe.board.filter(b => duel.canBlock(b, a));
      if (!canBeBlockedBy.length) { out.push(a.uid); continue; } // free hit
      // Worst case: the blocker that beats us most efficiently.
      let unfavorable = false;
      for (const b of canBeBlockedBy) {
        const dies = Math.max(0, duel.power(b) - aArm) >= aHp || (duel.power(b) > aArm && b.def.kw.includes('venom'));
        const kills = Math.max(0, aPow - duel.armor(b)) >= duel.health(b) || (aPow > duel.armor(b) && a.def.kw.includes('venom'));
        if (dies && !kills) { unfavorable = true; break; }
        if (dies && kills && threat(duel, b) < threat(duel, a) - 1.5) { unfavorable = true; break; }
      }
      if (!unfavorable) out.push(a.uid);
    }
    // Aggression valve: if we're clearly ahead on board, swing everything.
    if (!out.length && totalPow >= foe.life * 0.5 && p.life > foe.life) {
      return ready.map(c => c.uid);
    }
    return out;
  };

  // Defender assigns blockers. Priorities: stop lethal, take good trades, save chumps.
  CW.aiChooseBlockers = function (duel, pIdx, attackerUids) {
    const p = duel.players[pIdx];
    const attackers = attackerUids
      .map(u => duel.players[1 - pIdx].board.find(c => c.uid === u))
      .filter(Boolean)
      .sort((a, b) => duel.power(b) - duel.power(a));
    const free = new Set(p.board);
    const blocks = {};
    const incoming = attackers.reduce((s, a) => s + duel.power(a), 0);
    const mustStop = incoming >= p.life;

    for (const a of attackers) {
      const aPow = duel.power(a);
      const candidates = [...free].filter(b => duel.canBlock(b, a));
      if (!candidates.length) continue;
      let choice = null;
      // 1) Kill it and survive.
      choice = pickBest(candidates.filter(b =>
        killsAttacker(duel, b, a) && !diesBlocking(duel, b, a)),
        b => -threat(duel, b));
      // 2) Trade up or even.
      if (!choice) {
        choice = pickBest(candidates.filter(b =>
          killsAttacker(duel, b, a) && threat(duel, a) >= threat(duel, b) - 0.5),
          b => -threat(duel, b));
      }
      // 3) Absorb safely (survives, doesn't kill — still saves face damage).
      if (!choice) {
        choice = pickBest(candidates.filter(b => !diesBlocking(duel, b, a) && aPow >= 2),
          b => -threat(duel, b));
      }
      // 4) Chump-block only under lethal pressure.
      if (!choice && mustStop) {
        choice = pickBest(candidates, b => -threat(duel, b));
      }
      if (choice) { blocks[a.uid] = choice.uid; free.delete(choice); }
    }
    return blocks;
  };

  function killsAttacker(duel, b, a) {
    const dmg = Math.max(0, duel.power(b) - duel.armor(a));
    return dmg >= duel.health(a) || (dmg > 0 && b.def.kw.includes('venom'));
  }
  function diesBlocking(duel, b, a) {
    const dmg = Math.max(0, duel.power(a) - duel.armor(b));
    return dmg >= duel.health(b) || (dmg > 0 && a.def.kw.includes('venom'));
  }

  // Aspirational deck templates — what experienced players build toward.
  // Order matters: earlier cards are the archetype's core.
  CW.ARCHETYPE_TEMPLATES = {
    bigroot: ['yewla', 'mossback_colossus', 'ancient_canopy', 'oakhide_bear', 'trellis_guardian',
      'bramble_boar', 'bramble_boar', 'growth_spurt', 'thornhare', 'acorn_sprite'],
    shadowtempo: ['velvet_assassin', 'duskwing_matron', 'moonlit_veil', 'moonlit_veil', 'lantern_thief',
      'lantern_thief', 'alley_whisper', 'alley_whisper', 'dusk_moth', 'dusk_moth'],
    cogswarm: ['grand_orrery', 'assembly_line', 'boiler_brute', 'foundry_alchemist', 'steam_porter',
      'overclock', 'brassbeak_owl', 'windup_soldier', 'tin_scuttler', 'tin_scuttler'],
    burn: ['heart_of_the_forge', 'pyre_dancer', 'slag_loper', 'flare', 'flare', 'kindle',
      'emberhound', 'emberhound', 'cinder_imp', 'sparkwhelp'],
    venomctl: ['whisper_of_endings', 'velvet_assassin', 'nightshade_draught', 'gloom_widow', 'gloom_widow',
      'marsh_adder', 'marsh_adder', 'fade', 'pinprick', 'dusk_moth'],
  };

  // Build toward an archetype template with whatever the collection can supply.
  // Gaps are filled by highest-value owned cards (curve-capped).
  CW.buildArchetype = function (collection, templateName) {
    const tmpl = CW.ARCHETYPE_TEMPLATES[templateName];
    const pool = {};
    for (const id in collection) pool[id] = collection[id];
    const deck = [];
    let supplied = 0;
    for (const want of tmpl) {
      if (pool[want] > 0) { pool[want]--; deck.push(want); supplied += CW.cardValue(CW.CARDS[want]); }
    }
    const rest = [];
    for (const id in pool) for (let i = 0; i < pool[id]; i++) rest.push(id);
    rest.sort((a, b) => CW.cardValue(CW.CARDS[b]) - CW.cardValue(CW.CARDS[a]));
    let heavies = deck.filter(id => CW.CARDS[id].cost >= 4).length;
    for (const id of rest) {
      if (deck.length >= 10) break;
      if (CW.CARDS[id].cost >= 4 && heavies >= 4) continue;
      if (CW.CARDS[id].cost >= 4) heavies++;
      deck.push(id);
    }
    for (const id of rest) { if (deck.length >= 10) break; deck.push(id); }
    return { deck: deck.slice(0, 10), coverage: deck.length ? supplied : 0 };
  };

  // Every deck a competent player might field from this collection:
  // the greedy value build plus each archetype approximation.
  CW.candidateDecks = function (collection) {
    const out = [{ name: 'value', deck: CW.buildDeck(collection) }];
    for (const t in CW.ARCHETYPE_TEMPLATES) {
      const b = CW.buildArchetype(collection, t);
      if (b.deck.length === 10) out.push({ name: t, deck: b.deck, coverage: b.coverage });
    }
    return out;
  };

  // Build a solid 10-card deck from a collection ({cardId: count}).
  // Leans into the owner's strongest faction (or leanOverride) with a playable curve.
  CW.buildDeck = function (collection, leanOverride) {
    const all = [];
    for (const id in collection) for (let i = 0; i < collection[id]; i++) all.push(id);
    // Which faction has the most muscle in this collection?
    const facScore = {};
    for (const id of all) {
      const c = CW.CARDS[id];
      facScore[c.faction] = (facScore[c.faction] || 0) + CW.cardValue(c);
    }
    let lean = leanOverride || null, ls = -1;
    if (!lean) for (const f in facScore) if (facScore[f] > ls) { ls = facScore[f]; lean = f; }
    const score = (id) => {
      const c = CW.CARDS[id];
      let s = CW.cardValue(c) + (c.faction === lean ? 0.9 : 0);
      // Shadow aura is dead weight without shadow creatures.
      if (c.id === 'moonlit_veil') {
        const shadows = all.filter(x => CW.CARDS[x].type === 'creature' && CW.CARDS[x].kw.includes('shadow')).length;
        s += shadows >= 3 ? 1 : -3;
      }
      return s;
    };
    all.sort((a, b) => score(b) - score(a));
    const deck = [];
    let heavies = 0, cheap = 0;
    // Answer slots: up to 2 removal/burn instants — shadow and venom threats
    // are unbeatable without interaction, so competent decks always pack some.
    const isAnswer = (id) => {
      const c = CW.CARDS[id];
      return c.type === 'instant' && c.fx.some(f =>
        f.k === 'destroy' || (f.k === 'dmg' && f.t !== 'face') || f.k === 'debuff');
    };
    for (const id of all) {
      if (deck.filter(isAnswer).length >= 2) break;
      if (isAnswer(id)) { deck.push(id); if (CW.CARDS[id].cost <= 2) cheap++; }
    }
    const taken = {};
    for (const id of deck) taken[id] = (taken[id] || 0) + 1;
    const owned = {};
    for (const id of all) owned[id] = (owned[id] || 0) + 1;
    for (const id of all) {
      if (deck.length >= 10) break;
      const c = CW.CARDS[id];
      if ((taken[id] || 0) >= owned[id]) continue; // every copy already in deck
      if (c.cost >= 4 && heavies >= 4) continue;
      if (c.cost >= 4) heavies++;
      if (c.cost <= 2) cheap++;
      deck.push(id);
      taken[id] = (taken[id] || 0) + 1;
    }
    // Guarantee early plays: swap in cheap cards until at least 3 cost <=2.
    if (cheap < 3) {
      const spare = all.filter(id => CW.CARDS[id].cost <= 2 && countIn(deck, id) < countIn(all, id));
      while (cheap < 3 && spare.length && deck.length) {
        const outIdx = deck.map((id, i) => [CW.CARDS[id].cost, i]).sort((a, b) => b[0] - a[0])[0][1];
        if (CW.CARDS[deck[outIdx]].cost <= 2) break;
        deck.splice(outIdx, 1);
        deck.push(spare.shift());
        cheap++;
      }
    }
    while (deck.length < 10) { // tiny collections: repeat what we have
      const id = all[deck.length % all.length];
      deck.push(id);
    }
    return deck.slice(0, 10);
    function countIn(arr, id) { return arr.filter(x => x === id).length; }
  };

  // A hand with nothing cheap to do is worth one free redraw.
  CW.aiShouldMulligan = function (duel, pIdx) {
    const p = duel.players[pIdx];
    if (p.mulliganed || p.turns > 1 || p.playedThisTurn) return false;
    return !p.hand.some(id => CW.CARDS[id].cost <= 2);
  };

  // Run one full AI turn (play phase + combat). Assumes startTurn already ran.
  CW.aiTakeTurn = function (duel) {
    const pIdx = duel.active;
    if (duel.winner !== null) return;
    if (CW.aiShouldMulligan(duel, pIdx)) duel.mulligan(pIdx);
    // Mana is the only limit — keep playing the best card until nothing fits.
    for (let n = 0; n < 10; n++) {
      const play = CW.aiChoosePlay(duel, pIdx);
      if (!play) break;
      if (!duel.playCard(pIdx, play.handIndex, play.targets)) break;
      if (duel.winner !== null) return;
    }
    if (duel.winner !== null) return;
    const attackers = CW.aiChooseAttackers(duel, pIdx);
    if (attackers.length) {
      const blocks = CW.aiChooseBlockers(duel, 1 - pIdx, attackers);
      duel.resolveCombat(attackers, blocks);
    }
    if (duel.winner !== null) return;
    duel.endTurn();
  };

  // Headless duel between two decks. Returns {winner, turns}.
  CW.simDuel = function (deckA, deckB, rng) {
    const duel = new CW.Duel(deckA, deckB, rng);
    duel.startTurn();
    let guard = 0;
    while (duel.winner === null && guard++ < 200) CW.aiTakeTurn(duel);
    return { winner: duel.winner === null ? 1 : duel.winner, turns: duel.turnCount, duel };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
