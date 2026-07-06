/* Cardwright — Drafthollow's duelists and shopkeepers. */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  // Six opponents, escalating. Beat tier N to unlock tier N+1.
  // winCoins per spec: 20-60 by tier. loseCoins keeps every duel worthwhile.
  CW.NPCS = [
    {
      id: 'pip', tier: 1, name: 'Pip Thistledown', title: 'Junior Duelist (Self-Appointed)',
      winCoins: 20, loseCoins: 5, spot: 'The Fountain Steps',
      deck: ['sparkwhelp', 'cinder_imp', 'acorn_sprite', 'sapmender', 'elderberry_tonic',
        'dusk_moth', 'hushpaw_cat', 'pinprick', 'tin_scuttler', 'windup_soldier'],
      gauntletDeck: ['dusk_moth', 'dusk_moth', 'alley_whisper', 'alley_whisper', 'moonlit_veil',
        'moonlit_veil', 'lantern_thief', 'hushpaw_cat', 'gloom_widow', 'duskwing_matron'],
      gauntletIntro: 'CHAMPION! Look! I rebuilt my whole deck around moths. MOTHS! Are you proud? Be proud AND slightly afraid.',
      color: '#7ab648',
      intro: [
        'Oh! A new face! I\'m Pip. I\'ve been dueling for THREE WEEKS, so, fair warning, I\'m basically a professional.',
        'House rule: winner gets bragging rights. Loser also gets bragging rights, but quieter ones.',
      ],
      win: 'Okay, okay, you win! That was so cool though. Did you SEE my moth? Tell people about my moth.',
      winRematch: 'Beaten by the future Champion AGAIN. That goes in my journal. You get a whole page now.',
      lose: 'YES! Three weeks of training! Rematch whenever you want — I need the practice and you clearly need... um... also practice!',
      rematchIntro: ['Rematch! I\'ve been practicing my shuffling. It\'s very dramatic now, watch.'],
    },
    {
      id: 'sorrel', tier: 2, name: 'Sorrel Finch', title: 'Hedge-Warden of the East Gardens',
      winCoins: 30, loseCoins: 7, spot: 'The Allotment Gardens',
      deck: ['acorn_sprite', 'acorn_sprite', 'thornhare', 'thornhare', 'sapmender', 'growth_spurt',
        'bramble_boar', 'bramble_boar', 'elderberry_tonic', 'trellis_guardian'],
      gauntletDeck: ['acorn_sprite', 'thornhare', 'growth_spurt', 'bramble_boar', 'trellis_guardian',
        'oakhide_bear', 'ancient_canopy', 'heartroot_elder', 'mossback_colossus', 'yewla'],
      gauntletIntro: 'The Champion, in my garden! I woke the old growth for you. The forest insisted.',
      color: '#5a9e4b',
      intro: [
        'Welcome to the gardens. Mind the marrows — they bite back this time of year.',
        'I duel the way I garden: slowly, patiently, and then all at once. Shall we?',
      ],
      win: 'Well pruned, cardwright. You cut exactly where it counted. Take a seedling from my deck, it\'ll grow better with you.',
      winRematch: 'Trimmed again! Good. A garden that stops being pruned starts getting ideas.',
      lose: 'Everything falls to the green, given time. Come back when your deck\'s had a season to grow.',
      rematchIntro: ['Back again? Good. The compost heap and I both believe in second chances.'],
    },
    {
      id: 'brick', tier: 3, name: 'Brick Doughty', title: 'Baker. Also, Arsonist (Licensed, For Ovens)',
      winCoins: 40, loseCoins: 8, spot: 'The Hearth & Crust Bakery',
      deck: ['cinder_imp', 'sparkwhelp', 'emberhound', 'emberhound', 'kindle',
        'ashfoot_brawler', 'bellows_sprite', 'slag_loper', 'pyre_dancer', 'forgeborn_ram'],
      gauntletDeck: ['sparkwhelp', 'cinder_imp', 'emberhound', 'kindle', 'flare',
        'slag_loper', 'pyre_dancer', 'everburn_banner', 'cindermaw_drake', 'solance'],
      gauntletIntro: 'The Champion, in MY bakery! I fired up the big oven for this one. The one with the warning sign.',
      color: '#e2543e',
      intro: [
        'You smell that? Sourdough and victory. Mostly sourdough. I bake at dawn and duel at noon.',
        'My deck\'s like my oven: hot, fast, and it does NOT wait for anybody. Shuffle up!',
      ],
      win: 'HA! Burnt to a crisp — and by that I mean me, I\'m the crisp. Take a card and a roll for the road. You EARNED the roll.',
      winRematch: 'Still hot, still fast, still not fast enough! Take your winnings. The rolls are on the counter.',
      lose: 'Straight out of the oven! That\'s the Doughty special. Come back when your deck\'s got more... rise to it.',
      rematchIntro: ['Round two! I\'ve got a fresh batch in the oven and a fresh beatdown right here.'],
    },
    {
      id: 'nyx', tier: 4, name: 'Nyx Marlowe', title: 'Stage Magician, "The Astonishing Nyx"',
      winCoins: 45, loseCoins: 9, spot: 'The Moonlight Theatre',
      deck: ['dusk_moth', 'dusk_moth', 'alley_whisper', 'marsh_adder', 'hushpaw_cat', 'hushpaw_cat',
        'fade', 'gloom_widow', 'pinprick', 'duskwing_matron'],
      gauntletDeck: ['dusk_moth', 'alley_whisper', 'marsh_adder', 'fade', 'gloom_widow',
        'nightshade_draught', 'whisper_of_endings', 'velvet_assassin', 'duskwing_matron', 'nocturne'],
      gauntletIntro: 'For the Champion: no rehearsal, no matinee material. House lights down. The real act begins.',
      color: '#8b6fc9',
      intro: [
        'Ah. An audience. No — a *volunteer*. For my next trick, I will require your winning streak.',
        'Watch closely. The cards never lie, but they do, on occasion, perform elaborate misdirection.',
      ],
      win: 'And for the finale... I vanish my own lead. *Bows.* Magnificent. The stage is yours, cardwright — take a card, it\'s in your ear.',
      winRematch: 'Even knowing the trick, the audience applauds. That\'s how you know it\'s art. Or that you\'re simply very good.',
      lose: 'Ta-daaa! Was THIS your card? No? It was MY card? Funny how often that happens. Do come again — matinee rates.',
      rematchIntro: ['Back for the encore! I admire that. The encore is where I keep my best material.'],
    },
    {
      id: 'tessa', tier: 5, name: 'Tessa Gearhart', title: 'Chief Engineer, Drafthollow Waterworks',
      winCoins: 55, loseCoins: 10, spot: 'The Waterworks Yard',
      deck: ['tin_scuttler', 'windup_soldier', 'brassbeak_owl', 'steam_porter', 'overclock',
        'boiler_brute', 'scrap_cannon', 'assembly_line', 'aegis_colossus', 'foundry_alchemist'],
      gauntletDeck: ['tin_scuttler', 'windup_soldier', 'brassbeak_owl', 'steam_porter', 'overclock',
        'boiler_brute', 'scrap_cannon', 'assembly_line', 'aegis_colossus', 'grand_orrery'],
      gauntletIntro: 'Champion-grade opponent detected. Deploying the machine I don\'t show the apprentices.',
      color: '#c9963f',
      intro: [
        'Hand me that spanner— oh, you\'re not my apprentice. You\'re the duelist everyone\'s on about. Even better.',
        'I\'ve run the numbers on you. Seventeen percent chance you beat me. I rounded up, because I\'m polite.',
      ],
      win: 'Recalculating... huh. You broke my model. That\'s the nicest thing anyone\'s done for me all year. Take a part from the machine. It likes you.',
      winRematch: 'Model updated. Conclusion: you remain a statistical outrage. The machine and I are quietly thrilled.',
      lose: 'And THAT is what we call a load-bearing defense! Don\'t sulk — bring me a better machine and we\'ll test it properly.',
      rematchIntro: ['Round two? Excellent. I\'ve adjusted the model. Eleven percent. ...I said I was polite, not encouraging.'],
    },
    {
      id: 'wren', tier: 6, name: 'Wren Halloway', title: 'The Champion of Drafthollow (Retired, Allegedly)',
      winCoins: 60, loseCoins: 10, spot: 'The Town Square',
      deck: ['solance', 'yewla', 'pyre_dancer', 'cindermaw_drake', 'elderberry_tonic',
        'hushpaw_cat', 'dusk_moth', 'sparkwhelp', 'heartroot_elder', 'acorn_sprite'],
      gauntletDeck: ['solance', 'yewla', 'nocturne', 'cindermaw_drake', 'whisper_of_endings',
        'mossback_colossus', 'everburn_banner', 'wildfire', 'heartroot_elder', 'velvet_assassin'],
      gauntletIntro: 'Come to keep the bench warm with me? Good. I dug out the deck from my prime. Let\'s see the title work for its keep.',
      color: '#d4b24a',
      intro: [
        'So you\'re the one the shopkeepers keep mentioning. Sit. The bench is older than both of us and wiser than most.',
        'This deck has been with me forty years. The Drake cost me a championship and taught me two. The Dusk Moth beat me in my first final, so I keep her close. The little Acorn Sprite was the first card I ever crafted. She stays. Every card here is a day I remember.',
        'I don\'t duel to win anymore. I duel to see if the town still makes duelists worth remembering. Show me.',
      ],
      win: 'There it is. *She gathers her cards slowly, and she is smiling.* Forty years I\'ve waited to lose like that. To someone who earned every point of it. The square\'s yours now, cardwright. Mind the bench for me.',
      winRematch: 'Still sharp. Good. A title kept dull is just a rumor. The bench and I expected nothing less of you, Champion.',
      lose: 'Not yet. And "not yet" is the most promising thing I\'ve said to anyone in years. Go on, Drafthollow has four shops and I\'ve given them all plenty of business. Your deck isn\'t finished becoming yours.',
      rematchIntro: ['Back again. Good. Persistence is the only talent that matters — the rest are just decorations.'],
      victory: 'Champion of Drafthollow. Say it out loud when no one\'s listening — it sounds better that way. And Wren Halloway believes the title has finally found hands that will carry it somewhere new.',
    },
  ];
  CW.NPC_BY_ID = {};
  for (const n of CW.NPCS) CW.NPC_BY_ID[n.id] = n;

  // Four shops, one per faction, each with a keeper worth visiting.
  CW.SHOPS = [
    {
      id: 'kiln', faction: 'emberkin', name: 'The Kiln & Candle', keeper: 'Ember Vash',
      greet: [
        'Welcome to the Kiln! Everything\'s fireproof except the merchandise, the shelving, and me.',
        'Emberkin packs! Fresh from the forge! Some are still warm. One is EXTREMELY warm.',
      ],
      buy: 'Sold! Careful with that one — it kicks.',
      broke: 'No coins, no candle. Go light up a duel and come back richer!',
      welcome: 'New in town? Then the first pack\'s on the house. Kiln tradition. Everything after that is capitalism.',
    },
    {
      id: 'root', faction: 'bramblewood', name: 'Root Cellar Cards', keeper: 'Maribel Tusk',
      greet: [
        'Come in, come in. Mind the ivy — she\'s friendly but clingy.',
        'Every pack in this shop was aged on a real oak shelf. Does that matter? Spiritually? Enormously.',
      ],
      buy: 'Lovely choice. Water it— no, don\'t water it. Habit.',
      broke: 'Short on coin? The forest teaches patience. The dueling ring teaches faster.',
      welcome: 'A new face! Every seedling gets its first pot of soil free. Here, your first pack, off the good shelf.',
    },
    {
      id: 'moth', faction: 'gloamveil', name: 'The Velvet Moth', keeper: 'Corvin Lace',
      greet: [
        'Ah. You found us. The shop moves, you know. Or the street does. One of us moves.',
        'Gloamveil packs. Opened at dusk they\'re luckier — a fact I\'ve invented and thoroughly believe.',
      ],
      buy: 'A fine choice. Or a terrible one. The twilight keeps both kinds of secrets.',
      broke: 'The Moth extends no credit. The Moth has been burned before. Figuratively. Ask the Kiln about literally.',
      welcome: 'Ah, a first visit. Tradition demands a gift. The Moth demands you open it dramatically. Both will be satisfied.',
    },
    {
      id: 'sprocket', faction: 'cogsworn', name: 'Sprocket & Spark', keeper: 'Juno Voltwhistle',
      greet: [
        'DON\'T touch the counter, it\'s live! Not dangerous-live, just... enthusiastic-live. Welcome!',
        'Cogsworn boosters, quality-tested by machines I built to be impossible to impress!',
      ],
      buy: 'EXCELLENT purchase! That pack scored a 9.1 on the Voltwhistle Excitement Index!',
      broke: 'Insufficient funds detected! The fix is duels. The fix is always duels.',
      welcome: 'FIRST-TIME CUSTOMER DETECTED! Per Voltwhistle Promotional Directive One: have a free pack! It buzzes a little. That\'s normal!',
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
