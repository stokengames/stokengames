/* The Cardwright — run state, economy, save/export.
 * Core play never touches localStorage; export/import is JSON text.
 * (Autosave to localStorage exists as a convenience, wrapped in try/catch.) */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});
  const SAVE_VERSION = 1;

  CW.newGame = function () {
    const collection = {};
    for (const id of CW.STARTER_DECK) collection[id] = (collection[id] || 0) + 1;
    return {
      v: SAVE_VERSION,
      coins: 50,
      collection,
      deck: CW.STARTER_DECK.slice(),
      beatenTier: 0,       // highest tier defeated
      welcomed: {},        // shopId -> true once the free pack is claimed
      met: {},             // npcId -> true after first dialogue
      champion: false,
      stats: { duels: 0, wins: 0, packs: 0, coinsEarned: 0, started: Date.now() },
    };
  };

  CW.addCard = function (G, id, n) {
    G.collection[id] = (G.collection[id] || 0) + (n || 1);
  };

  // Deck legality: exactly 10 cards, all owned.
  CW.deckProblems = function (G, deck) {
    const problems = [];
    if (deck.length !== 10) problems.push(`Deck has ${deck.length}/10 cards.`);
    const used = {};
    for (const id of deck) used[id] = (used[id] || 0) + 1;
    for (const id in used) {
      if (used[id] > (G.collection[id] || 0)) problems.push(`Not enough copies of ${CW.CARDS[id].name}.`);
    }
    return problems;
  };

  CW.saveString = function (G) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(G))));
  };
  CW.loadString = function (str) {
    const G = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!G || G.v !== SAVE_VERSION || !G.collection || !Array.isArray(G.deck)) {
      throw new Error('Not a valid Cardwright save.');
    }
    return G;
  };

  // Optional convenience only — the game never requires it.
  CW.autosave = function (G) {
    try { localStorage.setItem('cardwright_save', CW.saveString(G)); } catch (e) { /* fine */ }
  };
  CW.loadAutosave = function () {
    try {
      const s = localStorage.getItem('cardwright_save');
      return s ? CW.loadString(s) : null;
    } catch (e) { return null; }
  };
  CW.clearAutosave = function () {
    try { localStorage.removeItem('cardwright_save'); } catch (e) { /* fine */ }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
