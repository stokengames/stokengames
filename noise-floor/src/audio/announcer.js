// The poster's archival sting (Beat 4). The PSA voice is recorded clean; the
// aged-broadcast character is applied here so it stays tunable: the voice is
// band-limited to a small speaker with a slow pitch wobble, under a crackle/static
// layer. No broadcast tone — per direction, the sting begins directly on the voice
// (this overrides the GDD's "broadcast tone"). If the voice buffer failed to load,
// the static + caption still carry the beat.

const VOICE_LEVEL = 1.7;  // raised — it was too quiet against the whisper field
const STATIC_LEVEL = 0.06;

export function createAnnouncer(ctx, destination, voiceBuffer, noiseBuffer) {
  return {
    // Returns the approximate total duration so the caller can time the caption.
    play() {
      const t0 = ctx.currentTime;
      const startV = t0 + 0.02; // begin (almost) immediately — no tone before it
      let voiceDur = 2.5;

      // Voice: band-limited small-speaker character + slow pitch wobble.
      if (voiceBuffer) {
        voiceDur = voiceBuffer.duration;
        const src = ctx.createBufferSource();
        src.buffer = voiceBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 350;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 3000;
        const bp = ctx.createBiquadFilter();
        bp.type = 'peaking'; bp.frequency.value = 1500; bp.gain.value = 6; bp.Q.value = 1.2;
        const wob = ctx.createOscillator(); wob.frequency.value = 1.7;
        const wobDepth = ctx.createGain(); wobDepth.gain.value = 14; // cents
        wob.connect(wobDepth).connect(src.detune);
        const vg = ctx.createGain();
        src.connect(hp).connect(lp).connect(bp).connect(vg).connect(destination);
        // 25ms fade-in so the onset has no click.
        vg.gain.setValueAtTime(0.0001, startV);
        vg.gain.linearRampToValueAtTime(VOICE_LEVEL, startV + 0.025);
        src.start(startV); wob.start(startV);
        wob.stop(startV + voiceDur + 0.1);
      }

      // Static/crackle under the voice, fading in so there's no onset tick.
      const total = voiceDur + 0.4;
      if (noiseBuffer) {
        const ns = ctx.createBufferSource();
        ns.buffer = noiseBuffer; ns.loop = true;
        const nhp = ctx.createBiquadFilter();
        nhp.type = 'highpass'; nhp.frequency.value = 2500;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.linearRampToValueAtTime(STATIC_LEVEL, t0 + 0.12);
        ns.connect(nhp).connect(ng).connect(destination);
        ns.start(t0);
        ns.stop(t0 + total);
      }

      return total;
    },
  };
}
