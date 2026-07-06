/* The Cardwright — UI shell: title, town, shops, packs, binder, builder, victory. */
(function () {
  'use strict';
  const CW = window.CW;
  const UI = (CW.UI = {});
  let G = null; // current game state

  const $ = (sel) => document.querySelector(sel);
  const esc = CW.escapeHTML;
  UI.getGame = () => G;
  UI.rng = CW.makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

  /* ================= audio settings ================= */
  // Persisted in the save state object (G.settings) and mirrored to
  // localStorage so the title screen respects them before a game loads.
  UI.settings = { master: 1, music: 0.8, sfx: 0.8, muted: false };
  try { Object.assign(UI.settings, JSON.parse(localStorage.getItem('cardwright_settings') || '{}')); } catch (e) { /* fine */ }
  function saveSettings() {
    try { localStorage.setItem('cardwright_settings', JSON.stringify(UI.settings)); } catch (e) { /* fine */ }
    if (G) { G.settings = Object.assign({}, UI.settings); CW.autosave(G); }
    if (CW.Music) CW.Music.refresh();
  }
  function adoptGameSettings() {
    if (G && G.settings) {
      Object.assign(UI.settings, G.settings);
      try { localStorage.setItem('cardwright_settings', JSON.stringify(UI.settings)); } catch (e) { /* fine */ }
      if (CW.Music) CW.Music.refresh();
    }
  }

  /* ================= tiny synth (sound effects, no assets) ================= */
  let audioCtx = null;
  function blip(freq, dur, type, vol, when) {
    const s = UI.settings;
    if (s.muted) return;
    const level = (vol || 0.08) * s.sfx * s.master;
    if (level <= 0.0005) return;
    if (CW.Music) CW.Music.duck(); // music dips to half while effects play
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime + (when || 0);
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio blocked — fine */ }
  }
  UI.sfx = {
    click: () => blip(660, 0.07, 'triangle', 0.05),
    play: () => { blip(440, 0.1, 'triangle', 0.07); blip(660, 0.12, 'triangle', 0.05, 0.06); },
    hit: () => blip(180, 0.16, 'sawtooth', 0.09),
    death: () => { blip(240, 0.2, 'sawtooth', 0.07); blip(120, 0.28, 'sawtooth', 0.07, 0.08); },
    coin: () => { blip(880, 0.09, 'square', 0.045); blip(1320, 0.12, 'square', 0.04, 0.07); },
    flip: () => blip(520, 0.08, 'triangle', 0.06),
    rare: () => { [523, 659, 784].forEach((f, i) => blip(f, 0.18, 'triangle', 0.07, i * 0.09)); },
    mythic: () => { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.08, i * 0.1)); },
    win: () => { [392, 523, 659, 784].forEach((f, i) => blip(f, 0.3, 'triangle', 0.08, i * 0.13)); },
    lose: () => { [330, 262, 196].forEach((f, i) => blip(f, 0.3, 'triangle', 0.06, i * 0.15)); },
    // faction-flavored combat impacts
    smack: (fac) => {
      switch (fac) {
        case 'emberkin': blip(520, 0.07, 'sawtooth', 0.09); blip(190, 0.16, 'sawtooth', 0.08, 0.02); break;
        case 'bramblewood': blip(120, 0.18, 'sine', 0.12); blip(75, 0.26, 'sine', 0.1, 0.04); break;
        case 'gloamveil': blip(920, 0.1, 'sine', 0.055); blip(460, 0.16, 'sine', 0.05, 0.05); break;
        case 'cogsworn': blip(1250, 0.045, 'square', 0.06); blip(680, 0.09, 'square', 0.055, 0.03); break;
        default: blip(180, 0.16, 'sawtooth', 0.09);
      }
    },
    spell: (fac) => {
      switch (fac) {
        case 'emberkin': blip(600, 0.1, 'sawtooth', 0.06); blip(900, 0.14, 'sawtooth', 0.045, 0.05); break;
        case 'bramblewood': blip(330, 0.16, 'triangle', 0.07); blip(495, 0.2, 'triangle', 0.05, 0.08); break;
        case 'gloamveil': blip(1040, 0.14, 'sine', 0.05); blip(780, 0.18, 'sine', 0.045, 0.07); break;
        case 'cogsworn': blip(880, 0.06, 'square', 0.05); blip(1320, 0.09, 'square', 0.04, 0.04); break;
        default: blip(700, 0.12, 'triangle', 0.06);
      }
    },
  };
  UI.toggleMute = () => {
    UI.settings.muted = !UI.settings.muted;
    saveSettings();
    return UI.settings.muted;
  };

  /* ================= settings dialog ================= */
  UI.settingsDialog = function () {
    const s = UI.settings;
    UI.dialog({
      name: 'Settings',
      html: `
        <div class="setrow"><label for="vol-master">Master volume</label><input type="range" id="vol-master" min="0" max="100" value="${Math.round(s.master * 100)}"></div>
        <div class="setrow"><label for="vol-music">Music</label><input type="range" id="vol-music" min="0" max="100" value="${Math.round(s.music * 100)}"></div>
        <div class="setrow"><label for="vol-sfx">Sound effects</label><input type="range" id="vol-sfx" min="0" max="100" value="${Math.round(s.sfx * 100)}"></div>
        <div class="setrow"><label for="vol-mute">Mute everything</label><input type="checkbox" id="vol-mute" ${s.muted ? 'checked' : ''}></div>`,
      actions: [{ label: 'Done', primary: true }],
      wire: (ov) => {
        ov.querySelector('#vol-master').oninput = (e) => { s.master = e.target.value / 100; saveSettings(); };
        ov.querySelector('#vol-music').oninput = (e) => { s.music = e.target.value / 100; saveSettings(); };
        ov.querySelector('#vol-sfx').oninput = (e) => { s.sfx = e.target.value / 100; saveSettings(); blip(660, 0.07, 'triangle', 0.05); };
        ov.querySelector('#vol-mute').onchange = (e) => { s.muted = e.target.checked; saveSettings(); topbar(true); };
      },
    });
  };

  /* ================= topbar & router ================= */
  function topbar(show) {
    const tb = $('#topbar');
    if (!show) { tb.style.display = 'none'; return; }
    tb.style.display = 'flex';
    const owned = Object.values(G.collection).reduce((a, b) => a + b, 0);
    tb.innerHTML = `
      <span class="logo">The Cardwright<small>a Stoken Games tale</small></span>
      <span class="chip">${CW.coinSVG(16)} <b id="coinamt">${G.coins}</b></span>
      <span class="chip" title="Cards in collection">🗃 ${owned}</span>
      <span class="spacer"></span>
      <button data-nav="town">Town</button>
      <button data-nav="binder">Binder</button>
      <button data-nav="builder">Deck</button>
      <button data-nav="rules" title="How to play">? Rules</button>
      <button data-nav="save">Save</button>
      <button data-nav="settings" title="Volume settings">⚙</button>
      <button data-nav="mute" title="Toggle sound">${UI.settings.muted ? '🔇' : '🔊'}</button>`;
    tb.querySelectorAll('button').forEach(b => b.onclick = () => {
      const nav = b.dataset.nav;
      UI.sfx.click();
      if (nav === 'mute') { UI.toggleMute(); topbar(true); return; }
      if (nav === 'settings') return UI.settingsDialog();
      if (nav === 'rules') return UI.rulesDialog();
      if (nav === 'save') return UI.saveDialog();
      if (UI.inDuel) return; // no wandering off mid-duel
      UI.show(nav);
    });
  }

  UI.show = function (name, arg) {
    UI.inDuel = false;
    const el = $('#screen');
    el.innerHTML = '';
    // Screen music. Binder and builder keep whatever is already playing.
    if (name === 'title') CW.Music.play('victory', 0.4);
    else if (name === 'town') CW.Music.play('town');
    else if (name === 'shop') CW.Music.play('shop');
    else if (name === 'victory') CW.Music.play('victory', 1);
    else if (name === 'duel') CW.Music.play(arg === 'wren' ? 'wren' : 'duel');
    if (name === 'title') { topbar(false); renderTitle(el); }
    else {
      topbar(true);
      if (name === 'town') renderTown(el);
      else if (name === 'shop') renderShop(el, arg);
      else if (name === 'binder') renderBinder(el);
      else if (name === 'builder') renderBuilder(el);
      else if (name === 'victory') renderVictory(el);
      else if (name === 'duel') { UI.inDuel = true; CW.DuelUI.start(el, arg); }
    }
    if (G) CW.autosave(G);
  };

  /* ================= dialog helper ================= */
  // spec: {portrait, ring, name, title, lines[], actions[{label, fn, primary, danger}], html}
  UI.dialog = function (spec) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    let li = 0;
    const render = () => {
      const line = spec.lines && spec.lines[li];
      const lastLine = !spec.lines || li >= spec.lines.length - 1;
      ov.innerHTML = `
      <div class="dialog">
        ${spec.name ? `<div class="who">${spec.portrait ? CW.portraitSVG(spec.portrait, spec.ring, 68) : ''}
          <div><div class="name">${esc(spec.name)}</div>${spec.title ? `<div class="title">${esc(spec.title)}</div>` : ''}</div></div>` : ''}
        ${line ? `<div class="line">“${esc(line)}”</div>` : ''}
        ${spec.html || ''}
        <div class="actions">
          ${!lastLine ? '<button class="btn primary" data-a="next">Continue</button>'
          : (spec.actions || [{ label: 'Okay' }]).map((a, i) =>
            `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}
        </div>
      </div>`;
      ov.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
        UI.sfx.click();
        if (b.dataset.a === 'next') { li++; render(); return; }
        const act = (spec.actions || [{}])[Number(b.dataset.a)];
        ov.remove();
        if (act && act.fn) act.fn();
      });
      if (spec.wire) spec.wire(ov);
    };
    render();
    document.body.appendChild(ov);
    // Esc presses the harmless button, if the dialog has one.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!document.body.contains(ov)) { document.removeEventListener('keydown', onKey); return; }
      const btns = [...ov.querySelectorAll('button[data-a]')];
      const safe = btns.find(b => /^(okay|close|back|cancel|keep|got it|done|maybe later|later|fair enough|into town)/i.test(b.textContent.trim()));
      if (safe) safe.click();
    };
    document.addEventListener('keydown', onKey);
    return ov;
  };

  /* ================= title ================= */
  function renderTitle(el) {
    const showcase = ['solance', 'yewla', 'nocturne', 'grand_orrery'];
    el.innerHTML = `
    <div class="title-screen">
      <h1>The Cardwright</h1>
      <div class="sub">The town of Drafthollow duels after supper. Four card shops, five proud locals,
        and one retired legend holding court in the square. You've got a starter deck, fifty coins,
        and a name nobody knows yet.</div>
      <div class="title-cards">${showcase.map(id => CW.cardHTML(id)).join('')}</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center">
        <button class="btn primary" id="newgame">Arrive in Drafthollow</button>
        <button class="btn" id="importgame">Import Save</button>
        ${CW.loadAutosave() ? '<button class="btn" id="continuegame">Continue</button>' : ''}
      </div>
      <div class="studio">✦ Stoken Games ✦</div>
    </div>`;
    $('#newgame').onclick = () => {
      UI.sfx.play();
      G = CW.newGame();
      G.settings = Object.assign({}, UI.settings);
      UI.dialog({
        name: 'Drafthollow Gazette', title: 'pinned to the coach-house door',
        lines: [
          'WELCOME, TRAVELER! Our town duels the old way: ten cards, fifteen life, and no hard feelings that outlast the handshake.',
          'The four card shops each give newcomers a free booster — call in and say hello. When you feel ready, young Pip is always at the fountain, bouncing.',
          'And if you dream big: Wren Halloway still takes challengers at the town square. Champions have tried. Champions have sat down after.',
        ],
        actions: [
          { label: 'Teach me the rules first', fn: () => UI.rulesDialog(() => UI.show('town')) },
          { label: 'Into town', primary: true, fn: () => UI.show('town') },
        ],
      });
    };
    $('#importgame').onclick = () => UI.importDialog();
    const cont = $('#continuegame');
    if (cont) cont.onclick = () => { G = CW.loadAutosave(); adoptGameSettings(); UI.show('town'); };
  }

  /* ================= rules primer ================= */
  UI.rulesDialog = function (onClose) {
    UI.dialog({
      name: 'How to Duel in Drafthollow',
      html: `
      <div class="rules">
        <h4>The basics</h4>
        <ul>
          <li>Both duelists start at <b>15 life</b> with a <b>deck of exactly 10 cards</b>. Bring the other duelist to 0 to win.</li>
          <li>You get <b>1 mana on turn 1, 2 on turn 2</b>, and so on up to <b>5</b>. Mana refills every turn.</li>
          <li>Play <b>as many cards each turn as your mana covers</b> — mana is the whole budget. You draw one card each turn. (Fair-start rules: whoever goes first skips their very first draw, and whoever goes second gets one bonus mana on their first turn.)</li>
          <li><b>Mulligan:</b> once per duel, before doing anything on your first turn, you may shuffle your hand back and redraw.</li>
          <li><b>Hover over any card</b> — in your hand, on the table, anywhere — to read a full-size copy. On a touch screen, <b>press and hold</b> instead.</li>
        </ul>
        <h4>The three card types</h4>
        <ul>
          <li><span class="rchip" style="--c:#b0642e">Creature</span> Stays on your board. The left number is <b>power</b> (damage it deals), the right is <b>health</b>. Damage sticks — creatures don't heal between turns.</li>
          <li><span class="rchip" style="--c:#2b6a9c">Instant</span> A one-shot effect — burn, healing, a buff, removal — then it's spent.</li>
          <li><span class="rchip" style="--c:#9c6f1e">Enchant</span> Stays in play forever, quietly working: a constant bonus, or an effect at the start of each of your turns.</li>
        </ul>
        <h4>Attacking &amp; blocking</h4>
        <ul>
          <li>A creature can attack starting the turn <i>after</i> it arrives (unless it has Swift).</li>
          <li>On your turn: play a card if you like, then <b>choose attackers</b> and attack. Heads up — once you attack, your turn ends after the dust settles.</li>
          <li>The defender assigns <b>blockers</b>, one per attacker. Blocked creatures strike each other <b>at the same time</b> — both can fall. Unblocked attackers hit the duelist.</li>
          <li>When an opponent attacks you, you'll pick your blockers the same way: click their attacker, then your creature.</li>
        </ul>
        <h4>Keywords</h4>
        <ul>
          <li><b>⚡ Swift</b> — may attack the turn it arrives.</li>
          <li><b>🌘 Shadow</b> — can only be blocked by other Shadow creatures.</li>
          <li><b>🛡 Armor N</b> — takes N less damage from every creature hit in combat. (Spells and effects burn straight through armor.)</li>
          <li><b>☠ Venom</b> — destroys any creature it damages, no matter how big.</li>
        </ul>
        <h4>Tiebreakers &amp; fine print</h4>
        <ul>
          <li>Clashing creatures deal damage <b>simultaneously</b> — a mutual defeat is an honorable trade.</li>
          <li>If a duel somehow reaches <b>15 rounds</b> (30 turns), the judges call it: <b>higher life wins</b>, and a perfect tie goes to your opponent. Champions win decisively.</li>
          <li>Hands hold at most <b>8 cards</b>. If yours is full, the draw waits on top of your deck for next turn.</li>
          <li>Empty deck? No harm — you simply stop drawing.</li>
          <li>After you take the championship, the locals bring out their <b>gauntlet decks</b> — harder duels worth +15 coins.</li>
          <li>Conceding is always allowed, and always polite. It just doesn't pay — coins go to duels fought to the end.</li>
          <li>Keyboard: <b>Space</b> attacks or ends your turn, <b>Esc</b> closes dialogs.</li>
        </ul>
      </div>`,
      actions: [{ label: 'Got it', primary: true, fn: onClose || null }],
    });
  };

  UI.importDialog = function () {
    UI.dialog({
      name: 'Import Save',
      html: `<div class="line">Paste your save text below.</div><textarea id="importbox" placeholder="Paste save here..."></textarea><div id="importerr" style="color:#a2402c;font-size:13px;margin-top:6px"></div>`,
      actions: [
        { label: 'Cancel' },
        { label: 'Load', primary: true, fn: () => { } },
      ],
      wire: (ov) => {
        ov.querySelectorAll('button[data-a]')[1].onclick = () => {
          try {
            G = CW.loadString(ov.querySelector('#importbox').value);
            adoptGameSettings();
            ov.remove();
            UI.show(G.champion ? 'victory' : 'town');
          } catch (e) {
            ov.querySelector('#importerr').textContent = 'That doesn\'t look like a Cardwright save. (' + e.message + ')';
          }
        };
      },
    });
  };

  UI.saveDialog = function () {
    const str = CW.saveString(G);
    UI.dialog({
      name: 'Save & Export',
      html: `<div class="line">Copy this text anywhere safe — it is your whole journey.</div>
        <textarea id="savebox" readonly>${str}</textarea>
        <div class="line" style="font-size:13px;color:#6b5842">…or paste a different save below to load it. Loading replaces your current town, so export first if you want to keep this run.</div>
        <textarea id="loadbox" placeholder="Paste a save to load..."></textarea>
        <div id="saveerr" style="color:#a2402c;font-size:13px"></div>`,
      actions: [
        { label: 'Copy to clipboard', fn: null, primary: true },
        { label: 'Load pasted save' },
        { label: 'New game', danger: true },
        { label: 'Close' },
      ],
      wire: (ov) => {
        const btns = ov.querySelectorAll('button[data-a]');
        btns[0].onclick = () => {
          const box = ov.querySelector('#savebox');
          box.select();
          try { navigator.clipboard.writeText(box.value); } catch (e) { document.execCommand('copy'); }
          btns[0].textContent = 'Copied!';
        };
        btns[1].onclick = () => {
          try {
            G = CW.loadString(ov.querySelector('#loadbox').value);
            adoptGameSettings();
            ov.remove(); UI.show(G.champion ? 'victory' : 'town');
          } catch (e) { ov.querySelector('#saveerr').textContent = 'Invalid save text.'; }
        };
        btns[2].onclick = () => {
          ov.remove();
          UI.dialog({
            name: 'Start over?', lines: ['Abandon this journey and arrive in Drafthollow fresh? Your current save will be lost unless you copied it.'],
            actions: [{ label: 'Keep playing' }, { label: 'Start over', danger: true, fn: () => { CW.clearAutosave(); UI.show('title'); } }],
          });
        };
        btns[3].onclick = () => ov.remove();
      },
    });
  };

  /* ================= town map ================= */
  const MAP_SPOTS = [
    // shops
    { kind: 'shop', id: 'sprocket', x: 170, y: 150, label: 'Sprocket & Spark' },
    { kind: 'shop', id: 'moth', x: 850, y: 140, label: 'The Velvet Moth' },
    { kind: 'shop', id: 'kiln', x: 150, y: 430, label: 'The Kiln & Candle' },
    { kind: 'shop', id: 'root', x: 870, y: 440, label: 'Root Cellar Cards' },
    // duelists
    { kind: 'npc', id: 'pip', x: 512, y: 415, label: 'Fountain Steps' },
    { kind: 'npc', id: 'sorrel', x: 700, y: 500, label: 'Allotment Gardens' },
    { kind: 'npc', id: 'brick', x: 320, y: 500, label: 'Hearth & Crust' },
    { kind: 'npc', id: 'nyx', x: 680, y: 220, label: 'Moonlight Theatre' },
    { kind: 'npc', id: 'tessa', x: 340, y: 215, label: 'Waterworks Yard' },
    { kind: 'npc', id: 'wren', x: 512, y: 285, label: 'Town Square' },
  ];

  function houseSVG(x, y, color, roof, w) {
    w = w || 74;
    const h = w * 0.62;
    return `<g transform="translate(${x - w / 2} ${y - h - 8})">
      <rect x="0" y="${h * 0.42}" width="${w}" height="${h * 0.62}" rx="3" fill="${color}" stroke="#4a3520" stroke-width="2"/>
      <path d="M-6 ${h * 0.46} L${w / 2} -4 L${w + 6} ${h * 0.46} Z" fill="${roof}" stroke="#4a3520" stroke-width="2"/>
      <rect x="${w * 0.4}" y="${h * 0.62}" width="${w * 0.2}" height="${h * 0.42}" fill="#4a3520" rx="2"/>
      <rect x="${w * 0.12}" y="${h * 0.55}" width="${w * 0.17}" height="${w * 0.15}" fill="#ffe9a8" stroke="#4a3520"/>
      <rect x="${w * 0.71}" y="${h * 0.55}" width="${w * 0.17}" height="${w * 0.15}" fill="#ffe9a8" stroke="#4a3520"/>
    </g>`;
  }

  function renderTown(el) {
    const unlocked = (n) => n.tier <= G.beatenTier + 1;
    const beaten = (n) => n.tier <= G.beatenTier;
    let nodes = '';
    for (const s of MAP_SPOTS) {
      if (s.kind === 'shop') {
        const shop = CW.SHOPS.find(x => x.id === s.id);
        const fac = CW.FACTIONS[shop.faction];
        const gift = !G.welcomed[shop.id] ? `<circle cx="34" cy="-58" r="11" fill="#c8963c" stroke="#fff8e6" stroke-width="2"/><text x="34" y="-53" text-anchor="middle" font-size="13" fill="#fff">🎁</text>` : '';
        nodes += `<g class="mapnode" data-shop="${s.id}" transform="translate(${s.x} ${s.y})">
          <g class="plate">${houseSVG(0, 0, fac.color, fac.color2)}${gift}</g>
          <text x="0" y="18" text-anchor="middle" font-size="13.5" font-weight="bold" fill="#33261a">${esc(shop.name)}</text>
          <text x="0" y="33" text-anchor="middle" font-size="11" fill="#6b5842">${esc(fac.name)} packs · 40 coins</text>
        </g>`;
      } else {
        const npc = CW.NPC_BY_ID[s.id];
        const isW = s.id === 'wren';
        const lock = !unlocked(npc);
        const rose = beaten(npc) ? `<text x="26" y="-40" font-size="15">🏅</text>` : (unlocked(npc) ? `<circle cx="26" cy="-44" r="10" fill="#b0432e" stroke="#fff" stroke-width="2"/><text x="26" y="-39" text-anchor="middle" font-size="12" font-weight="bold" fill="#fff">!</text>` : '');
        nodes += `<g class="mapnode ${lock ? 'locked' : ''}" data-npc="${s.id}" transform="translate(${s.x} ${s.y})">
          <g class="plate">
            ${isW ? `<circle r="34" fill="#e8d9b8" stroke="#c8963c" stroke-width="3"/>` : `<circle r="30" fill="#efe4cd" stroke="#7a5a38" stroke-width="3"/>`}
            <g transform="translate(-24 -24) scale(0.667)">${CW.portraitSVG(s.id, npc.color, 72)}</g>
            ${lock ? `<circle r="30" fill="rgba(60,44,24,0.45)"/><text y="7" text-anchor="middle" font-size="22">🔒</text>` : rose}
          </g>
          <text x="0" y="52" text-anchor="middle" font-size="13.5" font-weight="bold" fill="#33261a">${esc(npc.name)}</text>
          <text x="0" y="67" text-anchor="middle" font-size="11" fill="#6b5842">${esc(s.label)} · Tier ${npc.tier}</text>
        </g>`;
      }
    }
    el.innerHTML = `
    <div class="town">
      <div class="mapwrap">
      <svg class="map" viewBox="0 0 1024 600">
        <defs>
          <radialGradient id="grass" cx="0.5" cy="0.4"><stop offset="0" stop-color="#b9c98a"/><stop offset="1" stop-color="#9cb476"/></radialGradient>
        </defs>
        <rect width="1024" height="600" rx="18" fill="url(#grass)" stroke="#7a5a38" stroke-width="4"/>
        <!-- river -->
        <path d="M0 90 C 200 120 260 60 420 80 C 600 102 640 40 1024 70 L1024 0 L0 0 Z" fill="#9ec4c9" opacity="0.85"/>
        <path d="M0 90 C 200 120 260 60 420 80 C 600 102 640 40 1024 70" fill="none" stroke="#7fa8ae" stroke-width="3"/>
        <!-- roads -->
        <g stroke="#d9c69c" stroke-width="26" stroke-linecap="round" fill="none" opacity="0.9">
          <path d="M512 300 L170 165 M512 300 L850 155 M512 300 L150 445 M512 300 L870 455 M512 300 L512 430 M512 300 L680 235 M512 300 L340 230 M512 300 L320 515 M512 300 L700 515"/>
        </g>
        <g stroke="#c8b184" stroke-width="2" stroke-dasharray="6 8" fill="none" opacity="0.8">
          <path d="M512 300 L170 165 M512 300 L850 155 M512 300 L150 445 M512 300 L870 455 M512 300 L512 430 M512 300 L680 235 M512 300 L340 230 M512 300 L320 515 M512 300 L700 515"/>
        </g>
        <!-- square plaza -->
        <circle cx="512" cy="300" r="66" fill="#d9c69c" stroke="#b99b6b" stroke-width="3"/>
        <circle cx="512" cy="405" r="20" fill="#9ec4c9" stroke="#7fa8ae" stroke-width="3"/>
        <circle cx="512" cy="405" r="7" fill="#e8f2f3"/>
        <!-- trees -->
        ${[[80, 260], [940, 300], [420, 545], [610, 120], [90, 555], [950, 555], [250, 330], [780, 330]].map(([x, y]) =>
      `<g transform="translate(${x} ${y})"><rect x="-3" y="6" width="6" height="14" fill="#7a5a38"/><circle cy="-2" r="16" fill="#6d9455"/><circle cx="-9" cy="4" r="10" fill="#7ba361"/><circle cx="9" cy="4" r="10" fill="#5f8549"/></g>`).join('')}
        ${nodes}
        <text x="512" y="586" text-anchor="middle" font-size="15" fill="#5a4128" font-style="italic">Drafthollow — pop. 312, plus one new cardwright</text>
      </svg>
      </div>
      <div class="hint">${townHint()}</div>
    </div>`;
    el.querySelectorAll('[data-shop]').forEach(n => n.onclick = () => { UI.sfx.click(); UI.show('shop', n.dataset.shop); });
    el.querySelectorAll('[data-npc]').forEach(n => {
      const npc = CW.NPC_BY_ID[n.dataset.npc];
      if (npc.tier > G.beatenTier + 1) {
        n.onclick = () => UI.dialog({
          name: 'A townsperson', lines: [lockHint(npc)],
          actions: [{ label: 'Fair enough', primary: true }],
        });
        return;
      }
      n.onclick = () => { UI.sfx.click(); challengeNPC(npc); };
    });
  }

  function townHint() {
    if (G.champion) return 'You are the Champion — and the town has sharpened its decks. Gauntlet duels pay +15 coins, and the locals\' best cards are up for grabs. ⚔';
    const next = CW.NPCS[G.beatenTier];
    const gifts = CW.SHOPS.filter(s => !G.welcomed[s.id]).length;
    if (gifts) return `The shops are waving you over — ${gifts} welcome gift${gifts > 1 ? 's' : ''} still unclaimed. 🎁`;
    return next ? `Next challenge: ${next.name} at ${next.spot}. Duel anyone you've already beaten for more coins and cards.` : '';
  }
  function lockHint(npc) {
    const gate = CW.NPCS[npc.tier - 2];
    return `${npc.name}? Oh, they only take challengers with a bit of a reputation. Beat ${gate.name} first and word will get around.`;
  }

  /* ================= challenge & duel handoff ================= */
  function challengeNPC(npc) {
    const problems = CW.deckProblems(G, G.deck);
    if (problems.length) {
      UI.dialog({
        name: 'Deck trouble', lines: ['Your deck isn\'t duel-ready: ' + problems.join(' ')],
        actions: [{ label: 'Fix my deck', primary: true, fn: () => UI.show('builder') }, { label: 'Later' }],
      });
      return;
    }
    const gauntlet = G.champion && npc.gauntletDeck;
    const lines = gauntlet ? [npc.gauntletIntro]
      : (G.met[npc.id] ? (npc.rematchIntro || npc.intro) : npc.intro);
    const reward = npc.winCoins + (gauntlet ? 15 : 0);
    UI.dialog({
      portrait: npc.id, ring: npc.color, name: npc.name, title: npc.title,
      lines,
      actions: [
        { label: `${gauntlet ? '⚔ Gauntlet duel' : 'Duel'}! (win: ${reward} coins + a card)`, primary: true, fn: () => { G.met[npc.id] = true; UI.show('duel', npc.id); } },
        { label: 'Maybe later', fn: () => { G.met[npc.id] = true; } },
      ],
    });
  }

  // Called by DuelUI when a duel ends. opts.conceded: walked away early.
  UI.duelOver = function (npc, playerWon, opts) {
    const conceded = opts && opts.conceded;
    G.stats.duels++;
    let rewardHtml = '';
    let winLine = npc.win;
    if (playerWon) {
      G.stats.wins++;
      const gauntlet = G.champion && npc.gauntletDeck;
      const coins = npc.winCoins + (gauntlet ? 15 : 0);
      G.coins += coins; G.stats.coinsEarned += coins;
      const prize = UI.rng.pick(gauntlet ? npc.gauntletDeck : npc.deck);
      CW.addCard(G, prize);
      const firstTime = npc.tier > G.beatenTier;
      if (!firstTime && npc.winRematch) winLine = npc.winRematch;
      if (firstTime) G.beatenTier = npc.tier;
      UI.sfx.win();
      rewardHtml = `<div class="rewardbox">
        <span class="coinreward">${CW.coinSVG(22)} +${coins}</span>
        <div>${CW.cardHTML(prize, { isNew: true })}</div>
      </div>
      <div class="line" style="font-size:13.5px;color:#6b5842">${esc(CW.CARDS[prize].name)} from ${esc(npc.name.split(' ')[0])}'s deck joins your collection.</div>
      ${firstTime && npc.tier < 6 ? `<div class="line" style="font-weight:bold">🔓 ${esc(CW.NPCS[npc.tier].name)} will duel you now!</div>` : ''}`;
      // First win over Wren is the championship; later wins are friendly rematches.
      if (npc.id === 'wren' && !G.champion) {
        CW.autosave(G);
        UI.dialog({
          portrait: 'wren', ring: npc.color, name: npc.name, title: npc.title,
          lines: [npc.win],
          actions: [{ label: 'Take the square', primary: true, fn: () => { G.champion = true; CW.autosave(G); UI.show('victory'); } }],
        });
        return;
      }
    } else if (conceded) {
      UI.sfx.lose();
      rewardHtml = `<div class="line" style="font-size:13.5px;color:#6b5842">Handshakes are free. The coins are for duels fought to the end.</div>`;
    } else {
      const coins = npc.loseCoins;
      G.coins += coins; G.stats.coinsEarned += coins;
      UI.sfx.lose();
      rewardHtml = `<div class="rewardbox"><span class="coinreward">${CW.coinSVG(22)} +${coins}</span></div>
      <div class="line" style="font-size:13.5px;color:#6b5842">Drafthollow rule: every duelist leaves with coin for the effort.</div>`;
    }
    CW.autosave(G);
    // keep the topbar honest while the reward dialog is up
    const coinEl = document.getElementById('coinamt');
    if (coinEl) coinEl.textContent = G.coins;
    const ov = UI.dialog({
      portrait: npc.id, ring: npc.color, name: npc.name, title: npc.title,
      lines: [playerWon ? winLine : npc.lose],
      html: rewardHtml,
      actions: [
        { label: 'Back to town', primary: true, fn: () => UI.show('town') },
        { label: 'Rematch', fn: () => challengeNPC(npc) },
      ],
    });
    if (playerWon) {
      const d = ov.querySelector('.dialog');
      if (d) setTimeout(() => UI.burst(d.getBoundingClientRect(), '#e0b23c', 18), 250);
    }
  };

  /* ================= shop ================= */
  function renderShop(el, shopId) {
    const shop = CW.SHOPS.find(s => s.id === shopId);
    const fac = CW.FACTIONS[shop.faction];
    const canBuy = G.coins >= CW.PACK_PRICE;
    const hasGift = !G.welcomed[shop.id];
    el.innerHTML = `
    <div class="shop">
      <div class="keeper">
        ${CW.portraitSVG(shop.id, fac.color, 84)}
        <div>
          <h2>${esc(shop.name)}</h2>
          <div style="font-size:13px;color:var(--ink2);margin:2px 0 8px">${esc(shop.keeper)}, proprietor</div>
          <div class="speech">“${esc(hasGift ? shop.welcome : UI.rng.pick(shop.greet))}”</div>
        </div>
      </div>
      <div class="wares">
        <div class="packwrap">
          ${CW.packSVG(shop.faction, 150)}
          <div style="margin-top:12px; display:flex; gap:8px; flex-direction:column; align-items:center">
            ${hasGift ? `<button class="btn primary" id="giftbtn">🎁 Claim welcome pack</button>` : ''}
            <button class="btn ${hasGift ? '' : 'primary'}" id="buybtn" ${canBuy ? '' : 'disabled'}>Buy pack · 40 coins (you have ${G.coins})</button>
          </div>
        </div>
        <div class="factionblurb">
          <h3 style="display:flex;align-items:center;gap:8px">${CW.iconSVG(fac.icon, fac.color, 22)} ${esc(fac.name)}</h3>
          <p style="margin:8px 0">${esc(fac.tagline)}</p>
          <p style="font-size:12.5px;color:var(--ink2)">Packs here lean ${esc(fac.name)} (about 7 in 10 cards). 3 commons, 1 uncommon, and 1 rare — sometimes something mythic.</p>
        </div>
      </div>
      <div style="text-align:center;margin-top:14px"><button class="btn" id="backbtn">Back to town</button></div>
    </div>`;
    $('#backbtn').onclick = () => { UI.sfx.click(); UI.show('town'); };
    const gift = $('#giftbtn');
    if (gift) gift.onclick = () => {
      G.welcomed[shop.id] = true;
      UI.sfx.coin();
      openPackFlow(shop, true);
    };
    $('#buybtn').onclick = () => {
      if (G.coins < CW.PACK_PRICE) return;
      G.coins -= CW.PACK_PRICE;
      UI.sfx.coin();
      openPackFlow(shop, false);
    };
  }

  function openPackFlow(shop, wasGift) {
    const cards = CW.openPack(shop.faction, UI.rng, G.collection);
    G.stats.packs++;
    const newIds = [];
    for (const id of cards) {
      if (!G.collection[id]) newIds.push(id);
      CW.addCard(G, id);
    }
    CW.autosave(G);
    renderPackOpening($('#screen'), shop, cards, newIds, wasGift);
  }

  /* ================= pack opening ================= */
  function renderPackOpening(el, shop, cards, newIds, wasGift) {
    topbar(true);
    CW.Music.play('pack'); // short sting, plays once and lets the room go quiet
    const rareIdx = 4; // last slot is the rare/mythic
    el.innerHTML = `
    <div class="packopen">
      <h2>${wasGift ? `${esc(shop.keeper)} slides a pack across the counter…` : `A fresh ${esc(CW.FACTIONS[shop.faction].name)} booster…`}</h2>
      <div class="cards">
        ${cards.map((id, i) => {
      const r = CW.CARDS[id].rarity;
      const glow = i === rareIdx ? (r === 'mythic' ? 'mythic-glow' : r === 'rare' ? 'rare-glow' : '') : '';
      return `<div class="flipcard ${glow}" data-i="${i}">
            <div class="inner">
              <div class="face back"></div>
              <div class="face front">${CW.cardHTML(id, { isNew: newIds.includes(id) })}</div>
            </div>
          </div>`;
    }).join('')}
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn" id="flipall">Flip all</button>
        <button class="btn primary" id="packdone" style="visibility:hidden">Tuck them into the binder</button>
      </div>
    </div>`;
    let flipped = 0;
    const total = cards.length;
    const flipOne = (fc) => {
      if (fc.classList.contains('flipped')) return;
      fc.classList.add('flipped');
      const id = cards[Number(fc.dataset.i)];
      const r = CW.CARDS[id].rarity;
      if (r === 'mythic') { UI.sfx.mythic(); sparkleBurst(fc); fc.classList.add('rare-pop'); }
      else if (r === 'rare') { UI.sfx.rare(); fc.classList.add('rare-pop'); }
      else UI.sfx.flip();
      flipped++;
      if (flipped >= total) $('#packdone').style.visibility = 'visible';
    };
    el.querySelectorAll('.flipcard').forEach(fc => fc.onclick = () => flipOne(fc));
    $('#flipall').onclick = () => {
      let d = 0;
      el.querySelectorAll('.flipcard').forEach(fc => { setTimeout(() => flipOne(fc), d); d += 220; });
    };
    $('#packdone').onclick = () => {
      UI.sfx.click();
      // Binder complete? That deserves a moment.
      const ownedKinds = CW.CARD_LIST.filter(c => G.collection[c.id]).length;
      if (ownedKinds === CW.CARD_LIST.length && !G.binderDone) {
        G.binderDone = true;
        CW.autosave(G);
        UI.sfx.mythic();
        UI.dialog({
          name: 'The binder is full', title: 'all 60 cards of the Drafthollow set',
          lines: ['Corvin Lace claims only three complete binders exist. Maribel Tusk says five. Either way, yours makes one more — every card in the set, gathered by hand. The shopkeepers will be telling this story for a while.'],
          actions: [{ label: 'Admire it in the binder', primary: true, fn: () => UI.show('binder') }, { label: 'Back to the shop', fn: () => UI.show('shop', shop.id) }],
        });
        setTimeout(() => {
          const d = document.querySelector('.dialog');
          if (d) UI.burst(d.getBoundingClientRect(), '#e0b23c', 24);
        }, 300);
        return;
      }
      UI.show('shop', shop.id);
    };
  }

  // Radial particle burst at an element or rect, in any color.
  UI.burst = function (elmOrRect, color, count) {
    const rect = elmOrRect.getBoundingClientRect ? elmOrRect.getBoundingClientRect() : elmOrRect;
    for (let i = 0; i < (count || 14); i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      if (color) s.style.background = color;
      s.style.left = (rect.left + rect.width / 2) + 'px';
      s.style.top = (rect.top + rect.height / 2) + 'px';
      const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 90;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  };
  function sparkleBurst(elm) { UI.burst(elm); }
  UI.sparkleBurst = sparkleBurst;

  /* ================= binder ================= */
  function renderBinder(el) {
    let facFilter = 'all', ownedOnly = false;
    const draw = () => {
      const list = CW.CARD_LIST.filter(c =>
        (facFilter === 'all' || c.faction === facFilter) && (!ownedOnly || G.collection[c.id]));
      const ownedKinds = CW.CARD_LIST.filter(c => G.collection[c.id]).length;
      el.innerHTML = `
      <div class="binder">
        <h2>Collection Binder <span style="font-size:14px;color:var(--ink2)">${ownedKinds}/${CW.CARD_LIST.length} discovered</span></h2>
        <div class="filters">
          <button class="fbtn ${facFilter === 'all' ? 'on' : ''}" data-f="all">All</button>
          ${Object.keys(CW.FACTIONS).map(f => `<button class="fbtn ${facFilter === f ? 'on' : ''}" data-f="${f}">${esc(CW.FACTIONS[f].name)}</button>`).join('')}
          <button class="fbtn ${ownedOnly ? 'on' : ''}" data-f="__owned">Owned only</button>
        </div>
        ${facFilter !== 'all' ? `<div style="display:flex;align-items:center;gap:10px;background:var(--paper);border:2px solid ${CW.FACTIONS[facFilter].color2};border-radius:12px;padding:10px 16px;margin-bottom:14px;font-style:italic;color:var(--ink2)">
          ${CW.iconSVG(CW.FACTIONS[facFilter].icon, CW.FACTIONS[facFilter].color, 26)} ${esc(CW.FACTIONS[facFilter].tagline)}</div>` : ''}
        <div class="grid">
          ${list.map(c => {
        const n = G.collection[c.id] || 0;
        return n ? CW.cardHTML(c, { count: n }) :
          `<div class="card unknown" title="Not yet discovered — ${esc(CW.RARITIES[c.rarity].name)} ${esc(CW.FACTIONS[c.faction].name)} card">
             <div class="unknownface" style="--rc:${CW.RARITIES[c.rarity].color}">?</div></div>`;
      }).join('')}
        </div>
      </div>`;
      el.querySelectorAll('.fbtn').forEach(b => b.onclick = () => {
        if (b.dataset.f === '__owned') ownedOnly = !ownedOnly; else facFilter = b.dataset.f;
        draw();
      });
    };
    draw();
  }

  /* ================= deck builder ================= */
  function renderBuilder(el) {
    let deck = G.deck.slice();
    let facFilter = 'all';
    const draw = () => {
      const remaining = {};
      for (const id in G.collection) remaining[id] = G.collection[id];
      for (const id of deck) remaining[id] = (remaining[id] || 0) - 1;
      const pool = CW.CARD_LIST.filter(c => (G.collection[c.id] || 0) > 0 && (facFilter === 'all' || c.faction === facFilter));
      pool.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
      const curve = [0, 0, 0, 0, 0];
      for (const id of deck) curve[Math.min(4, CW.CARDS[id].cost - 1)]++;
      const maxCurve = Math.max(1, ...curve);
      const sorted = deck.slice().sort((a, b) => CW.CARDS[a].cost - CW.CARDS[b].cost || a.localeCompare(b));
      const ok = deck.length === 10;
      el.innerHTML = `
      <div class="builder">
        <div class="pool">
          <h2>Deck Builder <span style="font-size:13.5px;color:var(--ink2)">click a card to add it</span></h2>
          <div class="filters">
            <button class="fbtn ${facFilter === 'all' ? 'on' : ''}" data-f="all">All</button>
            ${Object.keys(CW.FACTIONS).map(f => `<button class="fbtn ${facFilter === f ? 'on' : ''}" data-f="${f}">${esc(CW.FACTIONS[f].name)}</button>`).join('')}
          </div>
          <div class="grid">
            ${pool.map(c => {
        const left = remaining[c.id] || 0;
        return `<div class="poolcard ${left > 0 ? '' : 'depleted'}" data-add="${c.id}">${CW.cardHTML(c, { count: left })}</div>`;
      }).join('')}
          </div>
        </div>
        <div class="deckpane">
          <h3>Your deck <span style="color:${ok ? 'var(--green)' : 'var(--red)'}">${deck.length}/10</span></h3>
          <div class="curvebar">${curve.map((n, i) => `<div class="bar" style="height:${(n / maxCurve) * 100}%"><span>${n || ''}</span><em>${i + 1}${i === 4 ? '+' : ''}</em></div>`).join('')}</div>
          <div style="height:12px"></div>
          ${sorted.map((id, i) => {
        const c = CW.CARDS[id];
        return `<div class="deckrow" data-rm="${i}" title="Click to remove">
              <span class="cost">${c.cost}</span><span class="nm">${esc(c.name)}</span>
              <span class="pt">${c.type === 'creature' ? c.power + '/' + c.health : c.type}</span>
            </div>`;
      }).join('')}
          <div style="flex:1"></div>
          <button class="btn small" id="suggest">Suggest a deck</button>
          <button class="btn primary" id="savedeck" ${ok ? '' : 'disabled'}>${ok ? 'Save deck' : 'Need exactly 10 cards'}</button>
          <button class="btn small" id="canceldeck">Back (discard changes)</button>
        </div>
      </div>`;
      el.querySelectorAll('.fbtn').forEach(b => b.onclick = () => { facFilter = b.dataset.f; draw(); });
      el.querySelectorAll('[data-add]').forEach(n => {
        const id = n.dataset.add;
        n.onclick = () => {
          const rem = (G.collection[id] || 0) - deck.filter(x => x === id).length;
          if (rem <= 0 || deck.length >= 10) return;
          UI.sfx.click();
          deck.push(id); draw();
        };
      });
      el.querySelectorAll('[data-rm]').forEach(n => n.onclick = () => {
        UI.sfx.click();
        const id = sorted[Number(n.dataset.rm)];
        deck.splice(deck.indexOf(id), 1); draw();
      });
      $('#suggest').onclick = () => { UI.sfx.play(); deck = CW.buildDeck(G.collection); draw(); };
      $('#savedeck').onclick = () => {
        if (CW.deckProblems(G, deck).length) return;
        G.deck = deck.slice();
        CW.autosave(G);
        UI.sfx.coin();
        UI.show('town');
      };
      $('#canceldeck').onclick = () => UI.show('town');
    };
    draw();
  }

  /* ================= victory ================= */
  function renderVictory(el) {
    const mins = Math.round((Date.now() - G.stats.started) / 60000);
    el.innerHTML = `
    <div class="victory">
      <h1>🏆 Champion of Drafthollow</h1>
      <div style="display:flex;align-items:center;gap:14px">${CW.portraitSVG('wren', '#d4b24a', 90)}</div>
      <div class="wrenline">“${esc(CW.NPC_BY_ID.wren.victory)}”</div>
      <div class="stats">
        <span>⚔ ${G.stats.duels} duels (${G.stats.wins} won)</span>
        <span>📦 ${G.stats.packs} packs opened</span>
        <span>${'🗃'} ${Object.values(G.collection).reduce((a, b) => a + b, 0)} cards collected</span>
        <span>⏱ about ${mins === 1 ? 'a minute' : mins + ' minutes'} in town</span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <button class="btn primary" id="keepplaying">Keep dueling Drafthollow</button>
        <button class="btn" id="exportwin">Export save</button>
      </div>
      <div class="studio" style="margin-top:18px;font-size:12px;letter-spacing:3px;color:#8a744f">✦ STOKEN GAMES THANKS YOU FOR PLAYING ✦</div>
    </div>`;
    // confetti
    const colors = ['#e2543e', '#5a9e4b', '#8b6fc9', '#c9963f', '#e0b23c'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.5 + Math.random() * 3) + 's';
      c.style.animationDelay = (Math.random() * 2) + 's';
      el.querySelector('.victory').appendChild(c);
    }
    $('#keepplaying').onclick = () => UI.show('town');
    $('#exportwin').onclick = () => UI.saveDialog();
  }

  /* ================= big card hover preview ================= */
  // Hovering any card anywhere (hand, board, binder, shop, dialogs, enchant
  // chips) shows a large readable copy on the empty side of the screen.
  function setupPreview() {
    const prev = document.createElement('div');
    prev.id = 'cardpreview';
    document.body.appendChild(prev);
    let shownFor = null;
    const hide = () => { prev.style.display = 'none'; shownFor = null; };
    const showFor = (target) => {
      const id = target.dataset.card || target.dataset.cid;
      const def = CW.CARDS[id];
      if (!def) { hide(); return false; } // tokens etc.
      if (shownFor !== target) {
        prev.innerHTML = CW.cardHTML(def);
        shownFor = target;
      }
      const r = target.getBoundingClientRect();
      const onLeftHalf = (r.left + r.width / 2) < window.innerWidth / 2;
      const pw = prev.offsetWidth || 340, ph = pw * 1.4;
      prev.style.left = onLeftHalf ? '' : '18px';
      prev.style.right = onLeftHalf ? '18px' : '';
      const top = Math.min(Math.max(12, r.top + r.height / 2 - ph / 2), window.innerHeight - ph - 12);
      prev.style.top = top + 'px';
      prev.style.display = 'block';
      return true;
    };

    if (window.matchMedia('(hover: hover)').matches) {
      document.addEventListener('mouseover', (e) => {
        const t = e.target.closest && e.target.closest('[data-card], [data-cid]');
        if (!t) { hide(); return; }
        showFor(t);
      });
      document.addEventListener('mousedown', hide, true);
    }

    // Touch: press and hold ~0.4s to preview; releasing after a preview
    // must not also trigger the tap (so peeking never plays a card).
    let holdTimer = null, held = false;
    document.addEventListener('touchstart', (e) => {
      const t = e.target.closest && e.target.closest('[data-card], [data-cid]');
      held = false;
      if (!t) { hide(); return; }
      holdTimer = setTimeout(() => { held = showFor(t); }, 400);
    }, { passive: true });
    document.addEventListener('touchmove', () => { clearTimeout(holdTimer); hide(); held = false; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      clearTimeout(holdTimer);
      if (held) {
        hide();
        held = false;
        if (e.cancelable) e.preventDefault(); // swallow the tap
      }
    }, { passive: false });
    window.addEventListener('scroll', hide, true);
  }

  /* ================= boot ================= */
  window.addEventListener('DOMContentLoaded', () => { setupPreview(); UI.show('title'); });
})();
