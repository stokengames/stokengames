/* Cardwright — card database. 60 original cards, 4 factions, 4 rarities.
 *
 * Effect ops (used by on-play effects and instants):
 *   {k:'dmg', t:'any'|'face'|'ecreature'|'allEnemy', n}   damage
 *   {k:'heal', n}                                          heal own duelist
 *   {k:'buff', t:'fcreature'|'allFriendly', p, h}          permanent stat gain
 *   {k:'debuff', t:'ecreature'|'allEnemy', p, h}           permanent stat loss
 *   {k:'destroy', t:'ecreature', maxCost?, maxPower?}      destroy with constraint
 *   {k:'draw', n}                                          draw cards
 *   {k:'token', p, h, kw, name}                            summon a construct/creature
 *   {k:'ready', t:'fcreature'}                             creature may attack this turn
 * Enchant fields:
 *   aura: {p, h, armor, filter:'shadow'?}   static bonus to your creatures
 *   upkeep: [effect ops]                    fires at start of your turn
 *   manaBonus: 1                            raises your mana cap (engine caps at 6)
 */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  CW.FACTIONS = {
    emberkin:    { name: 'Emberkin',    color: '#e2543e', color2: '#8c2a1c', icon: 'flame', tagline: 'Forge-born sprites who solve most problems with enthusiasm and fire.' },
    bramblewood: { name: 'Bramblewood', color: '#5a9e4b', color2: '#2e5c28', icon: 'leaf',  tagline: 'Patient growers of the deep hedgerows. Slow to anger, enormous when angry.' },
    gloamveil:   { name: 'Gloamveil',   color: '#8b6fc9', color2: '#4a3577', icon: 'moth',  tagline: 'Twilight tricksters who win duels the moment you blink.' },
    cogsworn:    { name: 'Cogsworn',    color: '#c9963f', color2: '#6e4e1e', icon: 'gear',  tagline: 'Tinkers and their tireless constructs. Measure twice, duel once.' },
  };

  CW.RARITIES = {
    common:   { name: 'Common',   color: '#9aa3ad', weight: 0 },
    uncommon: { name: 'Uncommon', color: '#4fa3d1', weight: 1 },
    rare:     { name: 'Rare',     color: '#e0b23c', weight: 2 },
    mythic:   { name: 'Mythic',   color: '#e2543e', weight: 3 },
  };

  // id, name, faction, rarity, cost, type ('creature'|'instant'|'enchant'),
  // creatures: power/health, kw:[swift|shadow|venom], armor
  // fx: on-play effects (creatures) or the effect (instants)
  // flavor: one line
  const C = [];
  function card(def) { C.push(def); }

  /* ---------------- EMBERKIN (aggro, burn) ---------------- */
  card({ id: 'cinder_imp', name: 'Cinder Imp', faction: 'emberkin', rarity: 'common', cost: 1, type: 'creature', power: 2, health: 1,
    flavor: 'Small, loud, and extremely flammable. Mostly on purpose.' });
  card({ id: 'sparkwhelp', name: 'Sparkwhelp', faction: 'emberkin', rarity: 'common', cost: 1, type: 'creature', power: 1, health: 1, kw: ['swift'],
    flavor: 'It bites ankles at remarkable speed.' });
  card({ id: 'emberhound', name: 'Emberhound', faction: 'emberkin', rarity: 'common', cost: 2, type: 'creature', power: 3, health: 1,
    flavor: 'Fetch has consequences.' });
  card({ id: 'kindle', name: 'Kindle', faction: 'emberkin', rarity: 'common', cost: 1, type: 'instant', fx: [{ k: 'dmg', t: 'any', n: 2 }],
    text: 'Deal 2 damage to any target.', flavor: 'Every blaze starts as a bad idea.' });
  card({ id: 'ashfoot_brawler', name: 'Ashfoot Brawler', faction: 'emberkin', rarity: 'common', cost: 3, type: 'creature', power: 3, health: 3,
    flavor: 'Fights first and apologizes never. Does buy the next round, though.' });
  card({ id: 'flare', name: 'Flare', faction: 'emberkin', rarity: 'common', cost: 2, type: 'instant', fx: [{ k: 'dmg', t: 'face', n: 3 }],
    text: 'Deal 3 damage to the enemy duelist.', flavor: 'Aim is optional. Volume is not.' });
  card({ id: 'bellows_sprite', name: 'Bellows Sprite', faction: 'emberkin', rarity: 'uncommon', cost: 2, type: 'creature', power: 1, health: 2,
    fx: [{ k: 'buff', t: 'fcreature', p: 1, h: 0 }], text: 'On play: another friendly creature gets +1 power.',
    flavor: 'Every forge needs someone to shout encouragement.' });
  card({ id: 'slag_loper', name: 'Slag Loper', faction: 'emberkin', rarity: 'uncommon', cost: 3, type: 'creature', power: 4, health: 2, kw: ['swift'],
    flavor: 'It cools down eventually. The road does not.' });
  card({ id: 'wildfire', name: 'Wildfire', faction: 'emberkin', rarity: 'uncommon', cost: 4, type: 'instant', fx: [{ k: 'dmg', t: 'allEnemy', n: 2 }],
    text: 'Deal 2 damage to every enemy creature.', flavor: 'The hedge-wardens still bring it up at parties.' });
  card({ id: 'forgeborn_ram', name: 'Forgeborn Ram', faction: 'emberkin', rarity: 'uncommon', cost: 4, type: 'creature', power: 5, health: 3,
    flavor: 'Knocks once.' });
  card({ id: 'pyre_dancer', name: 'Pyre Dancer', faction: 'emberkin', rarity: 'rare', cost: 3, type: 'creature', power: 3, health: 2,
    fx: [{ k: 'dmg', t: 'face', n: 2 }], text: 'On play: deal 2 damage to the enemy duelist.',
    flavor: 'Her encore is the part you should worry about.' });
  card({ id: 'everburn_banner', name: 'Everburn Banner', faction: 'emberkin', rarity: 'rare', cost: 3, type: 'enchant', aura: { p: 1, h: 0 },
    text: 'Your creatures have +1 power.', flavor: 'It has never once needed relighting.' });
  card({ id: 'cindermaw_drake', name: 'Cindermaw Drake', faction: 'emberkin', rarity: 'rare', cost: 5, type: 'creature', power: 5, health: 4, kw: ['swift'],
    flavor: 'Adopted as a hatchling, on the theory it would stay small.' });
  card({ id: 'solance', name: 'Solance, Kiln Queen', faction: 'emberkin', rarity: 'mythic', cost: 5, type: 'creature', power: 4, health: 4,
    fx: [{ k: 'dmg', t: 'allEnemy', n: 2 }], text: 'On play: deal 2 damage to every enemy creature.',
    flavor: '"The forge does not ask permission to be warm."' });
  card({ id: 'heart_of_the_forge', name: 'Heart of the Forge', faction: 'emberkin', rarity: 'mythic', cost: 4, type: 'enchant',
    upkeep: [{ k: 'dmg', t: 'face', n: 2 }], text: 'At the start of your turn, deal 2 damage to the enemy duelist.',
    flavor: 'On quiet nights the whole street beats along with it.' });

  /* ---------------- BRAMBLEWOOD (big bodies, healing) ---------------- */
  card({ id: 'acorn_sprite', name: 'Acorn Sprite', faction: 'bramblewood', rarity: 'common', cost: 1, type: 'creature', power: 1, health: 2,
    flavor: 'Give it forty years and it will be a problem.' });
  card({ id: 'thornhare', name: 'Thornhare', faction: 'bramblewood', rarity: 'common', cost: 2, type: 'creature', power: 2, health: 3,
    flavor: 'Petting it is a lesson you only need once.' });
  card({ id: 'sapmender', name: 'Sapmender', faction: 'bramblewood', rarity: 'common', cost: 2, type: 'creature', power: 1, health: 2,
    fx: [{ k: 'heal', n: 3 }], text: 'On play: heal 3.', flavor: 'Its bedside manner is mostly moss.' });
  card({ id: 'growth_spurt', name: 'Growth Spurt', faction: 'bramblewood', rarity: 'common', cost: 2, type: 'instant',
    fx: [{ k: 'buff', t: 'fcreature', p: 2, h: 2 }], text: 'A friendly creature gets +2/+2.',
    flavor: 'The hedge-wardens call it Tuesday.' });
  card({ id: 'bramble_boar', name: 'Bramble Boar', faction: 'bramblewood', rarity: 'common', cost: 3, type: 'creature', power: 3, health: 4,
    flavor: 'Not angry. Just in a hurry, and you happen to be a fence.' });
  card({ id: 'elderberry_tonic', name: 'Elderberry Tonic', faction: 'bramblewood', rarity: 'common', cost: 1, type: 'instant',
    fx: [{ k: 'heal', n: 5 }], text: 'Heal 5.', flavor: 'Grandmother Tusk\'s recipe. She is ninety-four and duels on Thursdays.' });
  card({ id: 'oakhide_bear', name: 'Oakhide Bear', faction: 'bramblewood', rarity: 'uncommon', cost: 4, type: 'creature', power: 4, health: 5,
    flavor: 'Hibernates in autumn, spring, and most of the duel.' });
  card({ id: 'verdant_ring', name: 'Verdant Ring', faction: 'bramblewood', rarity: 'uncommon', cost: 3, type: 'enchant',
    upkeep: [{ k: 'heal', n: 3 }], text: 'At the start of your turn, heal 3.',
    flavor: 'Mushrooms in a circle. Do not step inside unless you mean it.' });
  card({ id: 'trellis_guardian', name: 'Trellis Guardian', faction: 'bramblewood', rarity: 'uncommon', cost: 3, type: 'creature', power: 2, health: 6,
    flavor: 'Assigned to guard the tomatoes. Takes it very seriously.' });
  card({ id: 'sudden_bloom', name: 'Sudden Bloom', faction: 'bramblewood', rarity: 'uncommon', cost: 3, type: 'instant',
    fx: [{ k: 'buff', t: 'allFriendly', p: 1, h: 1 }], text: 'Your creatures get +1/+1.',
    flavor: 'One warm morning and suddenly everything has ideas.' });
  card({ id: 'mossback_colossus', name: 'Mossback Colossus', faction: 'bramblewood', rarity: 'rare', cost: 5, type: 'creature', power: 5, health: 7,
    flavor: 'For sixty years the town picnicked on it.' });
  card({ id: 'heartroot_elder', name: 'Heartroot Elder', faction: 'bramblewood', rarity: 'rare', cost: 4, type: 'creature', power: 3, health: 4,
    fx: [{ k: 'heal', n: 4 }], text: 'On play: heal 4.', flavor: 'Remembers every seed it ever planted. Asks after them by name.' });
  card({ id: 'ancient_canopy', name: 'Ancient Canopy', faction: 'bramblewood', rarity: 'rare', cost: 4, type: 'enchant', aura: { p: 0, h: 2 },
    text: 'Your creatures have +2 health.', flavor: 'Rain forgets how to fall here.' });
  card({ id: 'yewla', name: 'Yewla, the First Seed', faction: 'bramblewood', rarity: 'mythic', cost: 5, type: 'creature', power: 7, health: 7,
    flavor: '"Before the town, the forest. Before the forest, me."' });
  card({ id: 'season_of_giants', name: 'Season of Giants', faction: 'bramblewood', rarity: 'mythic', cost: 4, type: 'enchant', aura: { p: 2, h: 2 },
    text: 'Your creatures have +2/+2.', flavor: 'It comes once a century, or whenever the forest feels like showing off.' });

  /* ---------------- GLOAMVEIL (shadow, venom, removal) ---------------- */
  card({ id: 'dusk_moth', name: 'Dusk Moth', faction: 'gloamveil', rarity: 'common', cost: 1, type: 'creature', power: 1, health: 1, kw: ['shadow'],
    flavor: 'By the time you see it, it has already read your hand.' });
  card({ id: 'alley_whisper', name: 'Alley Whisper', faction: 'gloamveil', rarity: 'common', cost: 2, type: 'creature', power: 2, health: 1, kw: ['shadow'],
    flavor: 'Drafthollow has no secrets. It has couriers.' });
  card({ id: 'marsh_adder', name: 'Marsh Adder', faction: 'gloamveil', rarity: 'common', cost: 2, type: 'creature', power: 1, health: 1, kw: ['venom'],
    flavor: 'One bite. That is the whole negotiation.' });
  card({ id: 'hushpaw_cat', name: 'Hushpaw Cat', faction: 'gloamveil', rarity: 'common', cost: 2, type: 'creature', power: 2, health: 2,
    flavor: 'Knocks your best card off the table and watches it fall.' });
  card({ id: 'pinprick', name: 'Pinprick', faction: 'gloamveil', rarity: 'common', cost: 1, type: 'instant',
    fx: [{ k: 'debuff', t: 'ecreature', p: 2, h: 1 }], text: 'An enemy creature gets -2/-1.',
    flavor: 'A very small hole in a very large plan.' });
  card({ id: 'fade', name: 'Fade', faction: 'gloamveil', rarity: 'common', cost: 2, type: 'instant',
    fx: [{ k: 'destroy', t: 'ecreature', maxCost: 2 }], text: 'Destroy an enemy creature that costs 2 or less.',
    flavor: 'Nobody saw it leave. That was the whole idea.' });
  card({ id: 'lantern_thief', name: 'Lantern Thief', faction: 'gloamveil', rarity: 'uncommon', cost: 3, type: 'creature', power: 3, health: 2, kw: ['shadow'],
    flavor: 'Steals the light first so nobody sees the second theft.' });
  card({ id: 'nightshade_draught', name: 'Nightshade Draught', faction: 'gloamveil', rarity: 'uncommon', cost: 3, type: 'instant',
    fx: [{ k: 'destroy', t: 'ecreature', maxPower: 3 }], text: 'Destroy an enemy creature with power 3 or less.',
    flavor: 'Served cold, with a sincere apology.' });
  card({ id: 'gloom_widow', name: 'Gloom Widow', faction: 'gloamveil', rarity: 'uncommon', cost: 3, type: 'creature', power: 2, health: 2, kw: ['venom'],
    flavor: 'One thread at a time is plenty.' });
  card({ id: 'moonlit_veil', name: 'Moonlit Veil', faction: 'gloamveil', rarity: 'uncommon', cost: 2, type: 'enchant',
    aura: { p: 1, h: 1, filter: 'shadow' }, text: 'Your Shadow creatures have +1/+1.',
    flavor: 'The moon keeps favorites. It denies this.' });
  card({ id: 'whisper_of_endings', name: 'Whisper of Endings', faction: 'gloamveil', rarity: 'rare', cost: 4, type: 'instant',
    fx: [{ k: 'destroy', t: 'ecreature' }], text: 'Destroy an enemy creature.',
    flavor: 'Every story hears it eventually. Yours is early.' });
  card({ id: 'velvet_assassin', name: 'Velvet Assassin', faction: 'gloamveil', rarity: 'rare', cost: 4, type: 'creature', power: 3, health: 2, kw: ['shadow', 'venom'],
    flavor: 'Her calling card is the absence of one.' });
  card({ id: 'duskwing_matron', name: 'Duskwing Matron', faction: 'gloamveil', rarity: 'rare', cost: 4, type: 'creature', power: 2, health: 3, kw: ['shadow'],
    fx: [{ k: 'token', p: 1, h: 1, kw: ['shadow'], name: 'Dusk Moth' }], text: 'On play: summon a 1/1 Dusk Moth with Shadow.',
    flavor: 'Where she goes, the twilight follows. Politely, in single file.' });
  card({ id: 'nocturne', name: 'Nocturne, Veil Regent', faction: 'gloamveil', rarity: 'mythic', cost: 5, type: 'creature', power: 3, health: 4, kw: ['shadow'],
    fx: [{ k: 'debuff', t: 'allEnemy', p: 1, h: 1 }], text: 'On play: enemy creatures get -1/-1.',
    flavor: '"The night is not empty. It is exactly as full as I wish it to be."' });
  card({ id: 'long_twilight', name: 'The Long Twilight', faction: 'gloamveil', rarity: 'mythic', cost: 4, type: 'enchant',
    upkeep: [{ k: 'dmg', t: 'face', n: 1 }, { k: 'heal', n: 1 }],
    text: 'At the start of your turn, deal 1 damage to the enemy duelist and heal 1.',
    flavor: 'Some evenings refuse to end.' });

  /* ---------------- COGSWORN (armor, tokens, enchants) ---------------- */
  card({ id: 'tin_scuttler', name: 'Tin Scuttler', faction: 'cogsworn', rarity: 'common', cost: 1, type: 'creature', power: 1, health: 2, armor: 1,
    flavor: 'Ninety percent kettle, ten percent courage.' });
  card({ id: 'windup_soldier', name: 'Wind-Up Soldier', faction: 'cogsworn', rarity: 'common', cost: 2, type: 'creature', power: 2, health: 2,
    flavor: 'Marches in circles until pointed at a problem.' });
  card({ id: 'brassbeak_owl', name: 'Brassbeak Owl', faction: 'cogsworn', rarity: 'common', cost: 2, type: 'creature', power: 2, health: 1,
    fx: [{ k: 'draw', n: 1 }], text: 'On play: draw a card.', flavor: 'It has read every book in Drafthollow. It liked three.' });
  card({ id: 'patch_kit', name: 'Patch Kit', faction: 'cogsworn', rarity: 'common', cost: 1, type: 'instant',
    fx: [{ k: 'buff', t: 'fcreature', p: 0, h: 3 }], text: 'A friendly creature gets +3 health.',
    flavor: 'Contains: two bolts, one bandage, unearned optimism.' });
  card({ id: 'overclock', name: 'Overclock', faction: 'cogsworn', rarity: 'common', cost: 2, type: 'instant',
    fx: [{ k: 'buff', t: 'fcreature', p: 2, h: 0 }, { k: 'ready', t: 'same' }],
    text: 'A friendly creature gets +2 power and may attack this turn.',
    flavor: 'Warranty void. Warranty extremely void.' });
  card({ id: 'steam_porter', name: 'Steam Porter', faction: 'cogsworn', rarity: 'common', cost: 3, type: 'creature', power: 2, health: 3, armor: 1,
    flavor: 'Carries luggage, grudges, and on one occasion, the east gate.' });
  card({ id: 'boiler_brute', name: 'Boiler Brute', faction: 'cogsworn', rarity: 'uncommon', cost: 4, type: 'creature', power: 3, health: 4, armor: 1,
    flavor: 'Runs on coal, tea, and being underestimated.' });
  card({ id: 'copper_sentinel', name: 'Copper Sentinel', faction: 'cogsworn', rarity: 'uncommon', cost: 4, type: 'creature', power: 2, health: 6, armor: 1,
    flavor: 'It has guarded the bridge for sixty years. The bridge fell down twelve years ago.' });
  card({ id: 'scrap_cannon', name: 'Scrap Cannon', faction: 'cogsworn', rarity: 'uncommon', cost: 3, type: 'instant',
    fx: [{ k: 'dmg', t: 'ecreature', n: 3 }], text: 'Deal 3 damage to an enemy creature.',
    flavor: 'Loads anything. Regrets nothing.' });
  card({ id: 'dynamo_core', name: 'Dynamo Core', faction: 'cogsworn', rarity: 'uncommon', cost: 2, type: 'enchant', manaBonus: 1,
    text: 'Your mana cap is raised by 1 (to a maximum of 6).',
    flavor: 'Do not lick the dynamo. — sign, gone slightly melty' });
  card({ id: 'assembly_line', name: 'Assembly Line', faction: 'cogsworn', rarity: 'rare', cost: 4, type: 'enchant',
    upkeep: [{ k: 'token', p: 1, h: 1, kw: [], name: 'Cog' }], text: 'At the start of your turn, summon a 1/1 Cog.',
    flavor: 'Somewhere, a supervisor is very proud.' });
  card({ id: 'aegis_colossus', name: 'Aegis Colossus', faction: 'cogsworn', rarity: 'rare', cost: 5, type: 'creature', power: 4, health: 6, armor: 1,
    flavor: 'Built to guard the town. Stayed because it likes the bakery.' });
  card({ id: 'foundry_alchemist', name: 'Foundry Alchemist', faction: 'cogsworn', rarity: 'rare', cost: 3, type: 'creature', power: 2, health: 3,
    fx: [{ k: 'token', p: 1, h: 1, kw: [], name: 'Cog' }], text: 'On play: summon a 1/1 Cog.',
    flavor: 'Her eyebrows grow back a little faster every year.' });
  card({ id: 'grand_orrery', name: 'The Grand Orrery', faction: 'cogsworn', rarity: 'mythic', cost: 5, type: 'enchant',
    aura: { p: 1, h: 1, armor: 1 }, text: 'Your creatures have +1/+1 and Armor 1.',
    flavor: 'It models the heavens, the tides, and lately your odds.' });
  card({ id: 'brasswing_leviathan', name: 'Brasswing Leviathan', faction: 'cogsworn', rarity: 'mythic', cost: 5, type: 'creature', power: 5, health: 6, armor: 1,
    flavor: 'The Cogsworn swear it flew once. The Cogsworn swear a lot of things.' });

  CW.CARDS = {};
  CW.CARD_LIST = C;
  for (const def of C) {
    def.kw = def.kw || [];
    def.fx = def.fx || [];
    def.armor = def.armor || 0;
    CW.CARDS[def.id] = def;
  }

  // The deck every new cardwright arrives with: mixed commons, honest curve.
  CW.STARTER_DECK = [
    'cinder_imp', 'emberhound', 'kindle',
    'acorn_sprite', 'thornhare', 'growth_spurt',
    'dusk_moth', 'hushpaw_cat',
    'tin_scuttler', 'windup_soldier',
  ];

  // Booster packs: 5 cards — 3 common, 1 uncommon, 1 rare slot (20% mythic).
  // Shop faction weighting: each slot is 70% shop faction, 30% anything else.
  // Soft duplicate protection: a card you already own 2+ copies of gets
  // rerolled once (it can still repeat — collections just fill in faster).
  CW.PACK_PRICE = 40;
  CW.openPack = function (factionId, rng, collection) {
    const byRarity = (r, fac) => CW.CARD_LIST.filter(c => c.rarity === r && (!fac || c.faction === fac));
    const roll = (rarity) => {
      const useFaction = factionId && rng() < 0.7;
      const pool = byRarity(rarity, useFaction ? factionId : null);
      return rng.pick(pool.length ? pool : byRarity(rarity, null)).id;
    };
    const slot = (rarity) => {
      let id = roll(rarity);
      if (collection && (collection[id] || 0) >= 2) id = roll(rarity);
      return id;
    };
    const cards = [slot('common'), slot('common'), slot('common'), slot('uncommon')];
    cards.push(slot(rng() < 0.2 ? 'mythic' : 'rare'));
    return cards;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
