/* The Cardwright — background music manager.
 *
 * HTML5 Audio (works from file:// where fetch/decodeAudioData cannot),
 * one track at a time, ~1s crossfades, ducking under sound effects, and
 * autoplay-safe: if the browser blocks play(), the track is remembered
 * and started on the first user gesture.
 *
 * Volumes come from CW.UI.settings {master, music, sfx, muted}; the UI
 * persists those in the save state and mirrors them to localStorage.
 */
(function (root) {
  'use strict';
  const CW = root.CW || (root.CW = {});

  const TRACKS = {
    town: { src: 'assets/audio/drafthollow.mp3', loop: true },
    duel: { src: 'assets/audio/duel.mp3', loop: true },
    shop: { src: 'assets/audio/shop.mp3', loop: true },
    wren: { src: 'assets/audio/wren.mp3', loop: true },
    pack: { src: 'assets/audio/pack.mp3', loop: false }, // 6.6s sting, plays once
    victory: { src: 'assets/audio/victory.mp3', loop: true },
  };

  const FADE_MS = 1000;
  const TICK_MS = 50;
  const active = new Set(); // { audio, name, base, vol, dying }
  let currentName = null, currentBase = 1;
  let pending = null;       // [name, base] blocked by autoplay policy
  let duckUntil = 0;
  let ticker = null;
  const elements = {};      // per-track <audio>, created lazily

  function settings() {
    return (CW.UI && CW.UI.settings) || { master: 1, music: 0.8, sfx: 0.8, muted: false };
  }

  function elementFor(name) {
    if (!elements[name]) {
      const a = new Audio(TRACKS[name].src);
      a.loop = !!TRACKS[name].loop;
      a.preload = 'auto';
      a.volume = 0;
      if (!TRACKS[name].loop) {
        a.addEventListener('ended', () => {
          for (const s of active) if (s.audio === a) active.delete(s);
          if (currentName === name) currentName = null;
        });
      }
      elements[name] = a;
    }
    return elements[name];
  }

  function targetFor(state) {
    if (state.dying) return 0;
    const s = settings();
    if (s.muted) return 0;
    const duck = performance.now() < duckUntil ? 0.5 : 1;
    return Math.max(0, Math.min(1, state.base * s.music * s.master * duck));
  }

  function tick() {
    const step = TICK_MS / FADE_MS; // full fade over FADE_MS
    for (const s of [...active]) {
      const t = targetFor(s);
      const d = t - s.vol;
      s.vol += Math.max(-step, Math.min(step, d));
      s.vol = Math.max(0, Math.min(1, s.vol));
      try { s.audio.volume = s.vol; } catch (e) { /* fine */ }
      if (s.dying && s.vol <= 0.002) {
        s.audio.pause();
        active.delete(s);
      }
    }
    if (!active.size) { clearInterval(ticker); ticker = null; }
  }
  function ensureTicker() {
    if (!ticker) ticker = setInterval(tick, TICK_MS);
  }

  const Music = {
    // Crossfade to a track. base scales this use of the track
    // (the title screen plays the victory theme at base 0.4).
    play(name, base) {
      base = base === undefined ? 1 : base;
      if (!TRACKS[name]) return;
      if (currentName === name) {
        currentBase = base;
        for (const s of active) if (s.name === name && !s.dying) s.base = base;
        return;
      }
      for (const s of active) s.dying = true; // fade out whatever plays now
      currentName = name;
      currentBase = base;
      const audio = elementFor(name);
      try { audio.currentTime = 0; } catch (e) { /* not ready yet — plays from 0 anyway */ }
      const state = { audio, name, base, vol: 0, dying: false };
      const p = audio.play();
      if (p && p.catch) {
        p.then(() => { pending = null; }).catch(() => {
          // Autoplay blocked — remember and retry on first gesture.
          pending = [name, base];
          for (const s of active) if (s.audio === audio) active.delete(s);
          if (currentName === name) currentName = null;
        });
      }
      active.add(state);
      ensureTicker();
    },

    stop() {
      currentName = null;
      pending = null;
      for (const s of active) s.dying = true;
      ensureTicker();
    },

    // Sound effects call this; music dips to 50% and recovers.
    duck() {
      duckUntil = performance.now() + 350;
      ensureTicker();
    },

    // Volume/mute changed — the ticker eases everything to new targets.
    refresh() { ensureTicker(); },

    // What is (or wants to be) playing — for tests and debugging.
    nowPlaying() { return currentName || (pending && pending[0]) || null; },
  };

  // First user gesture unlocks autoplay-blocked audio.
  const unlock = () => {
    if (pending) {
      const [name, base] = pending;
      pending = null;
      Music.play(name, base);
    }
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  CW.Music = Music;
  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
