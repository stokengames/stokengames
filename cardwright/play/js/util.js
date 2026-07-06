/* The Cardwright — utilities. Runs in browser and Node. */
(function (root) {
  'use strict';

  // Deterministic PRNG (mulberry32) so simulations are reproducible.
  function makeRng(seed) {
    let a = seed >>> 0;
    const rng = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (n) => Math.floor(rng() * n);
    rng.pick = (arr) => arr[rng.int(arr.length)];
    rng.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return rng;
  }

  let uidCounter = 1;
  function uid() { return 'u' + (uidCounter++); }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  const CW = root.CW || (root.CW = {});
  CW.makeRng = makeRng;
  CW.uid = uid;
  CW.clamp = clamp;

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
