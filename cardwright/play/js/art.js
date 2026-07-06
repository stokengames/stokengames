/* Cardwright — procedural SVG art: cards, faction icons, NPC portraits. */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Small deterministic hash for per-card art variation.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---- faction icons (24x24 viewBox paths) ---- */
  const ICONS = {
    flame: 'M12 2c1 4-3 5-3 9a3.5 3.5 0 0 0 2 3.2c-.4-1.4.2-2.6 1.3-3.7.2 1.7 2.7 2.4 2.7 5A3 3 0 0 1 12 19a7 7 0 0 1-7-7c0-5 5-6 7-10zm0 20a9 9 0 0 0 9-9c0-2-1-4-2-5 .5 5-2 7-3 7.5.7-2-.5-3.5-1.5-4.5',
    leaf: 'M20 4C10 4 4 10 4 18c0 1 .2 2 .5 2.5C6 21 7 21 8 21c8 0 12-6 12-14v-3zM6.5 19C8 13 12 9 17 7c-4 4-7 8-8.5 12h-2z',
    moth: 'M12 4c-1.5 3-4 4-7 4 0 4 3 7 7 7s7-3 7-7c-3 0-5.5-1-7-4zm0 9c-.8 2-2.5 3.5-5 4 1 2.5 3 4 5 4s4-1.5 5-4c-2.5-.5-4.2-2-5-4zm0-9v16',
    gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11 2h2l.5 3a7 7 0 0 1 2 .8l2.5-1.7 1.4 1.4-1.7 2.5a7 7 0 0 1 .8 2l3 .5v2l-3 .5a7 7 0 0 1-.8 2l1.7 2.5-1.4 1.4-2.5-1.7a7 7 0 0 1-2 .8l-.5 3h-2l-.5-3a7 7 0 0 1-2-.8l-2.5 1.7-1.4-1.4 1.7-2.5a7 7 0 0 1-.8-2l-3-.5v-2l3-.5a7 7 0 0 1 .8-2L4.6 5.9 6 4.5l2.5 1.7a7 7 0 0 1 2-.8L11 2z',
  };
  CW.iconSVG = function (icon, color, size) {
    return `<svg viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" aria-hidden="true"><path d="${ICONS[icon]}" fill="${color}"/></svg>`;
  };

  const KW_TEXT = {
    swift: 'Swift (may attack the turn it arrives)',
    shadow: 'Shadow (only Shadow creatures can block it)',
    venom: 'Venom (destroys any creature it damages)',
  };
  CW.kwText = KW_TEXT;

  /* ---- procedural card art scene ---- */
  function artScene(def, w, h) {
    const fac = CW.FACTIONS[def.faction];
    const seed = hash(def.id);
    const bits = [];
    // Background wash
    bits.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#g_${def.id})"/>`);
    // Scattered motes — deterministic per card
    for (let i = 0; i < 8; i++) {
      const x = ((seed >>> (i * 3)) % 100) / 100 * w;
      const y = ((seed >>> (i * 2 + 1)) % 100) / 100 * h;
      const r = 1.5 + ((seed >>> i) % 5);
      const op = 0.12 + ((seed >>> (i + 4)) % 20) / 100;
      bits.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${op.toFixed(2)}"/>`);
    }
    // Rolling ground silhouettes
    const gy = h * (0.68 + ((seed >>> 7) % 12) / 100);
    bits.push(`<path d="M0 ${gy} Q ${w * 0.25} ${gy - 14} ${w * 0.5} ${gy} T ${w} ${gy} V ${h} H 0 Z" fill="${fac.color2}" opacity="0.55"/>`);
    // This card's own emblem, large and centered
    const isz = Math.min(w, h) * 0.72;
    bits.push(`<g transform="translate(${(w - isz) / 2} ${(h - isz) / 2 - 2}) scale(${isz / 24})">${CW.glyphFor(def, '#fff8ee', fac.color2)}</g>`);
    return bits.join('');
  }

  /* ---- full card ----
   * opts: {count: show owned count, small: hint for CSS class, sel: selected} */
  CW.cardHTML = function (defOrId, opts) {
    opts = opts || {};
    const def = typeof defOrId === 'string' ? CW.CARDS[defOrId] : defOrId;
    const fac = CW.FACTIONS[def.faction] || CW.FACTIONS.cogsworn;
    const rar = CW.RARITIES[def.rarity];
    const KW_REMIND = { swift: 'can attack at once', shadow: 'only Shadow can block it', venom: 'kills whatever it wounds' };
    const lines = [];
    for (const kw of def.kw) lines.push(`<b>${esc(kw[0].toUpperCase() + kw.slice(1))}</b> — ${KW_REMIND[kw]}.`);
    if (def.armor) lines.push(`<b>Armor ${def.armor}</b> — takes ${def.armor} less combat damage.`);
    if (def.text) lines.push(esc(def.text));
    const isCreature = def.type === 'creature';
    // 'play' mode (duel hand): bigger functional text, flavor only on vanilla
    // cards — a first-timer needs to know what the card DOES at a glance.
    const play = opts.mode === 'play';
    const showFlavor = def.flavor && (!play || lines.length === 0);
    const nameSize = play ? (def.name.length > 17 ? 12.5 : 15) : (def.name.length > 17 ? 11.5 : 13.5);
    const mythicGlow = def.rarity === 'mythic' ? `<rect x="2.5" y="2.5" width="195" height="275" rx="14" fill="none" stroke="url(#myth_${def.id})" stroke-width="3" opacity="0.9"/>` : '';
    const svg = `
<svg viewBox="0 0 200 280" class="cardsvg" role="img" aria-label="${esc(def.name)}">
  <defs>
    <linearGradient id="g_${def.id}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${fac.color}"/><stop offset="1" stop-color="${fac.color2}"/>
    </linearGradient>
    <linearGradient id="myth_${def.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffdf80"/><stop offset="0.5" stop-color="#ff8a4a"/><stop offset="1" stop-color="#ffdf80"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="197" height="277" rx="15" fill="#f7f1e3" stroke="${rar.color}" stroke-width="3"/>
  ${mythicGlow}
  <g transform="translate(10 32)"><svg width="180" height="98" viewBox="0 0 180 98" preserveAspectRatio="none"><rect width="180" height="98" rx="6" fill="${fac.color2}"/>${artScene(def, 180, 98)}</svg><rect width="180" height="98" rx="6" fill="none" stroke="${fac.color2}" stroke-width="1.5"/></g>
  <circle cx="20" cy="18" r="13.5" fill="#2b3a4a" stroke="#e8d9b8" stroke-width="2"/>
  <text x="20" y="23.5" text-anchor="middle" font-size="15" font-weight="bold" fill="#ffe9a8">${def.cost}</text>
  <text x="40" y="23" font-size="${nameSize}" font-weight="bold" fill="#33261a">${esc(def.name)}</text>
  ${(() => {
      const typeLine = play
        ? `${def.type === 'creature' ? 'Creature' : def.type === 'instant' ? 'Instant' : 'Enchant'} · ${fac.name}`
        : `${def.type === 'creature' ? 'Creature' : def.type === 'instant' ? 'Instant' : 'Enchant'} — ${fac.name} · ${rar.name}`;
      const sz = play ? 11.5 : (typeLine.length > 29 ? 9.5 : 10.5);
      return `<text x="12" y="144" font-size="${sz}" fill="${fac.color2}" font-weight="bold">${esc(typeLine)}</text>`;
    })()}
  <foreignObject x="10" y="150" width="180" height="98">
    <div xmlns="http://www.w3.org/1999/xhtml" class="cardtext${play ? ' big' : ''}">
      ${lines.length ? `<div class="fx">${lines.join(' ')}</div>` : ''}
      ${showFlavor ? `<div class="flav">${esc(def.flavor)}</div>` : ''}
    </div>
  </foreignObject>
  ${isCreature ? `
  <g><circle cx="24" cy="262" r="13.5" fill="${fac.color}" stroke="#fff" stroke-width="2"/>
     <text x="24" y="267.5" text-anchor="middle" font-size="14.5" font-weight="bold" fill="#fff">${def.power}</text></g>
  <g><circle cx="176" cy="262" r="13.5" fill="#4c7c4c" stroke="#fff" stroke-width="2"/>
     <text x="176" y="267.5" text-anchor="middle" font-size="14.5" font-weight="bold" fill="#fff">${def.health}</text></g>` : ''}
</svg>`;
    return `<div class="card rar-${def.rarity}${opts.sel ? ' sel' : ''}${opts.cls ? ' ' + opts.cls : ''}" data-card="${def.id}">${svg}${opts.count > 1 ? `<span class="count">×${opts.count}</span>` : ''}${opts.isNew ? '<span class="newbadge">NEW</span>' : ''}</div>`;
  };

  /* ---- creature on the duel board (compact) ---- */
  CW.creatureHTML = function (duel, c, opts) {
    opts = opts || {};
    const fac = CW.FACTIONS[c.def.faction] || CW.FACTIONS.cogsworn;
    const p = duel.power(c), h = duel.health(c), a = duel.armor(c);
    const hurt = c.damage > 0;
    const kws = c.def.kw.map(k => `<span class="kwchip kw-${k}" title="${esc(KW_TEXT[k])}">${k === 'swift' ? '⚡' : k === 'shadow' ? '🌘' : '☠'}</span>`).join('');
    return `
<div class="creature ${opts.cls || ''}" data-uid="${c.uid}" data-cid="${c.def.id}" style="--fc:${fac.color};--fc2:${fac.color2}">
  <div class="cbody">
    <svg viewBox="0 0 24 24" width="32" height="32">${CW.glyphFor(c.def, '#fff', 'rgba(30,15,5,0.42)')}</svg>
    <div class="cname">${esc(c.def.name)}</div>
    <div class="kwrow">${kws}${a ? `<span class="kwchip kw-armor" title="Armor ${a}: takes ${a} less damage">🛡${a}</span>` : ''}</div>
  </div>
  <span class="stat pw">${p}</span>
  <span class="stat hp ${hurt ? 'hurt' : ''}">${h}</span>
</div>`;
  };

  /* ---- NPC / shopkeeper portraits ---- */
  // Parametric friendly faces: skin tone, hair, accessory per character.
  const PORTRAITS = {
    pip:    { skin: '#f2c9a0', hair: '#b0642e', style: 'tufts', extra: 'freckles' },
    sorrel: { skin: '#c98850', hair: '#4a6b2a', style: 'bun', extra: 'leaf' },
    brick:  { skin: '#e8a87b', hair: '#3f2e20', style: 'bald', extra: 'chefhat' },
    nyx:    { skin: '#d9b08c', hair: '#241d33', style: 'long', extra: 'tophat' },
    tessa:  { skin: '#8a5a3b', hair: '#1f1f1f', style: 'tufts', extra: 'goggles' },
    wren:   { skin: '#e7bfa0', hair: '#cfcabe', style: 'bun', extra: 'scarf' },
    kiln:   { skin: '#f0b98a', hair: '#8c2a1c', style: 'long', extra: 'none' },
    root:   { skin: '#a06a3f', hair: '#6d5b3a', style: 'bun', extra: 'leaf' },
    moth:   { skin: '#e3cdb2', hair: '#4a3577', style: 'long', extra: 'tophat' },
    sprocket: { skin: '#d7a074', hair: '#c9963f', style: 'tufts', extra: 'goggles' },
  };
  CW.portraitSVG = function (id, ringColor, size) {
    const p = PORTRAITS[id] || PORTRAITS.pip;
    size = size || 72;
    const parts = [];
    parts.push(`<circle cx="36" cy="36" r="34" fill="#efe4cd" stroke="${ringColor || '#8a744f'}" stroke-width="3"/>`);
    // hair behind head
    if (p.style === 'long') parts.push(`<path d="M14 40 Q12 12 36 10 Q60 12 58 40 L58 56 Q46 50 36 52 Q26 50 14 56 Z" fill="${p.hair}"/>`);
    if (p.style === 'bun') parts.push(`<circle cx="36" cy="14" r="8" fill="${p.hair}"/>`);
    // head
    parts.push(`<circle cx="36" cy="38" r="19" fill="${p.skin}"/>`);
    // fringe
    if (p.style === 'tufts') parts.push(`<path d="M18 34 Q20 16 36 16 Q52 16 54 34 Q46 24 36 25 Q26 24 18 34 Z" fill="${p.hair}"/>`);
    if (p.style === 'bun') parts.push(`<path d="M17 36 Q18 18 36 18 Q54 18 55 36 Q47 26 36 27 Q25 26 17 36 Z" fill="${p.hair}"/>`);
    if (p.style === 'long') parts.push(`<path d="M17 36 Q18 18 36 18 Q54 18 55 36 Q47 26 36 27 Q25 26 17 36 Z" fill="${p.hair}"/>`);
    // face
    parts.push(`<circle cx="29" cy="38" r="2.2" fill="#31261c"/><circle cx="43" cy="38" r="2.2" fill="#31261c"/>`);
    parts.push(`<path d="M30 46 Q36 51 42 46" stroke="#31261c" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    // extras
    if (p.extra === 'freckles') parts.push(`<circle cx="27" cy="43" r="0.9" fill="#b0642e"/><circle cx="31" cy="44.5" r="0.9" fill="#b0642e"/><circle cx="45" cy="43" r="0.9" fill="#b0642e"/><circle cx="41" cy="44.5" r="0.9" fill="#b0642e"/>`);
    if (p.extra === 'chefhat') parts.push(`<path d="M22 24 Q20 10 32 12 Q36 4 42 10 Q54 8 50 24 Z" fill="#f7f1e3" stroke="#d8ccb2"/>`);
    if (p.extra === 'tophat') parts.push(`<rect x="24" y="4" width="24" height="16" rx="2" fill="#241d33"/><rect x="18" y="18" width="36" height="5" rx="2.5" fill="#241d33"/><rect x="24" y="14" width="24" height="4" fill="#8b6fc9"/>`);
    if (p.extra === 'goggles') parts.push(`<circle cx="28" cy="27" r="6" fill="#c8b370" stroke="#6e5a2e" stroke-width="2"/><circle cx="44" cy="27" r="6" fill="#c8b370" stroke="#6e5a2e" stroke-width="2"/><rect x="33" y="25" width="6" height="3" fill="#6e5a2e"/>`);
    if (p.extra === 'leaf') parts.push(`<path d="M50 16 Q60 8 64 14 Q60 24 50 22 Q49 18 50 16Z" fill="#5a9e4b"/>`);
    if (p.extra === 'scarf') parts.push(`<path d="M20 54 Q36 62 52 54 L52 60 Q36 68 20 60 Z" fill="#b0432e"/>`);
    return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" class="portrait" aria-hidden="true">${parts.join('')}</svg>`;
  };

  /* ---- coin + pack art ---- */
  CW.coinSVG = function (size) {
    return `<svg viewBox="0 0 20 20" width="${size || 16}" height="${size || 16}" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#e8bb4e" stroke="#a97e22" stroke-width="1.5"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="#a97e22" stroke-width="1"/><text x="10" y="13.5" text-anchor="middle" font-size="9" font-weight="bold" fill="#7a5a14">¢</text></svg>`;
  };
  CW.packSVG = function (factionId, size) {
    const fac = CW.FACTIONS[factionId];
    return `
<svg viewBox="0 0 120 160" width="${size || 120}" aria-hidden="true">
  <defs><linearGradient id="pk_${factionId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fac.color}"/><stop offset="1" stop-color="${fac.color2}"/></linearGradient></defs>
  <rect x="6" y="6" width="108" height="148" rx="8" fill="url(#pk_${factionId})" stroke="#33261a" stroke-width="2.5"/>
  <path d="M6 26 L114 26 L114 14 Q114 6 106 6 L14 6 Q6 6 6 14 Z" fill="#33261a" opacity="0.25"/>
  <g transform="translate(36 46) scale(2)"><path d="${ICONS[fac.icon]}" fill="#fff8ee" opacity="0.95"/></g>
  <text x="60" y="118" text-anchor="middle" font-size="13" font-weight="bold" fill="#fff8ee">${esc(fac.name)}</text>
  <text x="60" y="134" text-anchor="middle" font-size="9" fill="#fff8ee" opacity="0.85">BOOSTER · 5 CARDS</text>
</svg>`;
  };

  CW.escapeHTML = esc;
  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
