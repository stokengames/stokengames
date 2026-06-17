// The earbud track. Two implementations behind one interface so the rest of the
// game never branches on which is live:
//   createFileMusic        — the real song (manifest), stereo
//   createProceduralMusic  — the Phase 2 warm pad, fallback when the file fails
//
// Shared interface:
//   startFrom(offset, loop) play from `offset` seconds (file) / just start (pad)
//   setLevel(v, t)          ramp inner level
//   duck(v, t) / unduck(t)  pull the music down under the bridge line, then back
//   stutterOut(dur)         dying-tape collapse (battery death)
//   position()              seconds into the track (for bridge-line timing)
//   stop() / dispose()

const FULL = 0.9;

export function createFileMusic(ctx, destination, buffer) {
  // source → lowpass (stutter + leak character) → inner gain → destination
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.5;
  const inner = ctx.createGain();
  inner.gain.value = 0.0;
  lp.connect(inner).connect(destination);

  let src = null;
  let startedAt = 0;   // ctx time when playback began
  let startOffset = 0; // seconds into the track at that moment

  return {
    startFrom(offset = 0, loop = false) {
      if (src) { try { src.stop(); } catch (_) {} }
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = loop;
      src.connect(lp);
      startedAt = ctx.currentTime;
      startOffset = offset;
      src.start(0, offset);
      inner.gain.setTargetAtTime(FULL, ctx.currentTime, 0.6);
    },
    setLevel(v, t = 0.5) { inner.gain.setTargetAtTime(v, ctx.currentTime, t); },
    duck(v = 0.32, t = 0.4) { inner.gain.setTargetAtTime(v, ctx.currentTime, t); },
    unduck(t = 1.2) { inner.gain.setTargetAtTime(FULL, ctx.currentTime, t); },

    // The contact tearing the song: a hard glitch-stutter to silence (the source
    // keeps running underneath, so it returns further along), and the matching
    // glitch back in. The lp slams shut/open for a digital-tear character.
    glitchOut() {
      const t0 = ctx.currentTime;
      const g = inner.gain;
      g.cancelScheduledValues(t0);
      let t = t0, on = false;
      for (let i = 0; i < 7; i++) { g.setValueAtTime(on ? FULL : 0.0, t); t += 0.035; on = !on; }
      g.setValueAtTime(0.0, t); // silence — the whisper plays clean
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.setValueAtTime(lp.frequency.value, t0);
      lp.frequency.exponentialRampToValueAtTime(360, t0 + 0.25);
    },
    glitchIn() {
      const t0 = ctx.currentTime;
      const g = inner.gain;
      g.cancelScheduledValues(t0);
      let t = t0, on = true;
      for (let i = 0; i < 7; i++) { g.setValueAtTime(on ? FULL : 0.0, t); t += 0.035; on = !on; }
      g.setValueAtTime(FULL, t);
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.setValueAtTime(360, t0);
      lp.frequency.exponentialRampToValueAtTime(18000, t0 + 0.3);
    },

    stutterOut(dur = 2.6) {
      const t0 = ctx.currentTime;
      if (src) {
        // Tape drag: playback rate sags as the reel dies.
        src.playbackRate.cancelScheduledValues(t0);
        src.playbackRate.setValueAtTime(src.playbackRate.value, t0);
        src.playbackRate.linearRampToValueAtTime(0.2, t0 + dur);
      }
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.setValueAtTime(lp.frequency.value, t0);
      lp.frequency.exponentialRampToValueAtTime(180, t0 + dur);

      const g = inner.gain;
      g.cancelScheduledValues(t0);
      let t = t0, on = true, step = 0.06;
      while (t < t0 + dur) {
        g.setValueAtTime(on ? FULL * (1 - (t - t0) / dur) : 0.0, t);
        t += step; step *= 1.18; on = !on;
      }
      g.setValueAtTime(0, t0 + dur);
      if (src) { try { src.stop(t0 + dur + 0.1); } catch (_) {} }
      return dur;
    },

    position() {
      return src ? startOffset + (ctx.currentTime - startedAt) : 0;
    },
    // Seconds of audio left before the (non-looping) track ends.
    remaining() {
      if (!src) return 0;
      return Math.max(0, buffer.duration - (startOffset + (ctx.currentTime - startedAt)));
    },
    stop() { if (src) { try { src.stop(); } catch (_) {} } },
    dispose() { this.stop(); try { inner.disconnect(); } catch (_) {} },
  };
}

