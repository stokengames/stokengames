import { makeNoiseBuffer } from './procedural.js';

// World-bus ambience. The ONLY continuous source is rumble — a 90 Hz lowpass on
// noise (physically incapable of hiss), used as the floor the BATTERY_DEATH
// collapse falls to and taken to zero in every other state. No filtered-noise
// "ambience" beds (no rain/air/hiss) — those kept reading as hiss, so they're
// gone for good. The only world-noise SFX is the one-shot door whoosh. (A real
// recorded rain loop could be added later via the manifest, not synthesised.)
export function createWorldAmbience(ctx, destination) {
  const noise = makeNoiseBuffer(ctx, 2);

  // Rumble bed (sub-bass only).
  const rumbleSrc = ctx.createBufferSource();
  rumbleSrc.buffer = noise; rumbleSrc.loop = true;
  const rumbleLP = ctx.createBiquadFilter();
  rumbleLP.type = 'lowpass'; rumbleLP.frequency.value = 90; rumbleLP.Q.value = 0.7;
  const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.0;
  const cutLfo = ctx.createOscillator(); cutLfo.frequency.value = 0.15;
  const cutDepth = ctx.createGain(); cutDepth.gain.value = 30;
  cutLfo.connect(cutDepth).connect(rumbleLP.frequency);
  rumbleSrc.connect(rumbleLP).connect(rumbleGain);

  const out = ctx.createGain(); out.gain.value = 1.0;
  rumbleGain.connect(out);
  out.connect(destination);

  let leakSrc = null, leakGain = null;
  let rainSrc = null, rainGain = null;

  return {
    start() { rumbleSrc.start(); cutLfo.start(); },

    setRumble(v, t = 0.5) { rumbleGain.gain.setTargetAtTime(v, ctx.currentTime, t); },

    // Street rain — RECORDED buffer only. No-ops until a real loop is supplied, so
    // there is never any synthetic rain noise. Started lazily, then level-faded.
    startRain(buffer) {
      if (!buffer || rainSrc) return;
      rainSrc = ctx.createBufferSource();
      rainSrc.buffer = buffer; rainSrc.loop = true;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      rainSrc.connect(rainGain).connect(out);
      try { rainSrc.start(); } catch (_) {}
    },
    setRain(v, t = 1.5) { if (rainGain) rainGain.gain.setTargetAtTime(v, ctx.currentTime, t); },

    // Doors part: a brief pneumatic pressure release (a one-shot SFX, not a bed).
    doorOpen() {
      const t0 = ctx.currentTime;
      const hs = ctx.createBufferSource(); hs.buffer = noise; hs.loop = true;
      const hbp = ctx.createBiquadFilter();
      hbp.type = 'bandpass'; hbp.frequency.value = 1500; hbp.Q.value = 0.8;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.0001, t0);
      hg.gain.linearRampToValueAtTime(0.22, t0 + 0.15);
      hg.gain.setValueAtTime(0.22, t0 + 0.5);
      hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      hs.connect(hbp).connect(hg).connect(out);
      hs.start(t0); hs.stop(t0 + 1.8);
    },

    startLeak(buffer) {
      if (!buffer) return;
      if (leakSrc) { if (leakGain) leakGain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.5); return; }
      leakSrc = ctx.createBufferSource();
      leakSrc.buffer = buffer; leakSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
      leakGain = ctx.createGain(); leakGain.gain.value = 0.07;
      leakSrc.connect(lp).connect(leakGain).connect(out);
      try { leakSrc.start(); } catch (_) {}
    },
    stopLeak(t = 0.6) { if (leakGain) leakGain.gain.setTargetAtTime(0, ctx.currentTime, t); },
  };
}
