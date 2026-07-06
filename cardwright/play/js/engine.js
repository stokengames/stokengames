/* The Cardwright — duel engine. Pure logic, no DOM.
 *
 * Duel flow per turn:
 *   startTurn -> (draw, mana, upkeep) -> play phase (any cards mana allows) ->
 *   declareAttackers -> assignBlockers -> resolveCombat -> endTurn
 * The engine validates and mutates state; AI/UI decide.
 *
 * Rules: 15 life, mana ramps 1..5 (Dynamo Core can push cap to 6),
 * mana is the only limit on plays, damage on creatures is permanent,
 * deck of 10, opening hand 3, draw 1 per turn (first player skips their
 * first draw). Turn 30 safety cap: higher life wins, defender wins ties.
 */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  const MAX_TURNS = 30;
  const HAND_LIMIT = 8;
  // 15 life: sim-tested vs 20 — duels run ~2 rounds shorter, every archetype
  // stays viable, and no card breaks the 70% win-rate cap.
  // p2mana — how the second player is compensated for going second:
  //   'coin'   +1 mana on their first turn only (default)
  //   'ahead5' starts at 2 mana, always one ahead, same cap of 5
  //   'ahead6' starts at 2 mana, always one ahead, cap 6
  CW.RULES = CW.RULES || { life: 15, p2mana: 'coin' };

  function makeCreature(defId, owner, turnCount, token) {
    const def = token ? defId : CW.CARDS[defId];
    return {
      uid: CW.uid(),
      def,
      owner,
      pBuff: 0, hBuff: 0, damage: 0,
      summonedOnTurn: turnCount,
      readyOverride: false, // Overclock
      token: !!token,
    };
  }

  class Duel {
    // decks: arrays of 10 card ids. rng: CW.makeRng instance.
    constructor(deckA, deckB, rng, names) {
      this.rng = rng;
      this.players = [deckA, deckB].map((deck, i) => ({
        idx: i,
        name: (names && names[i]) || (i === 0 ? 'You' : 'Opponent'),
        life: CW.RULES.life,
        deck: rng.shuffle(deck),
        hand: [],
        board: [],
        enchants: [],
        turns: 0,
        mana: 0,
        manaCap: 0,
        playedThisTurn: false,
        mulliganed: false,
      }));
      this.active = 0;
      this.turnCount = 0; // total turns taken (both players)
      this.phase = 'start';
      this.winner = null;
      this.log = [];
      this.events = []; // structured events for UI animation
      // Opening hands: 3 each; the first player skips their first draw,
      // so the second player runs one card ahead (starting values;
      // sim verifies first-player win rate stays in 40-60%).
      for (let n = 0; n < 3; n++) { this.drawCard(0, true); this.drawCard(1, true); }
    }

    emit(ev) { this.events.push(ev); }
    say(msg) { this.log.push(msg); }
    // "You play" but "Pip plays" — the player is second person in the log.
    verb(p, base) { return p.name === 'You' ? base : base + 's'; }

    me() { return this.players[this.active]; }
    foe() { return this.players[1 - this.active]; }

    // Once per duel, before acting on your first turn: shuffle your hand
    // back and draw the same number of cards.
    mulligan(pIdx) {
      const p = this.players[pIdx];
      if (p.mulliganed || p.playedThisTurn || p.turns > 1 || this.winner !== null) return false;
      p.mulliganed = true;
      const n = p.hand.length;
      p.deck.push(...p.hand);
      p.hand = [];
      p.deck = this.rng.shuffle(p.deck);
      for (let i = 0; i < n; i++) this.drawCard(pIdx, true);
      this.say(p.name === 'You' ? 'You redraw your hand.' : `${p.name} redraws their hand.`);
      this.emit({ t: 'mulligan', p: pIdx });
      return true;
    }

    drawCard(pIdx, silent) {
      const p = this.players[pIdx];
      if (!p.deck.length || p.hand.length >= HAND_LIMIT) return null;
      const id = p.deck.pop();
      p.hand.push(id);
      if (!silent) this.emit({ t: 'draw', p: pIdx, card: id });
      return id;
    }

    /* ---- computed stats (base + permanent buffs + auras - damage) ---- */
    auraFor(creature) {
      const p = this.players[creature.owner];
      const out = { p: 0, h: 0, armor: 0 };
      for (const eId of p.enchants) {
        const aura = CW.CARDS[eId].aura;
        if (!aura) continue;
        if (aura.filter === 'shadow' && !creature.def.kw.includes('shadow')) continue;
        out.p += aura.p || 0; out.h += aura.h || 0; out.armor += aura.armor || 0;
      }
      return out;
    }
    power(c) { return Math.max(0, c.def.power + c.pBuff + this.auraFor(c).p); }
    health(c) { return c.def.health + c.hBuff + this.auraFor(c).h - c.damage; }
    armor(c) { return c.def.armor + this.auraFor(c).armor; }
    canAttack(c) {
      return c.readyOverride || c.def.kw.includes('swift') || c.summonedOnTurn < this.turnCount;
    }
    canBlock(blocker, attacker) {
      return !attacker.def.kw.includes('shadow') || blocker.def.kw.includes('shadow');
    }

    manaCapFor(p) {
      let bonus = 0;
      for (const eId of p.enchants) bonus += CW.CARDS[eId].manaBonus || 0;
      const mode = CW.RULES.p2mana || 'coin';
      let base = Math.min(5, p.turns);
      if (p.idx === 1 && mode === 'ahead5') base = Math.min(5, p.turns + 1);
      if (p.idx === 1 && mode === 'ahead6') base = Math.min(6, p.turns + 1);
      return Math.min(base === 6 ? 7 : 6, base + bonus);
    }

    /* ---- turn structure ---- */
    startTurn() {
      if (this.winner !== null) return;
      const p = this.me();
      this.turnCount++;
      p.turns++;
      p.playedThisTurn = false;
      p.manaCap = this.manaCapFor(p);
      p.mana = p.manaCap;
      // Going second is worth a little tempo: one bonus mana on your first turn.
      if (p.idx === 1 && p.turns === 1 && (CW.RULES.p2mana || 'coin') === 'coin') p.mana += 1;
      this.phase = 'main';
      this.emit({ t: 'turnStart', p: p.idx, turn: p.turns });
      if (this.turnCount > 1) {
        const got = this.drawCard(p.idx);
        if (!got && p.deck.length && p.hand.length >= HAND_LIMIT) {
          this.say(p.name === 'You'
            ? 'Your hand is full — the draw waits on top of your deck.'
            : `${p.name}'s hand is full — their draw waits.`);
        }
      }
      // Upkeep triggers, in the order enchants were played.
      for (const eId of p.enchants.slice()) {
        const up = CW.CARDS[eId].upkeep;
        if (!up) continue;
        this.emit({ t: 'upkeep', p: p.idx, card: eId });
        this.applyEffects(up, p.idx, {});
        if (this.winner !== null) return;
      }
    }

    /* ---- playing cards ----
     * targets: {creature: uid} for single-target effects. */
    legalTargetsFor(def, pIdx) {
      const me = this.players[pIdx], foe = this.players[1 - pIdx];
      const needs = [];
      for (const fx of def.fx) {
        if (fx.k === 'buff' && fx.t === 'fcreature') needs.push(me.board);
        if (fx.k === 'ready' && fx.t === 'fcreature') needs.push(me.board);
        if (fx.k === 'debuff' && fx.t === 'ecreature') needs.push(foe.board);
        if (fx.k === 'dmg' && fx.t === 'ecreature') needs.push(foe.board);
        if (fx.k === 'dmg' && fx.t === 'any') needs.push(null); // may target face
        if (fx.k === 'destroy') {
          needs.push(foe.board.filter(c =>
            (fx.maxCost === undefined || (!c.token && c.def.cost <= fx.maxCost) || (c.token && fx.maxCost >= 1)) &&
            (fx.maxPower === undefined || this.power(c) <= fx.maxPower)));
        }
      }
      return needs;
    }

    canPlay(pIdx, handIndex) {
      const p = this.players[pIdx];
      if (this.winner !== null || this.active !== pIdx || this.phase !== 'main') return false;
      // No per-turn card limit — mana is the whole budget.
      // (playedThisTurn is still tracked: it gates the mulligan.)
      const def = CW.CARDS[p.hand[handIndex]];
      if (!def || def.cost > p.mana) return false;
      // Instants whose only effect needs a target must have one available.
      if (def.type === 'instant') {
        const needs = this.legalTargetsFor(def, pIdx);
        for (const pool of needs) {
          if (pool !== null && pool.length === 0) return false;
        }
      }
      return true;
    }

    playCard(pIdx, handIndex, targets) {
      if (!this.canPlay(pIdx, handIndex)) return false;
      const p = this.players[pIdx];
      const id = p.hand.splice(handIndex, 1)[0];
      const def = CW.CARDS[id];
      p.mana -= def.cost;
      p.playedThisTurn = true;
      this.emit({ t: 'play', p: pIdx, card: id });
      this.say(`${p.name} ${this.verb(p, 'play')} ${def.name}.`);
      if (def.type === 'creature') {
        const c = makeCreature(id, pIdx, this.turnCount);
        p.board.push(c);
        if (def.fx.length) this.applyEffects(def.fx, pIdx, targets || {}, c);
      } else if (def.type === 'enchant') {
        p.enchants.push(id);
        this.pruneDead();
      } else {
        this.applyEffects(def.fx, pIdx, targets || {});
      }
      this.checkWin();
      return true;
    }

    /* ---- effects ---- */
    applyEffects(fxList, srcIdx, targets, selfCreature) {
      const me = this.players[srcIdx], foe = this.players[1 - srcIdx];
      let lastTarget = null;
      for (const fx of fxList) {
        switch (fx.k) {
          case 'dmg': {
            if (fx.t === 'face') {
              this.hitFace(foe, fx.n);
            } else if (fx.t === 'allEnemy') {
              for (const c of foe.board) { c.damage += fx.n; this.emit({ t: 'hit', uid: c.uid, n: fx.n }); }
            } else { // 'ecreature' or 'any'
              const c = this.findCreature(targets.creature);
              if (c) { c.damage += Math.max(0, fx.n); lastTarget = c; this.emit({ t: 'hit', uid: c.uid, n: fx.n }); }
              else if (fx.t === 'any') this.hitFace(foe, fx.n);
            }
            break;
          }
          case 'heal': {
            me.life = Math.min(CW.RULES.life, me.life + fx.n);
            this.emit({ t: 'heal', p: srcIdx, n: fx.n });
            break;
          }
          case 'buff': {
            if (fx.t === 'allFriendly') {
              for (const c of me.board) { c.pBuff += fx.p; c.hBuff += fx.h; }
            } else {
              let c = this.findCreature(targets.creature);
              // Bellows Sprite buffs *another* creature; fall back gracefully.
              if (!c || c.owner !== srcIdx) c = me.board.find(x => x !== selfCreature) || null;
              if (c) { c.pBuff += fx.p; c.hBuff += fx.h; lastTarget = c; this.emit({ t: 'buff', uid: c.uid }); }
            }
            break;
          }
          case 'debuff': {
            if (fx.t === 'allEnemy') {
              for (const c of foe.board) { c.pBuff -= fx.p; c.hBuff -= fx.h; }
            } else {
              const c = this.findCreature(targets.creature);
              if (c) { c.pBuff -= fx.p; c.hBuff -= fx.h; lastTarget = c; this.emit({ t: 'debuff', uid: c.uid }); }
            }
            break;
          }
          case 'destroy': {
            const c = this.findCreature(targets.creature);
            if (c && c.owner !== srcIdx) {
              const okCost = fx.maxCost === undefined || c.token || c.def.cost <= fx.maxCost;
              const okPow = fx.maxPower === undefined || this.power(c) <= fx.maxPower;
              if (okCost && okPow) { c.damage = 9999; this.emit({ t: 'destroy', uid: c.uid }); }
            }
            break;
          }
          case 'draw': {
            for (let i = 0; i < fx.n; i++) this.drawCard(srcIdx);
            break;
          }
          case 'token': {
            const def = { id: 'token_' + fx.name.toLowerCase().replace(/\s+/g, '_'), name: fx.name, cost: 0, type: 'creature', power: fx.p, health: fx.h, kw: fx.kw || [], fx: [], armor: 0, faction: selfCreature ? selfCreature.def.faction : 'cogsworn', rarity: 'common', tokenArt: true };
            const c = makeCreature(def, srcIdx, this.turnCount, true);
            me.board.push(c);
            this.emit({ t: 'token', p: srcIdx, uid: c.uid, name: fx.name });
            break;
          }
          case 'ready': {
            const c = fx.t === 'same' ? lastTarget : this.findCreature(targets.creature);
            if (c && c.owner === srcIdx) { c.readyOverride = true; this.emit({ t: 'ready', uid: c.uid }); }
            break;
          }
        }
      }
      this.pruneDead();
    }

    hitFace(p, n) {
      p.life -= n;
      this.emit({ t: 'face', p: p.idx, n });
      this.checkWin();
    }

    findCreature(uidWanted) {
      if (!uidWanted) return null;
      for (const p of this.players) {
        const c = p.board.find(c => c.uid === uidWanted);
        if (c) return c;
      }
      return null;
    }

    pruneDead() {
      for (const p of this.players) {
        for (const c of p.board.slice()) {
          if (this.health(c) <= 0) {
            p.board.splice(p.board.indexOf(c), 1);
            this.emit({ t: 'die', uid: c.uid, p: p.idx, card: c.def.id });
            this.say(`${c.def.name} is defeated.`);
          }
        }
      }
    }

    /* ---- combat ----
     * attackerUids: creatures of the active player attacking.
     * blocks: {attackerUid: blockerUid} chosen by the defender. */
    validAttackers() {
      return this.me().board.filter(c => this.canAttack(c) && this.power(c) > 0);
    }

    // One attacker resolves its strike (no pruning — combat is simultaneous;
    // call finishCombat() after the last strike). Lets the UI animate each
    // impact in sync with its damage.
    performStrike(attackerUid, blockerUid) {
      if (this.winner !== null) return;
      const atkP = this.me(), defP = this.foe();
      const a = atkP.board.find(c => c.uid === attackerUid);
      if (!a || !this.canAttack(a)) return;
      let blocker = null;
      if (blockerUid) {
        const b = defP.board.find(c => c.uid === blockerUid);
        if (b && this.canBlock(b, a)) blocker = b;
      }
      if (blocker) {
        const dmgToB = Math.max(0, this.power(a) - this.armor(blocker));
        const dmgToA = Math.max(0, this.power(blocker) - this.armor(a));
        blocker.damage += dmgToB;
        a.damage += dmgToA;
        if (dmgToB > 0 && a.def.kw.includes('venom')) blocker.damage = 9999;
        if (dmgToA > 0 && blocker.def.kw.includes('venom')) a.damage = 9999;
        this.emit({ t: 'clash', a: a.uid, b: blocker.uid, dmgToB, dmgToA });
        this.say(`${a.def.name} clashes with ${blocker.def.name}.`);
      } else {
        const n = this.power(a);
        this.emit({ t: 'attackFace', uid: a.uid, n });
        this.say(`${a.def.name} strikes ${defP.name} for ${n}.`);
        this.hitFace(defP, n);
      }
      a.readyOverride = false;
    }

    finishCombat() {
      this.pruneDead();
      this.checkWin();
    }

    resolveCombat(attackerUids, blocks) {
      if (this.winner !== null) return;
      this.phase = 'combat';
      const atkP = this.me();
      const usedBlockers = new Set();
      for (const uid of attackerUids) {
        if (this.winner !== null) break;
        const a = atkP.board.find(c => c.uid === uid);
        if (!a) continue;
        let bUid = blocks && blocks[uid];
        if (bUid && usedBlockers.has(bUid)) bUid = null;
        if (bUid) usedBlockers.add(bUid);
        this.performStrike(uid, bUid || null);
      }
      this.finishCombat();
    }

    endTurn() {
      if (this.winner !== null) return;
      this.phase = 'end';
      this.emit({ t: 'turnEnd', p: this.active });
      this.active = 1 - this.active;
      if (this.turnCount >= MAX_TURNS) {
        // Stalemate valve: higher life wins; tie goes to player 1 (the challenged).
        this.winner = this.players[0].life > this.players[1].life ? 0 : 1;
        this.say('The judges call the duel on time!');
        this.emit({ t: 'timeout' });
        return;
      }
      this.startTurn();
    }

    checkWin() {
      if (this.winner !== null) return;
      for (const p of this.players) {
        if (p.life <= 0) {
          this.winner = 1 - p.idx;
          this.emit({ t: 'gameOver', winner: this.winner });
          const w = this.players[this.winner];
          this.say(`${w.name} ${this.verb(w, 'win')} the duel!`);
        }
      }
    }
  }

  CW.Duel = Duel;
  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
