// Procedural sound primitives. Placeholder generators so the game is fully
// testable before any recording session (per the GDD dev-placeholder plan).
// Real files swap in via the manifest; these stay as a fallback.

// One reusable seconds-long white-noise buffer. Reused by every voice that needs
// noise (whispers, hiss, rumble) so we allocate it once.
export function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// A single procedural whisper "voice": breathy band-passed noise, chopped by a
// jittered tremolo to fake the granular stutter of speech. Each voice randomizes
// its formant centers and stutter rate so a field of them does not phase-lock.
// Returns a node graph; `output` is connected by the caller to a panner/bus.
export function createWhisperVoice(ctx, noiseBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.playbackRate.value = 0.7 + Math.random() * 0.5; // vary timbre per voice

  // Two stacked band-passes give a vowel-ish formant rather than flat hiss.
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 600 + Math.random() * 500;
  f1.Q.value = 4;

  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 1400 + Math.random() * 1200;
  f2.Q.value = 6;

  // Granular stutter: an LFO drives a gain so the voice pulses on/off like
  // breath. A waveshaper sharpens the sine toward a gate. Rate is per-voice.
  const tremolo = ctx.createGain();
  tremolo.gain.value = 0.5;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 2.5 + Math.random() * 4;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.5;
  const shaper = ctx.createWaveShaper();
  shaper.curve = gateCurve();
  lfo.connect(shaper).connect(lfoDepth).connect(tremolo.gain);

  // Per-voice output level so the field has near/far variation.
  const out = ctx.createGain();
  out.gain.value = 0.0;

  src.connect(f1).connect(f2).connect(tremolo).connect(out);

  return {
    output: out,
    start() { src.start(); lfo.start(); },
    stop() { try { src.stop(); lfo.stop(); } catch (_) {} },
    // Per-voice level, separate from the bus fade.
    setLevel(v, t = 0.5) {
      out.gain.setTargetAtTime(v, ctx.currentTime, t);
    },
  };
}

// The canonical name voice: the same breathy noise+formant chain, but the
// tremolo LFO is replaced by a one-shot, scheduled amplitude envelope of 2–3
// syllable humps so it scans like a spoken name rather than ambient breath. Dry
// and centered by design — the caller routes `output` straight to a gain/bus,
// never through a panner, so there are no spatial distance cues. Auto-stops after
// the word finishes.
export function createNameVoice(ctx, noiseBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.playbackRate.value = 0.82 + Math.random() * 0.12; // intimate, not shrill

  // Wider bands than the field voices: a single solo voice can't lean on
  // summation, so high-Q here would pass almost no energy and read as silence.
  // Lower Q keeps the formant character while letting the level actually sound.
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 1.2;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass'; f2.frequency.value = 1700; f2.Q.value = 1.6;

  const env = ctx.createGain();
  env.gain.value = 0.0001; // shaped by speak()
  const out = ctx.createGain();
  out.gain.value = 2.5; // makeup so NAME.SOLO maps to a clearly audible level

  src.connect(f1).connect(f2).connect(env).connect(out);

  return {
    output: out,
    start() { try { src.start(); } catch (_) {} },
    // Schedule the syllable humps at `level`. Returns total duration (seconds).
    speak(level, syllables = 3) {
      const t0 = ctx.currentTime + 0.02;
      const g = env.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(0.0001, t0);

      const atk = 0.045, sus = 0.13, rel = 0.085, gap = 0.06;
      let t = t0;
      for (let i = 0; i < syllables; i++) {
        const stress = i === 0 ? 1.0 : 0.78 + Math.random() * 0.18; // first syllable carries
        const peak = Math.max(0.0001, level * stress);
        g.linearRampToValueAtTime(peak, t + atk);
        g.setValueAtTime(peak, t + atk + sus);
        g.linearRampToValueAtTime(0.0001, t + atk + sus + rel);
        t += atk + sus + rel + gap;
      }

      const dur = t - t0;
      try { src.stop(t0 + dur + 0.1); } catch (_) {}
      return dur;
    },
    stop() { try { src.stop(); } catch (_) {} },
  };
}

// Maps a sine toward a soft gate so the tremolo reads as breath pulses, not a
// smooth wobble.
function gateCurve() {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.4);
  }
  return curve;
}
