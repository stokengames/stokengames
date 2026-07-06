/* The Cardwright — unique per-card glyphs. Each is a function (m, a) => SVG
 * inner markup in a 24x24 viewBox. m = main color, a = accent color.
 * Faction color still comes from the card frame; the glyph tells you WHAT it is. */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  // Shared shapes
  const flame = (m) => `<path d="M12 2.5 C15 6.5 16.8 8.6 15.2 12 A4.2 4.2 0 0 1 8.2 11 C8.2 7.6 10.4 5.6 12 2.5Z" fill="${m}"/>`;
  const moth = (m, a) => `
    <ellipse cx="12" cy="12.5" rx="1.6" ry="5.5" fill="${m}"/>
    <path d="M10.6 9.5 Q4 4.5 3.5 10.5 Q4.5 15.5 10.6 13.5 Z" fill="${m}" opacity="0.92"/>
    <path d="M13.4 9.5 Q20 4.5 20.5 10.5 Q19.5 15.5 13.4 13.5 Z" fill="${m}" opacity="0.92"/>
    <path d="M10.6 14.5 Q6 16.5 6.5 20 Q9.5 19 11 15.3Z" fill="${m}" opacity="0.72"/>
    <path d="M13.4 14.5 Q18 16.5 17.5 20 Q14.5 19 13 15.3Z" fill="${m}" opacity="0.72"/>
    <path d="M10.5 7 L9 4 M13.5 7 L15 4" stroke="${m}" stroke-width="1.2" fill="none"/>`;
  const gear = (m, a) => `
    <g fill="${m}"><circle cx="12" cy="12" r="5"/>
    <rect x="10.9" y="4" width="2.2" height="3.4" rx="0.8"/><rect x="10.9" y="16.6" width="2.2" height="3.4" rx="0.8"/>
    <rect x="4" y="10.9" width="3.4" height="2.2" rx="0.8"/><rect x="16.6" y="10.9" width="3.4" height="2.2" rx="0.8"/>
    <rect x="5.6" y="5.6" width="2.6" height="2.6" rx="0.8" transform="rotate(45 6.9 6.9)"/>
    <rect x="15.8" y="5.6" width="2.6" height="2.6" rx="0.8" transform="rotate(45 17.1 6.9)"/>
    <rect x="5.6" y="15.8" width="2.6" height="2.6" rx="0.8" transform="rotate(45 6.9 17.1)"/>
    <rect x="15.8" y="15.8" width="2.6" height="2.6" rx="0.8" transform="rotate(45 17.1 17.1)"/></g>
    <circle cx="12" cy="12" r="2" fill="${a}"/>`;

  const G = {
    /* ---------------- EMBERKIN ---------------- */
    cinder_imp: (m, a) => `
      <path d="M7 9.5 L4.5 3 L10 7.5 Z M17 9.5 L19.5 3 L14 7.5 Z" fill="${m}"/>
      <circle cx="12" cy="14" r="7" fill="${m}"/>
      <circle cx="9.4" cy="12.8" r="1.3" fill="${a}"/><circle cx="14.6" cy="12.8" r="1.3" fill="${a}"/>
      <path d="M9 17 Q12 19.6 15 17" stroke="${a}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    sparkwhelp: (m) => `<path d="M13.5 1.5 L5.5 13 L10.8 13 L9 22.5 L18.5 10 L12.8 10 Z" fill="${m}"/>`,
    emberhound: (m, a) => `
      <path d="M5 16 Q4 9 10 8 L11 3.5 L14.2 8 L19 9 Q21.5 11.5 19.5 14 L14 15 Q13.5 19.5 9 19.5 Q5 19.5 5 16 Z" fill="${m}"/>
      <circle cx="11.5" cy="11.5" r="1.2" fill="${a}"/><ellipse cx="19" cy="11.6" rx="1.5" ry="1" fill="${a}"/>`,
    kindle: (m) => `
      <rect x="10.8" y="10" width="2.4" height="11.5" rx="1.2" fill="${m}" transform="rotate(16 12 15)"/>
      ${flame(m)}`,
    ashfoot_brawler: (m, a) => `
      <rect x="5.5" y="7.5" width="14" height="11.5" rx="4" fill="${m}"/>
      <path d="M9.2 7.5 V13 M12.6 7.5 V13 M16 7.5 V13" stroke="${a}" stroke-width="1.3"/>
      <rect x="2.5" y="10.5" width="4.5" height="6.5" rx="2.2" fill="${m}"/>`,
    flare: (m) => `<path d="M12 1 L14 9 L22 7 L16 12 L22 17 L14 15 L12 23 L10 15 L2 17 L8 12 L2 7 L10 9 Z" fill="${m}"/>`,
    bellows_sprite: (m, a) => `
      <path d="M2.5 12 L15 4 L15 20 Z" fill="${m}"/>
      <rect x="15" y="9.8" width="6.5" height="4.4" rx="1.6" fill="${m}"/>
      <path d="M6.5 12 L15 7 M6.5 12 L15 17" stroke="${a}" stroke-width="1.1" fill="none"/>`,
    slag_loper: (m) => `
      <ellipse cx="13.5" cy="15.5" rx="5.2" ry="4.4" fill="${m}"/>
      <circle cx="8.5" cy="9" r="2.1" fill="${m}"/><circle cx="13.8" cy="7.2" r="2.1" fill="${m}"/><circle cx="18.6" cy="9.4" r="2.1" fill="${m}"/>
      <path d="M2 15.5 h4 M2.8 19 h4" stroke="${m}" stroke-width="1.7" stroke-linecap="round"/>`,
    wildfire: (m) => `
      <g fill="${m}">${flame(m)}
      <path d="M5 10.5 C7 13 8 14.3 7.1 16.4 A2.7 2.7 0 0 1 2.7 15.7 C2.7 13.5 4 12.2 5 10.5Z" opacity="0.8"/>
      <path d="M19 10.5 C21 13 22 14.3 21.1 16.4 A2.7 2.7 0 0 1 16.7 15.7 C16.7 13.5 18 12.2 19 10.5Z" opacity="0.8"/>
      <rect x="3.5" y="18.5" width="17" height="2.6" rx="1.3"/></g>`,
    forgeborn_ram: (m, a) => `
      <path d="M7 12.5 A4.6 4.6 0 1 1 11.5 7 A2.9 2.9 0 1 0 8.4 10.6 Z" fill="${m}"/>
      <path d="M17 12.5 A4.6 4.6 0 1 0 12.5 7 A2.9 2.9 0 1 1 15.6 10.6 Z" fill="${m}"/>
      <path d="M7.5 12 Q7 21 12 21 Q17 21 16.5 12 Q14.5 9.5 12 9.5 Q9.5 9.5 7.5 12Z" fill="${m}"/>
      <circle cx="10.2" cy="14.5" r="1.1" fill="${a}"/><circle cx="13.8" cy="14.5" r="1.1" fill="${a}"/>`,
    pyre_dancer: (m) => `
      <circle cx="13" cy="4.5" r="2.6" fill="${m}"/>
      <path d="M8 21.5 Q10 14 13 9 Q16.5 12.5 11.5 21.5 Z" fill="${m}"/>
      <path d="M13.5 9.5 Q18.5 8.5 20.5 4.5 M12.5 13 Q7 12 4 8" stroke="${m}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
    everburn_banner: (m) => `
      <rect x="4.5" y="3.5" width="2.2" height="18.5" rx="1.1" fill="${m}"/>
      <path d="M6.7 4 L21.5 7 L6.7 13 Z" fill="${m}"/>
      <circle cx="5.6" cy="2.6" r="1.7" fill="${m}"/>`,
    cindermaw_drake: (m, a) => `
      <path d="M2.5 10.5 Q7.5 4 14 6 L21.5 3.5 L17.5 8.8 L22 10 Q18.5 14.5 13 13.2 L10 17.5 L8.8 12.8 Q4 13 2.5 10.5 Z" fill="${m}"/>
      <circle cx="13" cy="8.6" r="1.1" fill="${a}"/>
      <path d="M6 18.5 Q9 20.5 13 20" stroke="${m}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    solance: (m) => `
      <path d="M4 18.5 L4 9 L8.5 12.5 L12 6.5 L15.5 12.5 L20 9 L20 18.5 Z" fill="${m}"/>
      <rect x="3.4" y="18.5" width="17.2" height="2.4" rx="1.2" fill="${m}"/>
      <path d="M12 0.8 C13.5 2.9 14.1 4 13.4 5.6 A2.1 2.1 0 0 1 10.3 5.1 C10.3 3.5 11.2 2.4 12 0.8Z" fill="${m}"/>`,
    heart_of_the_forge: (m, a) => `
      <path d="M12 21.5 C4 15.5 1.8 10 5 6.5 C7.5 3.9 11 5 12 8 C13 5 16.5 3.9 19 6.5 C22.2 10 20 15.5 12 21.5 Z" fill="${m}"/>
      <path d="M12 8.5 C13.7 10.8 14.6 12.1 13.7 14 A2.5 2.5 0 0 1 9.5 13.4 C9.5 11.5 11 10.3 12 8.5Z" fill="${a}"/>`,

    /* ---------------- BRAMBLEWOOD ---------------- */
    acorn_sprite: (m, a) => `
      <rect x="11" y="3" width="2" height="4" rx="1" fill="${m}"/>
      <path d="M4.5 10.5 Q12 4 19.5 10.5 L18.5 12.5 L5.5 12.5 Z" fill="${m}"/>
      <path d="M6.5 12.5 h11 Q16.5 20 12 21.5 Q7.5 20 6.5 12.5 Z" fill="${m}" opacity="0.85"/>`,
    thornhare: (m, a) => `
      <ellipse cx="9" cy="6" rx="2.1" ry="5.2" fill="${m}" transform="rotate(-12 9 6)"/>
      <ellipse cx="15" cy="6" rx="2.1" ry="5.2" fill="${m}" transform="rotate(12 15 6)"/>
      <circle cx="12" cy="14.5" r="6.8" fill="${m}"/>
      <circle cx="9.7" cy="13.3" r="1.1" fill="${a}"/><circle cx="14.3" cy="13.3" r="1.1" fill="${a}"/>
      <path d="M10.4 17.4 Q12 18.8 13.6 17.4" stroke="${a}" stroke-width="1.2" fill="none"/>`,
    sapmender: (m, a) => `
      <path d="M12 1.8 C17 8.8 19.2 12 19.2 15.4 A7.2 7.2 0 0 1 4.8 15.4 C4.8 12 7 8.8 12 1.8 Z" fill="${m}"/>
      <path d="M12 10 v8 M8 14 h8" stroke="${a}" stroke-width="2.3" stroke-linecap="round"/>`,
    growth_spurt: (m) => `
      <path d="M12 22 V10.5" stroke="${m}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M12 13 Q6 13 4.2 7 Q11 7 12 13 Z" fill="${m}"/>
      <path d="M12 13 Q18 13 19.8 7 Q13 7 12 13 Z" fill="${m}"/>
      <path d="M8.2 5.5 L12 1.2 L15.8 5.5" stroke="${m}" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    bramble_boar: (m, a) => `
      <path d="M4 13 Q5 8 12 8 Q19 8 20 13 Q20 17.5 15.8 18.5 L14 16.5 L10 16.5 L8.2 18.5 Q4 17.5 4 13 Z" fill="${m}"/>
      <path d="M6.2 16 Q4 18.5 5.8 20.5 M17.8 16 Q20 18.5 18.2 20.5" stroke="${m}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <circle cx="9.4" cy="12" r="1.05" fill="${a}"/><circle cx="14.6" cy="12" r="1.05" fill="${a}"/>
      <ellipse cx="12" cy="15.3" rx="2.5" ry="1.7" fill="${a}"/>`,
    elderberry_tonic: (m, a) => `
      <rect x="10" y="2" width="4" height="4.5" rx="1" fill="${m}"/>
      <path d="M9 6.5 h6 L17 12 V18.8 A2.7 2.7 0 0 1 14.3 21.5 h-4.6 A2.7 2.7 0 0 1 7 18.8 V12 Z" fill="${m}"/>
      <circle cx="10.4" cy="15" r="1.1" fill="${a}"/><circle cx="13.6" cy="17.4" r="1.1" fill="${a}"/><circle cx="12.2" cy="12.2" r="1.1" fill="${a}"/>`,
    oakhide_bear: (m, a) => `
      <circle cx="7" cy="7" r="3.1" fill="${m}"/><circle cx="17" cy="7" r="3.1" fill="${m}"/>
      <circle cx="12" cy="13" r="8" fill="${m}"/>
      <circle cx="9" cy="11.8" r="1.2" fill="${a}"/><circle cx="15" cy="11.8" r="1.2" fill="${a}"/>
      <ellipse cx="12" cy="15.8" rx="2.7" ry="2" fill="${a}"/>`,
    verdant_ring: (m, a) => `
      <g fill="${m}"><circle cx="12" cy="3.8" r="2.1"/><circle cx="17.8" cy="6.2" r="2.1"/><circle cx="20.2" cy="12" r="2.1"/>
      <circle cx="17.8" cy="17.8" r="2.1"/><circle cx="12" cy="20.2" r="2.1"/><circle cx="6.2" cy="17.8" r="2.1"/>
      <circle cx="3.8" cy="12" r="2.1"/><circle cx="6.2" cy="6.2" r="2.1"/></g>
      <path d="M12 9.5 L12.8 11.4 L14.8 11.6 L13.3 13 L13.7 15 L12 14 L10.3 15 L10.7 13 L9.2 11.6 L11.2 11.4 Z" fill="${m}" opacity="0.75"/>`,
    trellis_guardian: (m, a) => `
      <path d="M12 1.8 L21 5 V12 Q21 19 12 22.2 Q3 19 3 12 V5 Z" fill="${m}"/>
      <path d="M6.5 7 L17.5 16.5 M17.5 7 L6.5 16.5 M12 4 V20" stroke="${a}" stroke-width="1.6"/>`,
    sudden_bloom: (m, a) => `
      <g fill="${m}"><ellipse cx="12" cy="5.6" rx="2.7" ry="4.1"/><ellipse cx="12" cy="18.4" rx="2.7" ry="4.1"/>
      <ellipse cx="5.6" cy="12" rx="4.1" ry="2.7"/><ellipse cx="18.4" cy="12" rx="4.1" ry="2.7"/>
      <ellipse cx="7.5" cy="7.5" rx="2.4" ry="3.6" transform="rotate(-45 7.5 7.5)"/>
      <ellipse cx="16.5" cy="16.5" rx="2.4" ry="3.6" transform="rotate(-45 16.5 16.5)"/>
      <ellipse cx="16.5" cy="7.5" rx="2.4" ry="3.6" transform="rotate(45 16.5 7.5)"/>
      <ellipse cx="7.5" cy="16.5" rx="2.4" ry="3.6" transform="rotate(45 7.5 16.5)"/></g>
      <circle cx="12" cy="12" r="3.2" fill="${a}"/>`,
    mossback_colossus: (m) => `
      <path d="M1.5 20.5 L9 6.5 L13.8 14.5 L16.8 9.5 L22.5 20.5 Z" fill="${m}"/>
      <rect x="8.2" y="3.2" width="1.6" height="4" fill="${m}"/><circle cx="9" cy="2.6" r="2.3" fill="${m}"/>`,
    heartroot_elder: (m, a) => `
      <circle cx="12" cy="8" r="6.2" fill="${m}"/>
      <rect x="10.8" y="12" width="2.4" height="6.5" rx="1" fill="${m}"/>
      <path d="M12 18 Q8 19 5.5 22 M12 18 Q16 19 18.5 22 M12 18 V22.5" stroke="${m}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M12 11 C10.2 9.5 9.7 8.2 10.6 7.3 C11.2 6.7 12 7 12 7.9 C12 7 12.8 6.7 13.4 7.3 C14.3 8.2 13.8 9.5 12 11Z" fill="${a}"/>`,
    ancient_canopy: (m) => `
      <path d="M1.8 13.5 Q12 1.5 22.2 13.5 Z" fill="${m}"/>
      <path d="M4.5 17 Q12 8 19.5 17 Z" fill="${m}" opacity="0.75"/>
      <rect x="10.9" y="15" width="2.2" height="7.5" rx="1.1" fill="${m}"/>`,
    yewla: (m, a) => `
      <circle cx="6.5" cy="11.5" r="3.8" fill="${m}"/><circle cx="17.5" cy="11.5" r="3.8" fill="${m}"/>
      <circle cx="12" cy="8.5" r="7" fill="${m}"/>
      <rect x="10.5" y="13" width="3" height="9" rx="1.4" fill="${m}"/>
      <circle cx="12" cy="8.5" r="1.5" fill="${a}"/>`,
    season_of_giants: (m) => `
      <path d="M12 22 V13" stroke="${m}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 14 Q4.5 13 2.5 4.5 Q10.5 6 12 14Z" fill="${m}"/>
      <path d="M12 14 Q19.5 13 21.5 4.5 Q13.5 6 12 14Z" fill="${m}"/>
      <ellipse cx="12" cy="6.5" rx="2.5" ry="5.2" fill="${m}"/>`,

    /* ---------------- GLOAMVEIL ---------------- */
    dusk_moth: moth,
    alley_whisper: (m) => `
      <path d="M3 7.5 Q10 4.5 14 7.5 T21 7.5 M3 13 Q10 10 14 13 T21 13 M5.5 18.5 Q11.5 15.5 15 18.5 T21 18.5"
        stroke="${m}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
    marsh_adder: (m, a) => `
      <path d="M5 19.5 Q1.5 15.5 6 13.5 Q12 11.5 10 8.5 Q8.5 5.5 12 4.5 Q15.5 3.5 17.5 6" stroke="${m}" stroke-width="2.9" fill="none" stroke-linecap="round"/>
      <circle cx="18.4" cy="7" r="2.4" fill="${m}"/>
      <path d="M20 8.8 L22.3 11" stroke="${m}" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="18.9" cy="6.4" r="0.7" fill="${a}"/>`,
    hushpaw_cat: (m, a) => `
      <path d="M5.5 9.5 L5.5 3.5 L10 7 Z M18.5 9.5 L18.5 3.5 L14 7 Z" fill="${m}"/>
      <circle cx="12" cy="13.5" r="7.5" fill="${m}"/>
      <circle cx="9.3" cy="12.2" r="1.1" fill="${a}"/><circle cx="14.7" cy="12.2" r="1.1" fill="${a}"/>
      <path d="M2 13 L6.5 13.8 M2 16.5 L6.5 15.8 M22 13 L17.5 13.8 M22 16.5 L17.5 15.8" stroke="${m}" stroke-width="1.1"/>
      <path d="M10.8 15.8 Q12 16.9 13.2 15.8" stroke="${a}" stroke-width="1.1" fill="none"/>`,
    pinprick: (m) => `
      <circle cx="17.5" cy="6.5" r="3.6" fill="${m}"/><circle cx="17.5" cy="6.5" r="1.5" fill="${m}" opacity="0.5"/>
      <path d="M14.8 9.2 L5.5 18.5" stroke="${m}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M5.5 18.5 L2.8 21.2" stroke="${m}" stroke-width="1.2" stroke-linecap="round"/>`,
    fade: (m) => `
      <path d="M12 2.8 A9.2 9.2 0 0 0 12 21.2" stroke="${m}" stroke-width="2.7" fill="none" stroke-linecap="round"/>
      <circle cx="17" cy="4.8" r="1.7" fill="${m}" opacity="0.85"/><circle cx="20.3" cy="9" r="1.4" fill="${m}" opacity="0.62"/>
      <circle cx="20.8" cy="13.8" r="1.15" fill="${m}" opacity="0.45"/><circle cx="18.4" cy="18.2" r="0.95" fill="${m}" opacity="0.3"/>`,
    lantern_thief: (m, a) => `
      <rect x="10" y="2" width="4" height="2.2" rx="1" fill="${m}"/>
      <path d="M8 5 h8 l1.6 4 v6 l-1.6 4 h-8 L6.4 15 V9 Z" fill="${m}"/>
      <path d="M12 8.4 C13.4 10.3 14.1 11.3 13.4 12.9 A2.1 2.1 0 0 1 10 12.4 C10 10.9 10.9 9.9 12 8.4Z" fill="${a}"/>
      <rect x="10.4" y="20.4" width="3.2" height="1.8" rx="0.9" fill="${m}"/>`,
    nightshade_draught: (m, a) => `
      <path d="M5 2.5 h14 Q19 10.5 13.6 12 V17.5 h3.4 v2.8 H7 v-2.8 h3.4 V12 Q5 10.5 5 2.5 Z" fill="${m}"/>
      <path d="M6.8 5.5 h10.4" stroke="${a}" stroke-width="1.5"/>
      <circle cx="10.2" cy="8" r="0.9" fill="${a}"/><circle cx="13.6" cy="8.8" r="0.7" fill="${a}"/>`,
    gloom_widow: (m, a) => `
      <circle cx="12" cy="14.5" r="4.4" fill="${m}"/><circle cx="12" cy="8.6" r="2.5" fill="${m}"/>
      <g stroke="${m}" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M9 11.5 Q4 8.5 3 4.5 M15 11.5 Q20 8.5 21 4.5 M8.3 14 Q3.5 13.5 2 11 M15.7 14 Q20.5 13.5 22 11 M9 17.5 Q5 19.5 4 22 M15 17.5 Q19 19.5 20 22"/></g>
      <path d="M12 12.5 L13 14.5 L12 16.5 L11 14.5 Z" fill="${a}"/>`,
    moonlit_veil: (m) => `
      <path d="M15 2.5 A9.6 9.6 0 1 0 21.6 15.8 A8 8 0 0 1 15 2.5 Z" fill="${m}"/>
      <path d="M6.5 5 L7.1 6.7 L8.8 7.3 L7.1 7.9 L6.5 9.6 L5.9 7.9 L4.2 7.3 L5.9 6.7 Z" fill="${m}"/>
      <circle cx="9.5" cy="12" r="1" fill="${m}"/>`,
    whisper_of_endings: (m) => `
      <path d="M2.5 2.5 L13 13" stroke="${m}" stroke-width="2.1" stroke-linecap="round" opacity="0.7"/>
      <path d="M6.5 1.8 L12.5 7.8" stroke="${m}" stroke-width="1.4" stroke-linecap="round" opacity="0.45"/>
      <path d="M17 10.5 L18.7 14.9 L23.2 15.3 L19.7 18.2 L20.8 22.7 L17 20.2 L13.2 22.7 L14.3 18.2 L10.8 15.3 L15.3 14.9 Z" fill="${m}"/>`,
    velvet_assassin: (m, a) => `
      <path d="M12 1.5 L14.6 12 L12 14.6 L9.4 12 Z" fill="${m}"/>
      <rect x="7.6" y="13.9" width="8.8" height="2.3" rx="1.15" fill="${m}"/>
      <rect x="10.8" y="16.2" width="2.4" height="5" rx="1.2" fill="${m}"/>
      <circle cx="12" cy="22" r="1.5" fill="${m}"/><path d="M12 4 V11" stroke="${a}" stroke-width="0.9"/>`,
    duskwing_matron: (m, a) => `
      <g transform="translate(-1.2 -0.5) scale(0.88)">${moth(m, a)}</g>
      <g transform="translate(14.5 13.5) scale(0.42)" opacity="0.85">${moth(m, a)}</g>`,
    nocturne: (m) => `
      <path d="M14.5 5 A8.8 8.8 0 1 0 21.3 17.3 A7.3 7.3 0 0 1 14.5 5 Z" fill="${m}"/>
      <path d="M4 7 L4 1.8 L6.8 4 L9 1.2 L11.2 4 L14 1.8 L14 7 Z" fill="${m}"/>`,
    long_twilight: (m) => `
      <path d="M4.5 15 A7.5 7.5 0 0 1 19.5 15 Z" fill="${m}"/>
      <path d="M2 15.5 H22 M4.5 19 H19.5 M7.5 22.3 H16.5" stroke="${m}" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M12 2 V4.8 M4.8 4.8 L6.8 7 M19.2 4.8 L17.2 7" stroke="${m}" stroke-width="1.6" stroke-linecap="round"/>`,

    /* ---------------- COGSWORN ---------------- */
    tin_scuttler: (m, a) => `
      <ellipse cx="12" cy="11.5" rx="6.6" ry="5.6" fill="${m}"/>
      <path d="M18.3 9.8 L22.3 7.8 L21.3 12 Z" fill="${m}"/>
      <path d="M8 5.8 Q12 2.2 16 5.8" stroke="${m}" stroke-width="1.9" fill="none"/>
      <path d="M8 16.8 L6.2 21 M12 17.3 V21.5 M16 16.8 L17.8 21" stroke="${m}" stroke-width="1.9" stroke-linecap="round"/>
      <circle cx="9.8" cy="10.8" r="1" fill="${a}"/><circle cx="14.2" cy="10.8" r="1" fill="${a}"/>`,
    windup_soldier: (m) => `
      <circle cx="12" cy="7.5" r="4.6" fill="none" stroke="${m}" stroke-width="2.6"/>
      <rect x="10.8" y="11.5" width="2.4" height="10" rx="1.2" fill="${m}"/>
      <rect x="6.5" y="14.5" width="11" height="2.4" rx="1.2" fill="${m}"/>`,
    brassbeak_owl: (m, a) => `
      <path d="M4.8 6.2 L8 3.2 M19.2 6.2 L16 3.2" stroke="${m}" stroke-width="1.9" stroke-linecap="round"/>
      <circle cx="8.5" cy="10" r="4.1" fill="${m}"/><circle cx="15.5" cy="10" r="4.1" fill="${m}"/>
      <circle cx="8.5" cy="10" r="1.5" fill="${a}"/><circle cx="15.5" cy="10" r="1.5" fill="${a}"/>
      <path d="M12 12.2 L10.4 15.4 h3.2 Z" fill="${m}"/>
      <path d="M6.8 17.5 Q12 21.2 17.2 17.5" stroke="${m}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    patch_kit: (m, a) => `
      <g transform="rotate(-25 12 12.5)">
      <rect x="2.5" y="9" width="19" height="7.4" rx="3.7" fill="${m}"/>
      <rect x="8.9" y="9.6" width="6.2" height="6.2" fill="${a}" opacity="0.5"/>
      <path d="M12 10.4 v4.4 M9.8 12.6 h4.4" stroke="${m}" stroke-width="1.6"/></g>`,
    overclock: (m) => `
      <path d="M4 14.5 A8 8 0 0 1 20 14.5" fill="none" stroke="${m}" stroke-width="2.7"/>
      <path d="M12 14.5 L17.2 7.8" stroke="${m}" stroke-width="2.3" stroke-linecap="round"/>
      <circle cx="12" cy="14.5" r="1.9" fill="${m}"/>
      <path d="M3 18.5 h6 M4.5 21.5 h5" stroke="${m}" stroke-width="1.7" stroke-linecap="round"/>`,
    steam_porter: (m, a) => `
      <rect x="5" y="10" width="14" height="10.5" rx="1.6" fill="${m}"/>
      <path d="M5 14.8 h14 M12 10 v10.5" stroke="${a}" stroke-width="1.2"/>
      <path d="M8 7.5 Q9.6 5.8 8 4 M12 8 Q13.6 6.3 12 4.5 M16 7.5 Q17.6 5.8 16 4" stroke="${m}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    boiler_brute: (m, a) => `
      <rect x="6" y="3.5" width="12" height="17" rx="4.2" fill="${m}"/>
      <circle cx="12" cy="9.8" r="2.7" fill="${a}"/>
      <path d="M9 16 h6" stroke="${a}" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="8.4" cy="6.2" r="0.75" fill="${a}"/><circle cx="15.6" cy="6.2" r="0.75" fill="${a}"/>
      <circle cx="8.4" cy="18" r="0.75" fill="${a}"/><circle cx="15.6" cy="18" r="0.75" fill="${a}"/>`,
    copper_sentinel: (m, a) => `
      <path d="M6.5 2.5 H17.5 V14.5 Q17.5 19.5 12 22.3 Q6.5 19.5 6.5 14.5 Z" fill="${m}"/>
      <path d="M12 5 V19.5 M8.6 8 H15.4" stroke="${a}" stroke-width="1.7"/>`,
    scrap_cannon: (m, a) => `
      <path d="M3.5 13.5 L15 5.2 Q17.6 3.6 19.2 6.2 Q20.4 8.8 17.2 10 L7 16.8 Z" fill="${m}"/>
      <circle cx="8" cy="17.8" r="3.6" fill="${m}"/><circle cx="8" cy="17.8" r="1.3" fill="${a}"/>
      <circle cx="21" cy="3" r="1.5" fill="${m}"/>`,
    dynamo_core: (m) => `
      <path d="M12 3 A9 9 0 1 0 21 12" fill="none" stroke="${m}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M12 7.2 A4.8 4.8 0 1 0 16.8 12" fill="none" stroke="${m}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.9" fill="${m}"/>
      <path d="M19.5 4.5 L22.3 1.7 M20.8 8.2 L23.6 7.2" stroke="${m}" stroke-width="1.5" stroke-linecap="round"/>`,
    assembly_line: (m) => `
      <rect x="3.5" y="5.5" width="5.2" height="5.2" rx="1" fill="${m}"/>
      <rect x="9.9" y="5.5" width="5.2" height="5.2" rx="1" fill="${m}" opacity="0.78"/>
      <rect x="16.3" y="5.5" width="5.2" height="5.2" rx="1" fill="${m}" opacity="0.56"/>
      <path d="M2.5 14.5 H21.5" stroke="${m}" stroke-width="2.1"/>
      <circle cx="6" cy="18.5" r="2" fill="${m}"/><circle cx="12" cy="18.5" r="2" fill="${m}"/><circle cx="18" cy="18.5" r="2" fill="${m}"/>`,
    aegis_colossus: (m, a) => `
      <path d="M12 1.6 L21.6 4.8 V12 Q21.6 19.2 12 22.6 Q2.4 19.2 2.4 12 V4.8 Z" fill="${m}"/>
      <circle cx="12" cy="11.5" r="3" fill="${a}"/>
      <g fill="${a}"><rect x="11.2" y="6.6" width="1.6" height="2.5" rx="0.6"/><rect x="11.2" y="13.9" width="1.6" height="2.5" rx="0.6"/>
      <rect x="7" y="10.7" width="2.5" height="1.6" rx="0.6"/><rect x="14.5" y="10.7" width="2.5" height="1.6" rx="0.6"/></g>`,
    foundry_alchemist: (m, a) => `
      <rect x="10.8" y="2.8" width="2.4" height="4.8" fill="${m}"/>
      <path d="M9 7.6 h6 L19 17 A3.6 3.6 0 0 1 15.9 21.6 H8.1 A3.6 3.6 0 0 1 5 17 Z" fill="${m}"/>
      <circle cx="10" cy="15.5" r="1" fill="${a}"/><circle cx="13.6" cy="17.8" r="1.3" fill="${a}"/>
      <circle cx="15.2" cy="3.8" r="1" fill="${m}"/><circle cx="17" cy="1.8" r="0.8" fill="${m}"/>`,
    grand_orrery: (m) => `
      <circle cx="12" cy="12" r="2.3" fill="${m}"/>
      <ellipse cx="12" cy="12" rx="9.2" ry="4" fill="none" stroke="${m}" stroke-width="1.5" transform="rotate(-22 12 12)"/>
      <ellipse cx="12" cy="12" rx="9.2" ry="4" fill="none" stroke="${m}" stroke-width="1.5" transform="rotate(52 12 12)"/>
      <circle cx="19.6" cy="8.4" r="1.7" fill="${m}"/><circle cx="5.8" cy="17" r="1.35" fill="${m}"/>`,
    brasswing_leviathan: (m, a) => `
      <g fill="${m}"><circle cx="8.5" cy="14.5" r="4.2"/>
      <rect x="7.5" y="8.2" width="2" height="2.6" rx="0.7"/><rect x="7.5" y="18.2" width="2" height="2.6" rx="0.7"/>
      <rect x="2.2" y="13.5" width="2.6" height="2" rx="0.7"/><rect x="12.2" y="13.5" width="2.6" height="2" rx="0.7"/></g>
      <path d="M11.5 12.5 Q13.5 4 22 2.8 Q20 7 16.8 8.6 Q20 8.6 22.6 7.4 Q20.6 11.8 15.4 12.6 Q13.2 13 11.5 12.5Z" fill="${m}"/>
      <circle cx="8.5" cy="14.5" r="1.5" fill="${a}"/>`,

    /* tokens */
    token_cog: gear,
    token_dusk_moth: moth,
  };

  CW.glyphFor = function (def, main, accent) {
    const fn = G[def.id];
    if (fn) return fn(main, accent);
    // Fallback: faction sigil via art.js icon paths.
    const fac = CW.FACTIONS[def.faction] || CW.FACTIONS.cogsworn;
    return `<g>${CW.iconSVG ? '' : ''}<circle cx="12" cy="12" r="8" fill="${main}"/></g>`;
  };
  CW.GLYPHS = G;

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