// Procedural fallback: the Phase 2 minor pad. position()/duck() are no-ops or
// approximations so callers don't need to special-case the fallback.
export function createProceduralMusic(ctx, destination) {
  const notes = [110, 130.81, 164.81, 220];
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.6;
  const inner = ctx.createGain();
  inner.gain.value = 0.0;
  lp.connect(inner).connect(destination);

  const oscs = notes.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = Math.random() * 10 - 5;
    const g = ctx.createGain(); g.gain.value = 0.18;
    o.connect(g).connect(lp);
    return o;
  });
  const fLfo = ctx.createOscillator();
  fLfo.frequency.value = 0.08;
  const fDepth = ctx.createGain(); fDepth.gain.value = 400;
  fLfo.connect(fDepth).connect(lp.frequency);

  let started = false;
  let startedAt = 0;

  return {
    startFrom() {
      if (started) return;
      started = true;
      startedAt = ctx.currentTime;
      oscs.forEach((o) => o.start());
      fLfo.start();
      inner.gain.setTargetAtTime(FULL, ctx.currentTime, 0.8);
    },
    setLevel(v, t = 0.5) { inner.gain.setTargetAtTime(v, ctx.currentTime, t); },
    duck(v = 0.32, t = 0.4) { inner.gain.setTargetAtTime(v, ctx.currentTime, t); },
    unduck(t = 1.2) { inner.gain.setTargetAtTime(FULL, ctx.currentTime, t); },
    glitchOut() {
      const g = inner.gain; const t0 = ctx.currentTime;
      g.cancelScheduledValues(t0);
      let t = t0, on = false;
      for (let i = 0; i < 7; i++) { g.setValueAtTime(on ? FULL : 0.0, t); t += 0.035; on = !on; }
      g.setValueAtTime(0.0, t);
    },
    glitchIn() {
      const g = inner.gain; const t0 = ctx.currentTime;
      g.cancelScheduledValues(t0);
      let t = t0, on = true;
      for (let i = 0; i < 7; i++) { g.setValueAtTime(on ? FULL : 0.0, t); t += 0.035; on = !on; }
      g.setValueAtTime(FULL, t);
    },
    stutterOut(dur = 2.6) {
      const t0 = ctx.currentTime;
      oscs.forEach((o) => {
        o.detune.cancelScheduledValues(t0);
        o.detune.setValueAtTime(o.detune.value, t0);
        o.detune.linearRampToValueAtTime(-2400, t0 + dur);
      });
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.setValueAtTime(lp.frequency.value, t0);
      lp.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      const g = inner.gain;
      g.cancelScheduledValues(t0);
      let t = t0, on = true, step = 0.06;
      while (t < t0 + dur) {
        g.setValueAtTime(on ? FULL * (1 - (t - t0) / dur) : 0.0, t);
        t += step; step *= 1.18; on = !on;
      }
      g.setValueAtTime(0, t0 + dur);
      oscs.forEach((o) => { try { o.stop(t0 + dur + 0.1); } catch (_) {} });
      return dur;
    },
    position() { return started ? ctx.currentTime - startedAt : 0; },
    remaining() { return Infinity; }, // the pad drones; it never runs out
    stop() { try { oscs.forEach((o) => o.stop()); fLfo.stop(); } catch (_) {} },
    dispose() { this.stop(); try { inner.disconnect(); } catch (_) {} },
  };
}
