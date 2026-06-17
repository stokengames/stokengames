import * as THREE from 'three';
import { manifest } from './manifest.js';
import { loadBuffer, loadAll } from './loader.js';
import { createFileMusic, createProceduralMusic } from './music.js';
import { createWorldAmbience } from './world.js';
import { createAnnouncer } from './announcer.js';
import { WhisperField } from './whispers.js';

// The audio graph + facade. Three buses (music, world, whispers) → master. The
// context is created and resumed inside the Begin click. loadAssets() pulls the
// manifest files; anything that fails to load leaves its buffer null and the
// corresponding source falls back to procedural — no caller ever branches on it.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buses = {};
    this.music = null;
    this.world = null;
    this.whispers = null;
    this.buf = {};
    this._worldStarted = false;
    this.cues = manifest.musicCues;

    this._p = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._u = new THREE.Vector3();
  }

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.buses.music = this.ctx.createGain();
    this.buses.world = this.ctx.createGain();
    this.buses.whispers = this.ctx.createGain();
    this.buses.music.gain.value = 1.0;
    this.buses.world.gain.value = 0.8;
    this.buses.whispers.gain.value = 1.0;
    for (const b of Object.values(this.buses)) b.connect(this.master);

    this.world = createWorldAmbience(this.ctx, this.buses.world);
    this.whispers = new WhisperField(this.ctx, this.buses.whispers);
  }

  // Pull every manifest file. Returns a report of what loaded (for the HUD).
  async loadAssets() {
    const ctx = this.ctx, m = manifest;
    const [music, musicShort, instr, announcer, announcerBackup, lineFinal, lineCredits, rare] = await Promise.all([
      loadBuffer(ctx, m.music), loadBuffer(ctx, m.musicShort), loadBuffer(ctx, m.musicInstrumental),
      loadBuffer(ctx, m.announcer), loadBuffer(ctx, m.announcerBackup),
      loadBuffer(ctx, m.lineFinal), loadBuffer(ctx, m.lineCredits), loadBuffer(ctx, m.whisperRare),
    ]);
    const whispers = await loadAll(ctx, m.whispers);
    const beds = await loadAll(ctx, m.beds);
    const rain = m.rain ? await loadBuffer(ctx, m.rain) : null; // recorded loop, when supplied

    this.buf = { music, musicShort, instr, announcer, announcerBackup, lineFinal, lineCredits, rare, rain };
    this.whispers.setBuffers({ whispers, rare, beds });

    return {
      music: !!music, musicShort: !!musicShort, instrumental: !!instr,
      whispers: whispers.filter(Boolean).length, beds: beds.filter(Boolean).length,
      announcer: !!announcer, lineFinal: !!lineFinal,
      lineCredits: !!lineCredits, rare: !!rare,
    };
  }

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (_) {}
    }
  }

  now() { return this.ctx.currentTime; }

  startWorld() {
    if (this._worldStarted) return;
    this.world.start();
    this._worldStarted = true;
  }

  // Fresh music each call (file source nodes are one-shot). Real song if it
  // loaded, procedural pad otherwise. `short` selects the shortened edit (used for
  // the slam-back through the ending so the bridge arrives sooner).
  startMusic(offset = 0, loop = false, short = false) {
    if (this.music) this.music.dispose();
    const buffer = short ? (this.buf.musicShort || this.buf.music) : this.buf.music;
    this.music = buffer
      ? createFileMusic(this.ctx, this.buses.music, buffer)
      : createProceduralMusic(this.ctx, this.buses.music);
    this.music.startFrom(offset, loop);
  }

  // --- beat-level audio moments ------------------------------------------------

  playAnnouncer(useBackup = false) {
    const buf = useBackup ? this.buf.announcerBackup : this.buf.announcer;
    const a = createAnnouncer(this.ctx, this.buses.world, buf, this.whispers.noise);
    return a.play();
  }

  // The ending line — the most important line in the game; it must be unmistakable.
  // The recorded take is quiet (peak ~-9.7 dB), so it's pushed well up; the song
  // leans further aside and the whisper field dips for the window only, then
  // everything restores. (LINE_LEVEL is tuned for line-final-eli; a hotter take
  // like anna would want it lower to avoid clipping.)
  // The contact tears through the song's reality: the music GLITCHES out to
  // silence, the whisper plays clean in the gap, then the music glitches back in
  // and continues (further along — it kept running underneath). Replaces the duck.
  playFinalLine() {
    const LINE_LEVEL = 1.5; // anna take (peak ~-3 dB)
    const dur = this.buf.lineFinal ? this.buf.lineFinal.duration : 3;
    if (this.music) this.music.glitchOut();
    this.rampGain(this.buses.whispers, 0.25, 0.25); // field tears aside too
    // Whisper plays clean over the silence, just after the glitch-out.
    setTimeout(() => this._playBuffer(this.buf.lineFinal, this.master, LINE_LEVEL), 280);
    // Music + field glitch/fade back in once the line has landed.
    setTimeout(() => {
      if (this.music) this.music.glitchIn();
      this.rampGain(this.buses.whispers, 1.0, 1.0);
    }, (0.28 + dur + 0.2) * 1000);
    return 0.28 + dur;
  }

  // The one extra credits whisper — the last scare. Same treatment as the final
  // line: the song leans aside so it lands in relative quiet, the word a touch
  // forward, then the song restores.
  playCreditsWhisper() {
    const LVL = 1.6; // line-credits-hello peak ~-5 dB → ~0.72 at output, clear
    if (this.music) this.music.duck(0.3, 0.5);
    const dur = this._playBuffer(this.buf.lineCredits, this.master, LVL) || 1.5;
    setTimeout(() => { if (this.music) this.music.unduck(1.5); }, (dur + 0.3) * 1000);
    return dur;
  }

  // Instrumental loops under the credits.
  startCreditsBed() {
    if (this.music) this.music.dispose();
    if (this.buf.instr) {
      this.music = createFileMusic(this.ctx, this.buses.music, this.buf.instr);
      this.music.startFrom(0, true);
    } else {
      this.startMusic(0, true); // procedural fallback keeps droning
    }
  }

  _playBuffer(buffer, dest, level) {
    if (!buffer) return 0;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = level;
    src.connect(g).connect(dest);
    try { src.start(); } catch (_) {}
    return buffer.duration;
  }

  // --- helpers -----------------------------------------------------------------

  rampGain(gainNode, value, dur) {
    const t = this.now();
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
    gainNode.gain.linearRampToValueAtTime(value, t + dur);
  }
  crossfade(fromGain, toGain, dur, toLevel = 1) {
    this.rampGain(fromGain, 0, dur);
    this.rampGain(toGain, toLevel, dur);
  }
  setBus(name, value, dur = 0.5) { this.rampGain(this.buses[name], value, dur); }

  updateListener(camera) {
    const l = this.ctx.listener;
    camera.getWorldPosition(this._p);
    camera.getWorldDirection(this._f);
    this._u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const t = this.now();
    if (l.positionX) {
      l.positionX.setValueAtTime(this._p.x, t);
      l.positionY.setValueAtTime(this._p.y, t);
      l.positionZ.setValueAtTime(this._p.z, t);
      l.forwardX.setValueAtTime(this._f.x, t);
      l.forwardY.setValueAtTime(this._f.y, t);
      l.forwardZ.setValueAtTime(this._f.z, t);
      l.upX.setValueAtTime(this._u.x, t);
      l.upY.setValueAtTime(this._u.y, t);
      l.upZ.setValueAtTime(this._u.z, t);
    } else {
      l.setPosition(this._p.x, this._p.y, this._p.z);
      l.setOrientation(this._f.x, this._f.y, this._f.z, this._u.x, this._u.y, this._u.z);
    }
  }
}
