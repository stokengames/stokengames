/* Cardwright — duel screen controller.
 * Player is always players[0]; the NPC (players[1]) is driven by CW.ai*. */
(function () {
  'use strict';
  const CW = window.CW;
  const UI = CW.UI;
  const esc = CW.escapeHTML;
  const DuelUI = (CW.DuelUI = {});

  let el, duel, npc, phase, pendingCard, selectedAttackers, npcAttackers, blocks, selectedEnemy, evCursor, ended, playedCards;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (sel) => el.querySelector(sel);

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFast = () => !!(UI.getGame() && UI.getGame().fast);
  // Turn-flow pause, respecting the fast toggle.
  const wait = (ms) => sleep(isFast() ? Math.max(60, Math.round(ms * 0.4)) : ms);

  DuelUI.start = function (screenEl, npcId) {
    el = screenEl;
    npc = CW.NPC_BY_ID[npcId];
    const G = UI.getGame();
    const rng = CW.makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    // Champions face the gauntlet: everyone brings their honed deck.
    const npcDeck = (G.champion && npc.gauntletDeck) ? npc.gauntletDeck : npc.deck;
    duel = new CW.Duel(G.deck.slice(), npcDeck.slice(), rng, ['You', npc.name]);
    DuelUI.gauntlet = G.champion && !!npc.gauntletDeck;
    phase = 'busy';
    pendingCard = null; selectedAttackers = new Set(); npcAttackers = []; blocks = {}; selectedEnemy = null;
    evCursor = 0; ended = false; playedCards = [[], []];
    duel.startTurn(); // player goes first (the challenged party gets the tie-break, per house rules)
    render();
    phase = 'main';
    render();
    banner('Your turn');

    // Space ends the turn (or confirms blocks); ignored while a dialog is up.
    if (DuelUI._key) document.removeEventListener('keydown', DuelUI._key);
    DuelUI._key = (e) => {
      if (e.key !== ' ' || !UI.inDuel || ended) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'textarea' || tag === 'input') return;
      if (document.querySelector('.overlay')) return;
      e.preventDefault();
      const btn = $('#attack') || $('#endturn') || $('#resolve');
      if (btn) btn.click();
    };
    document.addEventListener('keydown', DuelUI._key);
  };

  /* ================= rendering ================= */
  function creatureBadges(c, side) {
    const cls = [];
    if (phase === 'main' && side === 0 && duel.canAttack(c) && duel.power(c) > 0) cls.push('canatk');
    if (selectedAttackers.has(c.uid)) cls.push('attacking');
    if (phase === 'block') {
      if (side === 1 && npcAttackers.includes(c.uid)) cls.push('enemyattacker');
      if (side === 1 && selectedEnemy === c.uid) cls.push('targetable');
      if (side === 0 && Object.values(blocks).includes(c.uid)) cls.push('blocker');
    }
    if (phase === 'targeting' && validTargets().has(c.uid)) cls.push('targetable');
    return cls.join(' ');
  }

  function render() {
    hideForecast();
    const G = UI.getGame();
    const me = duel.players[0], opp = duel.players[1];
    const blockPairs = Object.entries(blocks).map(([a, b]) => {
      const ac = duel.findCreature(a), bc = duel.findCreature(b);
      return ac && bc ? `${bc.def.name} ⛨ ${ac.def.name}` : '';
    }).filter(Boolean).join(' · ');

    el.innerHTML = `
    <div class="duel${isFast() ? ' fast' : ''}">
      <div class="oppbar">
        <div class="oppinfo">${CW.portraitSVG(npc.id, npc.color, 46)}
          <div><div class="pname">${esc(opp.name)}</div><div style="font-size:11.5px;color:#4a3a26">${esc(npc.title)}</div></div>
        </div>
        <div class="lifeorb" id="opplife">${opp.life}</div>
        <div class="manarow">${manaOrbs(opp)}</div>
        <span class="deckcount">🂠 deck ${opp.deck.length} · hand ${opp.hand.length}</span>
        <span class="deckcount" id="oppplayed" style="cursor:pointer" title="Everything ${esc(npc.name.split(' ')[0])} has played this duel">✦ played ${playedCards[1].length} ▾</span>
        <div class="enchantrow">${enchants(opp)}</div>
        <span class="spacer" style="flex:1"></span>
        <button class="btn small" id="fastbtn" title="Speed up animations and thinking time">${isFast() ? '⏩ Fast' : '▶ Calm'}</button>
        <button class="btn small danger" id="concede">Concede</button>
      </div>

      <div class="field">
        <div class="boardrow" id="oppboard">
          ${opp.board.map(c => CW.creatureHTML(duel, c, { cls: creatureBadges(c, 1) })).join('') || '<span style="color:#8a744f;font-style:italic">no creatures</span>'}
        </div>
        <div class="centerline">
          <div class="phasemsg" id="phasemsg">${phaseMsg()}${blockPairs ? `<br><b>${esc(blockPairs)}</b>` : ''}</div>
        </div>
        <div class="boardrow" id="myboard">
          ${me.board.map(c => CW.creatureHTML(duel, c, { cls: creatureBadges(c, 0) })).join('') || '<span style="color:#8a744f;font-style:italic">no creatures</span>'}
        </div>
      </div>

      <div class="mybar">
        <div class="pname">You</div>
        <div class="lifeorb" id="mylife">${me.life}</div>
        <div class="manarow">${manaOrbs(me)}</div>
        <span class="deckcount" id="mydecklist" style="cursor:pointer" title="Peek at what's still in your deck">🂠 deck ${me.deck.length} ▾</span>
        <div class="enchantrow">${enchants(me)}</div>
        <span style="flex:1"></span>
        <div class="actionbar" id="actions">${actionButtons()}</div>
      </div>

      <div class="handwrap"><div class="handrow" id="hand">
        ${me.hand.map((id, i) => {
      const can = phase === 'main' && duel.canPlay(0, i);
      const pend = pendingCard === i ? 'pendingplay' : '';
      let why = '';
      if (!can && phase === 'main') {
        const def = CW.CARDS[id];
        if (def.cost > me.mana) why = `Needs ${def.cost} mana — you have ${me.mana}`;
        else why = 'No valid target for this right now';
      }
      return `<div data-hand="${i}" class="handcell" ${why ? `title="${esc(why)}"` : ''}>${CW.cardHTML(id, { mode: 'play', cls: `${can ? 'playable' : 'unplayable'} ${pend}` })}</div>`;
    }).join('')}
      </div></div>

      <div class="duellog" id="log">${duel.log.slice(-26).map((l, i, a) => `<div class="${i === a.length - 1 ? 'recent' : ''}">${esc(l)}</div>`).join('')}</div>
    </div>`;

    wire();
    const log = $('#log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function manaOrbs(p) {
    let s = '';
    const total = Math.max(p.manaCap, p.mana); // second player's first turn carries a bonus orb
    for (let i = 0; i < total; i++) s += `<span class="manaorb ${i < p.mana ? '' : 'spent'}"></span>`;
    return s || '<span style="font-size:11px;color:#4a3a26">—</span>';
  }
  function enchants(p) {
    return p.enchants.map(id => {
      const d = CW.CARDS[id];
      return `<span class="enchip" data-cid="${id}" title="${esc(d.text || '')}">✦ ${esc(d.name)}</span>`;
    }).join('');
  }

  function phaseMsg() {
    const me = duel.players[0];
    if (phase === 'main') {
      const parts = [];
      if (me.hand.some((_, i) => duel.canPlay(0, i))) parts.push('play cards');
      const ready = duel.validAttackers().filter(c => c.owner === 0);
      if (ready.length) parts.push('choose attackers');
      const rounds = Math.ceil(duel.turnCount / 2);
      const clock = rounds >= 11
        ? `<br><span style="font-size:0.82em;color:#8c5a2a">Round ${rounds} of 15 — if it goes the distance, higher life wins.</span>` : '';
      const tip = duel.turnCount <= 3 ? '<br><span style="font-size:0.82em;opacity:0.75">Tip: hover over any card to read it full-size.</span>' : '';
      return `Your turn ${me.turns} — ${parts.length ? parts.join(', then ') : 'nothing to do but pass'}.${tip}${clock}`;
    }
    if (phase === 'targeting') return 'Choose a target — or click the card again to cancel.';
    if (phase === 'block') return `${npc.name.split(' ')[0]} attacks! Click an attacker, then one of your creatures to block it.`;
    if (phase === 'over') return 'The duel is decided.';
    return `${npc.name.split(' ')[0]} is thinking…`;
  }

  function actionButtons() {
    if (phase === 'main') {
      const me = duel.players[0];
      const atk = selectedAttackers.size;
      const ready = duel.validAttackers().filter(c => c.owner === 0);
      const canMull = me.turns === 1 && !me.mulliganed && !me.playedThisTurn;
      return `
        ${canMull ? `<button class="btn small" id="mulligan" title="Once per duel: shuffle your hand back and draw the same number">↻ Redraw hand</button>` : ''}
        ${ready.length && atk < ready.length ? `<button class="btn small" id="allatk">Ready all (${ready.length})</button>` : ''}
        ${atk ? `<button class="btn primary" id="attack">Attack with ${atk}</button>` : ''}
        <button class="btn ${atk ? '' : 'primary'}" id="endturn">End turn</button>`;
    }
    if (phase === 'targeting') return `<button class="btn" id="cancelplay">Cancel</button>`;
    if (phase === 'block') {
      const n = Object.keys(blocks).length;
      return `
        ${n ? `<button class="btn small" id="clearblocks">Clear blocks</button>` : ''}
        <button class="btn primary" id="resolve">${n ? `Block with ${n}` : 'Take the hits'}</button>`;
    }
    return '';
  }

  /* ================= interaction wiring ================= */
  function wire() {
    $('#fastbtn').onclick = () => {
      const G = UI.getGame();
      G.fast = !G.fast;
      CW.autosave(G);
      UI.sfx.click();
      render();
    };
    $('#concede').onclick = () => {
      UI.dialog({
        name: 'Concede the duel?', lines: ['A handshake and a rematch beats a bad hand played badly. Concede?'],
        actions: [
          { label: 'Keep dueling', primary: true },
          {
            label: 'Concede', danger: true, fn: () => {
              if (ended) return;
              ended = true;           // stops any in-flight NPC turn at its next checkpoint
              phase = 'over';
              UI.duelOver(npc, false, { conceded: true });
            },
          },
        ],
      });
    };

    // hand
    el.querySelectorAll('[data-hand]').forEach(n => {
      const i = Number(n.dataset.hand);
      n.onclick = () => {
        if (phase === 'targeting' && pendingCard === i) { pendingCard = null; phase = 'main'; render(); return; }
        if (phase !== 'main' || !duel.canPlay(0, i)) return;
        const def = CW.CARDS[duel.players[0].hand[i]];
        if (def.type === 'instant' && needsManualTarget(def)) {
          pendingCard = i;
          phase = 'targeting';
          render();
          return;
        }
        UI.sfx.play();
        playWithAutoTargets(i);
      };
    });

    // creatures
    el.querySelectorAll('.creature').forEach(n => {
      const uid = n.dataset.uid;
      n.onclick = () => {
        if (phase === 'targeting') { tryTarget(uid); return; }
        if (phase === 'block') { blockClick(uid); return; }
        if (phase !== 'main') return;
        const c = duel.players[0].board.find(x => x.uid === uid);
        if (!c || !duel.canAttack(c) || duel.power(c) <= 0) return;
        UI.sfx.click();
        if (selectedAttackers.has(uid)) selectedAttackers.delete(uid); else selectedAttackers.add(uid);
        render();
      };
    });

    // enemy face as a target
    const oppLife = $('#opplife');
    if (phase === 'targeting' && faceIsValidTarget()) {
      oppLife.classList.add('targetable');
      oppLife.style.cursor = 'crosshair';
      oppLife.onclick = () => { UI.sfx.play(); commitPlay({}); };
    }

    const allatk = $('#allatk');
    if (allatk) allatk.onclick = () => {
      duel.validAttackers().filter(c => c.owner === 0).forEach(c => selectedAttackers.add(c.uid));
      UI.sfx.click(); render();
    };
    const attack = $('#attack');
    if (attack) attack.onclick = () => { if (phase === 'main') playerAttack(); };
    const endturn = $('#endturn');
    if (endturn) endturn.onclick = () => { if (phase !== 'main') return; UI.sfx.click(); npcTurn(); };
    const cancel = $('#cancelplay');
    if (cancel) cancel.onclick = () => { pendingCard = null; phase = 'main'; render(); };
    const clearb = $('#clearblocks');
    if (clearb) clearb.onclick = () => { blocks = {}; selectedEnemy = null; UI.sfx.click(); render(); };
    const resolve = $('#resolve');
    if (resolve) resolve.onclick = () => { if (phase === 'block') resolveNpcAttack(); };
    const mydeck = $('#mydecklist');
    if (mydeck) mydeck.onclick = () => showDeckRemaining();
    const oppPlayed = $('#oppplayed');
    if (oppPlayed) oppPlayed.onclick = () => showPlayed(1);
    const mull = $('#mulligan');
    if (mull) mull.onclick = () => {
      if (phase !== 'main') return;
      if (duel.mulligan(0)) { UI.sfx.flip(); render(); }
    };

    // combat forecast on creature hover
    el.querySelectorAll('.creature').forEach(n => {
      n.onmouseenter = () => showForecast(n.dataset.uid, n);
      n.onmouseleave = hideForecast;
    });
  }

  /* ---- combat forecast ---- */
  function forecastEl() {
    let f = document.getElementById('forecast');
    if (!f) {
      f = document.createElement('div');
      f.id = 'forecast';
      document.body.appendChild(f);
    }
    return f;
  }
  function hideForecast() { const f = document.getElementById('forecast'); if (f) f.style.display = 'none'; }
  function showForecast(uid, node) {
    let text = null;
    const mine = duel.players[0].board.find(c => c.uid === uid);
    const theirs = duel.players[1].board.find(c => c.uid === uid);
    if (phase === 'main' && mine && duel.canAttack(mine) && duel.power(mine) > 0 && !selectedAttackers.has(uid)) {
      text = `⚔ Hits ${npc.name.split(' ')[0]} for ${duel.power(mine)} if unblocked`;
    } else if (phase === 'block' && theirs && npcAttackers.includes(uid) && !blocks[uid]) {
      text = `Hits you for ${duel.power(theirs)} unless blocked`;
    } else if (phase === 'block' && mine && selectedEnemy) {
      const a = duel.findCreature(selectedEnemy);
      if (a && duel.canBlock(mine, a)) {
        const dmgToB = Math.max(0, duel.power(a) - duel.armor(mine));
        const dmgToA = Math.max(0, duel.power(mine) - duel.armor(a));
        const bDies = dmgToB >= duel.health(mine) || (dmgToB > 0 && a.def.kw.includes('venom'));
        const aDies = dmgToA >= duel.health(a) || (dmgToA > 0 && mine.def.kw.includes('venom'));
        text = `Block: your ${mine.def.name} ${bDies ? 'falls ✖' : `takes ${dmgToB}`} — their ${a.def.name} ${aDies ? 'falls ✖' : `takes ${dmgToA}`}`;
      } else if (a) {
        text = `Can't block ${a.def.name}${a.def.kw.includes('shadow') && !mine.def.kw.includes('shadow') ? ' — it has Shadow' : ''}`;
      }
    }
    if (!text) return hideForecast();
    const f = forecastEl();
    f.textContent = text;
    f.style.display = 'block';
    const r = node.getBoundingClientRect();
    f.style.left = Math.max(8, Math.min(r.left + r.width / 2 - f.offsetWidth / 2, window.innerWidth - f.offsetWidth - 8)) + 'px';
    f.style.top = (r.top - f.offsetHeight - 10) + 'px';
  }

  /* ---- playing cards ---- */
  function needsManualTarget(def) {
    return def.fx.some(f =>
      (f.k === 'dmg' && (f.t === 'ecreature' || f.t === 'any')) ||
      (f.k === 'buff' && f.t === 'fcreature') ||
      (f.k === 'debuff' && f.t === 'ecreature') ||
      f.k === 'destroy');
  }

  function validTargets() {
    const out = new Set();
    if (pendingCard === null) return out;
    const def = CW.CARDS[duel.players[0].hand[pendingCard]];
    for (const f of def.fx) {
      if ((f.k === 'buff' && f.t === 'fcreature')) duel.players[0].board.forEach(c => out.add(c.uid));
      if (f.k === 'dmg' && (f.t === 'ecreature' || f.t === 'any')) duel.players[1].board.forEach(c => out.add(c.uid));
      if (f.k === 'debuff' && f.t === 'ecreature') duel.players[1].board.forEach(c => out.add(c.uid));
      if (f.k === 'destroy') {
        duel.players[1].board.forEach(c => {
          const okCost = f.maxCost === undefined || c.token || c.def.cost <= f.maxCost;
          const okPow = f.maxPower === undefined || duel.power(c) <= f.maxPower;
          if (okCost && okPow) out.add(c.uid);
        });
      }
    }
    return out;
  }
  function faceIsValidTarget() {
    if (pendingCard === null) return false;
    const def = CW.CARDS[duel.players[0].hand[pendingCard]];
    return def.fx.some(f => f.k === 'dmg' && f.t === 'any');
  }
  function tryTarget(uid) {
    if (!validTargets().has(uid)) return;
    UI.sfx.play();
    commitPlay({ creature: uid });
  }
  function commitPlay(targets) {
    const i = pendingCard;
    pendingCard = null;
    phase = 'main';
    castWithFx(i, targets);
  }
  function playWithAutoTargets(i) {
    const def = CW.CARDS[duel.players[0].hand[i]];
    castWithFx(i, CW.aiPlanTargets(duel, 0, def));
  }

  // Play a card with its casting animation: instants fly from the hand to
  // their target and burst in the faction's color before the effect lands.
  async function castWithFx(i, targets) {
    const def = CW.CARDS[duel.players[0].hand[i]];
    if (def.type === 'instant' && !reducedMotion()) {
      phase = 'busy';
      const src = el.querySelector(`[data-hand="${i}"]`);
      const srcRect = src ? src.getBoundingClientRect() : null;
      if (src) src.style.visibility = 'hidden';
      await flySpell(def, srcRect, targetRectFor(def, targets, 0));
      if (ended) return;
      phase = 'main';
    }
    const rects = snapshotRects();
    duel.playCard(0, i, targets);
    afterAction(rects);
  }

  function targetRectFor(def, targets, casterSide) {
    if (targets && targets.creature) {
      const n = el.querySelector(`.creature[data-uid="${targets.creature}"]`);
      if (n) return n.getBoundingClientRect();
    }
    const pick = (sel) => { const n = el.querySelector(sel); return n ? n.getBoundingClientRect() : null; };
    const foeLife = pick(casterSide === 0 ? '#opplife' : '#mylife');
    const myLife = pick(casterSide === 0 ? '#mylife' : '#opplife');
    const foeBoard = pick(casterSide === 0 ? '#oppboard' : '#myboard');
    const myBoard = pick(casterSide === 0 ? '#myboard' : '#oppboard');
    for (const fx of def.fx) {
      if (fx.k === 'dmg') return fx.t === 'allEnemy' ? foeBoard : foeLife;
      if (fx.k === 'destroy' || fx.k === 'debuff') return foeBoard;
      if (fx.k === 'heal') return myLife;
      if (fx.k === 'buff' || fx.k === 'token' || fx.k === 'ready') return myBoard;
    }
    return myBoard;
  }

  async function flySpell(def, fromRect, toRect) {
    if (!fromRect || !toRect) return;
    const fac = CW.FACTIONS[def.faction];
    const orb = document.createElement('div');
    orb.className = 'spellfly';
    orb.style.background = `radial-gradient(circle at 35% 30%, ${fac.color}, ${fac.color2})`;
    orb.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30">${CW.glyphFor(def, '#fff', 'rgba(0,0,0,0.3)')}</svg>`;
    const sx = fromRect.left + fromRect.width / 2 - 24, sy = fromRect.top + fromRect.height / 2 - 24;
    orb.style.left = sx + 'px';
    orb.style.top = sy + 'px';
    document.body.appendChild(orb);
    const dx = (toRect.left + toRect.width / 2 - 24) - sx;
    const dy = (toRect.top + toRect.height / 2 - 24) - sy;
    try {
      await orb.animate([
        { transform: 'translate(0,0) scale(0.55)', opacity: 0.4 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 52}px) scale(1.12)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
      ], { duration: isFast() ? 240 : 470, easing: 'ease-in-out' }).finished;
    } catch (e) { /* animation interrupted — effect still lands */ }
    orb.remove();
    UI.burst(toRect, fac.color, 12);
    UI.sfx.spell(def.faction);
  }

  function afterAction(rects) {
    processEvents(rects);
    render();
    if (duel.winner !== null) return finishDuel();
  }

  /* ---- strategist's aid: what's left in my deck ---- */
  function showDeckRemaining() {
    const left = duel.players[0].deck.slice();
    const counts = {};
    for (const id of left) counts[id] = (counts[id] || 0) + 1;
    const ids = Object.keys(counts).sort((a, b) => CW.CARDS[a].cost - CW.CARDS[b].cost || a.localeCompare(b));
    UI.dialog({
      name: `Still in your deck (${left.length})`,
      html: left.length
        ? `<div style="display:flex;flex-direction:column;gap:6px">${ids.map(id => {
          const c = CW.CARDS[id];
          return `<div class="deckrow" data-cid="${id}" style="cursor:default"><span class="cost">${c.cost}</span><span class="nm">${esc(c.name)}${counts[id] > 1 ? ` ×${counts[id]}` : ''}</span><span class="pt">${c.type === 'creature' ? c.power + '/' + c.health : c.type}</span></div>`;
        }).join('')}</div><div class="line" style="font-size:13px;color:#6b5842">Draw order stays secret — even from you.</div>`
        : '<div class="line">Your deck is empty — everything you brought is in hand or on the table.</div>',
      actions: [{ label: 'Back to the duel', primary: true }],
    });
  }

  // Memory aid: everything a side has played so far (hover a row to see the card).
  function showPlayed(side) {
    const list = playedCards[side].filter(id => CW.CARDS[id]);
    const counts = {};
    for (const id of list) counts[id] = (counts[id] || 0) + 1;
    const ids = Object.keys(counts).sort((a, b) => CW.CARDS[a].cost - CW.CARDS[b].cost || a.localeCompare(b));
    UI.dialog({
      name: `${side === 1 ? npc.name.split(' ')[0] + ' has' : 'You have'} played ${list.length} card${list.length === 1 ? '' : 's'}`,
      html: list.length
        ? `<div style="display:flex;flex-direction:column;gap:6px">${ids.map(id => {
          const c = CW.CARDS[id];
          return `<div class="deckrow" data-cid="${id}" style="cursor:default"><span class="cost">${c.cost}</span><span class="nm">${esc(c.name)}${counts[id] > 1 ? ` ×${counts[id]}` : ''}</span><span class="pt">${c.type === 'creature' ? c.power + '/' + c.health : c.type}</span></div>`;
        }).join('')}</div>`
        : '<div class="line">Nothing yet.</div>',
      actions: [{ label: 'Back to the duel', primary: true }],
    });
  }

  /* ---- combat: animated, one strike at a time ----
   * Each attacker winds up, dashes into its blocker (or the enemy duelist),
   * damage lands at the moment of impact, then it returns home. */
  async function animateCombat(attackerUids, blocks, attackerSide) {
    duel.phase = 'combat';
    const usedBlockers = new Set();
    for (const uid of attackerUids) {
      if (ended || duel.winner !== null) break;
      let bUid = blocks && blocks[uid];
      if (bUid && usedBlockers.has(bUid)) bUid = null;
      if (bUid) usedBlockers.add(bUid);
      const aEl = el.querySelector(`.creature[data-uid="${uid}"]`);
      const tEl = bUid
        ? el.querySelector(`.creature[data-uid="${bUid}"]`)
        : el.querySelector(attackerSide === 0 ? '#opplife' : '#mylife');
      if (aEl && tEl) {
        const ar = aEl.getBoundingClientRect(), tr = tEl.getBoundingClientRect();
        const dx = (tr.left + tr.width / 2) - (ar.left + ar.width / 2);
        const dy = (tr.top + tr.height / 2) - (ar.top + ar.height / 2);
        aEl.style.setProperty('--sx', (dx * 0.84).toFixed(1) + 'px');
        aEl.style.setProperty('--sy', (dy * 0.84).toFixed(1) + 'px');
        aEl.classList.add('striking');
        await sleep(isFast() ? 110 : 240); // impact moment of the smack animation
        if (ended) return;
        const atk = duel.findCreature(uid);
        const rects = snapshotRects();
        duel.performStrike(uid, bUid || null);
        UI.sfx.smack(atk ? atk.def.faction : null);
        processEvents(rects);
        tEl.style.setProperty('--knock', (dy < 0 ? -12 : 12) + 'px');
        tEl.classList.remove('smacked');
        void tEl.offsetWidth;
        tEl.classList.add('smacked');
        refreshStats(uid); if (bUid) refreshStats(bUid);
        await sleep(isFast() ? 145 : 330); // return travel
        aEl.classList.remove('striking');
      } else {
        duel.performStrike(uid, bUid || null);
        processEvents();
      }
    }
    duel.finishCombat();
    // let the fallen fade where they stand before the board settles
    const evs = processEvents(snapshotRects());
    const deadUids = evs.filter(e => e.t === 'die').map(e => e.uid);
    if (deadUids.length) {
      deadUids.forEach(u => {
        const n = el.querySelector(`.creature[data-uid="${u}"]`);
        if (n) n.classList.add('dying');
      });
      await wait(420);
    }
    render();
  }

  // Update a creature's stat badges in place mid-combat (full render waits
  // until the sequence ends so animations aren't wiped).
  function refreshStats(uid) {
    const c = duel.findCreature(uid);
    const n = el.querySelector(`.creature[data-uid="${uid}"]`);
    if (!c || !n) return;
    const pw = n.querySelector('.pw'), hp = n.querySelector('.hp');
    if (pw) pw.textContent = duel.power(c);
    if (hp) {
      hp.textContent = duel.health(c);
      if (c.damage > 0) hp.classList.add('hurt');
    }
  }

  async function playerAttack() {
    if (!selectedAttackers.size || phase !== 'main') return;
    phase = 'busy';
    const attackers = [...selectedAttackers];
    selectedAttackers = new Set();
    render();
    const npcBlocks = CW.aiChooseBlockers(duel, 1, attackers);
    await wait(150);
    if (ended) return;
    await animateCombat(attackers, npcBlocks, 0);
    if (ended) return;
    if (duel.winner !== null) return finishDuel();
    await wait(350);
    if (ended) return;
    npcTurn();
  }

  /* ---- NPC turn ---- */
  async function npcTurn() {
    phase = 'busy';
    selectedAttackers = new Set();
    duel.endTurn(); // starts NPC turn (draw + upkeep)
    processEvents();
    render();
    if (duel.winner !== null) return finishDuel();
    banner(`${npc.name.split(' ')[0]}'s turn`);
    await wait(650);
    if (ended) return;

    if (CW.aiShouldMulligan(duel, 1)) {
      duel.mulligan(1);
      render();
      await wait(550);
      if (ended) return;
    }

    // Mana is the only limit — the NPC plays out its turn one card at a time.
    for (let plays = 0; plays < 10; plays++) {
      const play = CW.aiChoosePlay(duel, 1);
      if (!play) break;
      const def = CW.CARDS[duel.players[1].hand[play.handIndex]];
      if (def.type === 'instant' && !reducedMotion()) {
        const src = el.querySelector('#opplife');
        if (src) await flySpell(def, src.getBoundingClientRect(), targetRectFor(def, play.targets, 1));
        if (ended) return;
      }
      const rects = snapshotRects();
      if (!duel.playCard(1, play.handIndex, play.targets)) break;
      UI.sfx.play();
      processEvents(rects);
      render();
      if (duel.winner !== null) return finishDuel();
      await wait(750);
      if (ended) return;
    }

    npcAttackers = CW.aiChooseAttackers(duel, 1);
    if (!npcAttackers.length) return endNpcTurn();

    // Can the player block anything?
    const canBlockAny = duel.players[0].board.some(b =>
      npcAttackers.some(a => {
        const ac = duel.findCreature(a);
        return ac && duel.canBlock(b, ac);
      }));
    blocks = {}; selectedEnemy = null;
    if (canBlockAny) {
      phase = 'block';
      render();
    } else {
      render();
      await wait(500);
      resolveNpcAttack();
    }
  }

  function blockClick(uid) {
    const enemy = duel.players[1].board.find(c => c.uid === uid);
    if (enemy) {
      if (!npcAttackers.includes(uid)) return;
      selectedEnemy = selectedEnemy === uid ? null : uid;
      UI.sfx.click();
      render();
      return;
    }
    const mine = duel.players[0].board.find(c => c.uid === uid);
    if (!mine) return;
    // clicking an assigned blocker unassigns it
    for (const a in blocks) {
      if (blocks[a] === uid) { delete blocks[a]; UI.sfx.click(); render(); return; }
    }
    if (!selectedEnemy) return;
    const attacker = duel.findCreature(selectedEnemy);
    if (!attacker || !duel.canBlock(mine, attacker)) return;
    blocks[selectedEnemy] = uid;
    selectedEnemy = null;
    UI.sfx.click();
    render();
  }

  async function resolveNpcAttack() {
    phase = 'busy';
    const attackers = npcAttackers.slice();
    const theirBlocks = Object.assign({}, blocks);
    blocks = {}; npcAttackers = []; selectedEnemy = null;
    render();
    await wait(150);
    if (ended) return;
    await animateCombat(attackers, theirBlocks, 1);
    if (ended) return;
    if (duel.winner !== null) return finishDuel();
    await wait(300);
    if (ended) return;
    endNpcTurn();
  }

  function endNpcTurn() {
    if (ended) return;
    duel.endTurn(); // starts player turn
    processEvents();
    if (duel.winner !== null) { render(); return finishDuel(); }
    phase = 'main';
    render();
    banner('Your turn');
  }

  /* ---- event → feedback ---- */
  // Positions of every creature, captured BEFORE an action mutates the board,
  // so damage numbers can land where a creature was even if it died.
  function snapshotRects() {
    const map = {};
    el.querySelectorAll('.creature[data-uid]').forEach(n => { map[n.dataset.uid] = n.getBoundingClientRect(); });
    return map;
  }
  function rectFor(uid, rects) {
    const live = el.querySelector(`.creature[data-uid="${uid}"]`);
    if (live) return live.getBoundingClientRect();
    return rects && rects[uid];
  }

  function processEvents(rects) {
    const evs = duel.events.slice(evCursor);
    evCursor = duel.events.length;
    let died = false;
    for (const ev of evs) {
      if (ev.t === 'play') playedCards[ev.p].push(ev.card);
      if (ev.t === 'face') {
        floatAt(ev.p === 0 ? '#mylife' : '#opplife', '-' + ev.n, false);
        pulse(ev.p === 0 ? '#mylife' : '#opplife');
        if (ev.n >= 4) shake();
      }
      if (ev.t === 'heal') floatAt(ev.p === 0 ? '#mylife' : '#opplife', '+' + ev.n, true);
      if (ev.t === 'hit' && ev.n > 0) floatRect(rectFor(ev.uid, rects), '-' + ev.n, false);
      if (ev.t === 'clash') {
        if (ev.dmgToB > 0) floatRect(rectFor(ev.b, rects), '-' + ev.dmgToB, false);
        if (ev.dmgToA > 0) floatRect(rectFor(ev.a, rects), '-' + ev.dmgToA, false);
      }
      if (ev.t === 'buff') floatRect(rectFor(ev.uid, rects), '▲', true);
      if (ev.t === 'die') died = true;
    }
    if (died) UI.sfx.death();
    return evs;
  }
  function floatAt(sel, text, heal) {
    const n = el.querySelector(sel);
    if (n) floatRect(n.getBoundingClientRect(), text, heal);
  }
  function floatRect(r, text, heal) {
    if (!r) return;
    const f = document.createElement('div');
    f.className = 'dmgfloat' + (heal ? ' healfloat' : '');
    f.textContent = text;
    f.style.left = (r.left + r.width / 2 - 10 + (Math.random() * 16 - 8)) + 'px';
    f.style.top = (r.top - 8) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }
  function pulse(sel) {
    const n = el.querySelector(sel);
    if (!n) return;
    n.classList.remove('pulse');
    void n.offsetWidth;
    n.classList.add('pulse');
  }
  function shake() {
    const d = el.querySelector('.duel');
    if (!d) return;
    d.classList.remove('shake');
    void d.offsetWidth;
    d.classList.add('shake');
  }
  function banner(text) {
    const b = document.createElement('div');
    b.className = 'turnbanner';
    b.textContent = text;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1150);
  }

  async function finishDuel() {
    if (ended) return;
    ended = true;
    phase = 'over';
    render();
    await wait(800);
    UI.duelOver(npc, duel.winner === 0);
  }
})();
