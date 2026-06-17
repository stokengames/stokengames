import * as THREE from 'three';
import { makeNoiseBuffer, createWhisperVoice, createNameVoice } from './procedural.js';

// The positional whisper field. Voices are PannerNodes (HRTF), each a recorded
// loop (manifest) or a procedural voice. All loop forever and the field follows
// the player (voices left behind are relocated), so it never runs out.
//
// The field is an ALWAYS-ON audible base layer once it has appeared: ~5 voices at
// a level the player can clearly hear. Charging layers in more voices (up to the
// cap) — the escalation is density, peaking at the slam. Which tracks form the
// base and the order extra tracks join are randomized per run (a shuffled bag),
// so no two playthroughs match; whisper-13 stays a rare easter egg.
//
// The name voice plays on the dry, centered nameGain path slightly forward in the
// mix — the field is NOT ducked for it; it continues underneath, uninterrupted.

const HEAD_Y = 1.6;
const VOICE_CAP = 13;
const BASE_COUNT = 5;
const REFRESH_DIST = 13;
const RARE_RUN_CHANCE = 0.2;  // chance whisper-13 appears at all in a given run
const BED_LEVEL = 0.16;
const BASE_FIELD = 0.85;      // clearly audible base level
const PEAK_FIELD = 1.0;       // at the slam

const APPROACH = { SPEED: 0.4, MOVE_THRESH: 0.6, MIN_DIST_FAR: 1.7, MIN_DIST_NEAR: 0.8 };
const NAME = { SOLO: 0.85 };  // slightly forward so it's findable

function syllableCount(word) {
  const m = (word || '').toLowerCase().match(/[aeiouy]+/g);
  const n = m ? m.length : 0;
  if (!n) return 2;
  return Math.max(1, Math.min(4, n));
}

export class WhisperField {
  constructor(ctx, busDestination) {
    this.ctx = ctx;
    this.noise = makeNoiseBuffer(ctx, 2);

    this.fieldGain = ctx.createGain();
    this.fieldGain.gain.value = 0.0;
    this.fieldGain.connect(busDestination);

    this.nameGain = ctx.createGain();
    this.nameGain.gain.value = 1.0;
    this.nameGain.connect(busDestination);

    this.buffers = null;
    this.rareBuffer = null;
    this.bedBuffers = null;
    this.beds = [];

    this.voices = [];
    this._field = 0;
    this._fieldTarget = 0;
    this._fadeRate = 1;
    this._coupling = 1;
    this._couplingFloor = 0;

    this.approach = false;
    this.nearest = Infinity;
    this._densityTimer = 0;
    this._bag = [];            // shuffled track indices, drawn without repeats

    this._fwd = new THREE.Vector3();
    this._pos = new THREE.Vector3();
  }

  setBuffers({ whispers, rare, beds }) {
    const valid = (whispers || []).filter(Boolean);
    this.buffers = valid.length ? valid : null;
    this.rareBuffer = rare || null;
    this.bedBuffers = (beds || []).filter(Boolean);
  }

  setApproach(v) { this.approach = v; }

  // Draw the next track index from a shuffled bag (refills when empty) so the
  // base layer and join order vary per run and don't repeat the same voices.
  _drawBag() {
    if (!this.buffers) return 0;
    if (!this._bag.length) {
      this._bag = this.buffers.map((_, i) => i);
      for (let i = this._bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
      }
    }
    return this._bag.pop();
  }

  _makePanner() {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.5;
    p.maxDistance = 25;
    p.rolloffFactor = 1.2;
    return p;
  }

  _fileVoice(buffer) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(g);
    return {
      output: g,
      start() { try { src.start(); } catch (_) {} },
      stop() { try { src.stop(); } catch (_) {} },
      setLevel(v, t = 0.5) { g.gain.setTargetAtTime(v, ctx.currentTime, t); },
    };
  }

  addVoice(camera, kind = 'normal') {
    if (this.voices.length >= VOICE_CAP) return;
    camera.getWorldPosition(this._pos);
    camera.getWorldDirection(this._fwd);
    const behind = Math.atan2(-this._fwd.x, -this._fwd.z);
    const ang = behind + (Math.random() - 0.5) * Math.PI;
    const radius = 2 + Math.random() * 3.5;
    const base = new THREE.Vector3(
      this._pos.x + Math.sin(ang) * radius,
      HEAD_Y + (Math.random() * 0.4 - 0.2),
      this._pos.z - Math.cos(ang) * radius
    );
    let level = 0.4 + 0.4 * (1 - (radius - 2) / 3.5);

    let voice;
    if (this.buffers) {
      if (kind === 'rare' && this.rareBuffer) {
        voice = this._fileVoice(this.rareBuffer); level *= 0.5; // rare stays low
      } else {
        voice = this._fileVoice(this.buffers[this._drawBag()]);
      }
    } else {
      voice = createWhisperVoice(this.ctx, this.noise);
    }

    const panner = this._makePanner();
    voice.output.connect(panner).connect(this.fieldGain);
    voice.start();
    voice.setLevel(level, 0.4);
    this._setPanner(panner, base);

    this.voices.push({
      panner, voice, base, level,
      dphase: Math.random() * Math.PI * 2,
      speed: 0.12 + Math.random() * 0.18,
      radius: 0.4 + Math.random() * 0.5,
    });
  }

  spawnBehind(camera, count = BASE_COUNT) {
    this.clear();
    // whisper-13 appears at all only occasionally, and then in just one slot.
    const rareThisRun = this.rareBuffer && Math.random() < RARE_RUN_CHANCE;
    const rareSlot = rareThisRun ? Math.floor(Math.random() * count) : -1;
    for (let i = 0; i < count; i++) this.addVoice(camera, i === rareSlot ? 'rare' : 'normal');
    this._startBeds();
  }

  _startBeds() {
    if (!this.bedBuffers || !this.bedBuffers.length) return;
    this.bedBuffers.forEach((buf, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = i % 2 ? 0.35 : -0.35;
      const g = this.ctx.createGain(); g.gain.value = BED_LEVEL;
      src.connect(pan).connect(g).connect(this.fieldGain);
      try { src.start(); } catch (_) {}
      this.beds.push(src);
    });
  }

  rampField(target, dur = 3) {
    this._fieldTarget = Math.max(0, Math.min(1, target));
    this._fadeRate = Math.abs(this._fieldTarget - this._field) / Math.max(0.01, dur);
  }
  // Bring the field up to the audible base (used at the death beat).
  fadeIn(dur = 3) { this.rampField(BASE_FIELD, dur); }

  // Charger escalation: layer in voices across the hold; level nudges from base to
  // peak with the charge. `progress` is the charge fraction (0..1).
  escalate(camera, dt, progress = 0) {
    const p = Math.min(1, Math.max(0, progress));
    this._fieldTarget = BASE_FIELD + (PEAK_FIELD - BASE_FIELD) * p;
    this._fadeRate = Math.max(this._fadeRate, 0.6);
    this._densityTimer += dt;
    if (this._densityTimer >= 1.2 && this.voices.length < VOICE_CAP) {
      this._densityTimer = 0;
      this.addVoice(camera, 'normal'); // ~one voice every 1.2s → all 13 by the slam
    }
  }

  setMusicCoupling(musicLevel) {
    this._coupling = Math.max(this._couplingFloor, Math.min(1, Math.max(0, 1 - musicLevel)));
  }
  setCouplingFloor(f) { this._couplingFloor = Math.max(0, Math.min(1, f)); }

  // The name voice — dry, centered, slightly forward. No field duck: the field
  // keeps going underneath, uninterrupted.
  speakName(camera, word, onCaption) {
    const nv = createNameVoice(this.ctx, this.noise);
    nv.output.connect(this.nameGain);
    nv.start();
    const dur = nv.speak(NAME.SOLO, syllableCount(word));
    if (onCaption) onCaption();
    setTimeout(() => { try { nv.output.disconnect(); } catch (_) {} }, (dur + 0.5) * 1000);
  }

  update(dt, camera, playerSpeed = 0) {
    if (this._field !== this._fieldTarget) {
      const dir = Math.sign(this._fieldTarget - this._field);
      this._field = Math.max(0, Math.min(1, this._field + dir * this._fadeRate * dt));
    }
    const g = this._field * this._coupling;
    this.fieldGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.04);

    camera.getWorldPosition(this._pos);
    camera.getWorldDirection(this._fwd);
    const inten = this._field;
    const eagerBase = this.approach ? Math.max(0, 1 - playerSpeed / APPROACH.MOVE_THRESH) : 0;
    const minD = APPROACH.MIN_DIST_FAR - (APPROACH.MIN_DIST_FAR - APPROACH.MIN_DIST_NEAR) * inten;

    let nearest = Infinity;
    for (const v of this.voices) {
      if (eagerBase > 0) {
        const dx = this._pos.x - v.base.x, dz = this._pos.z - v.base.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        if (d > minD) {
          const stepd = APPROACH.SPEED * eagerBase * (0.4 + inten) * dt;
          v.base.x += (dx / d) * stepd;
          v.base.z += (dz / d) * stepd;
        }
      }
      v.dphase += v.speed * (0.6 + inten * 1.6) * dt;
      const ox = Math.sin(v.dphase) * v.radius;
      const oz = Math.cos(v.dphase * 0.8) * v.radius;
      const px = v.base.x + ox, pz = v.base.z + oz;

      const distBase = Math.hypot(this._pos.x - v.base.x, this._pos.z - v.base.z);
      if (distBase > REFRESH_DIST) {
        const behind = Math.atan2(-this._fwd.x, -this._fwd.z);
        const a = behind + (Math.random() - 0.5) * Math.PI;
        const r = 2 + Math.random() * 3;
        v.base.set(this._pos.x + Math.sin(a) * r, HEAD_Y + (Math.random() * 0.4 - 0.2), this._pos.z - Math.cos(a) * r);
      }

      this._setPanner(v.panner, { x: px, y: v.base.y, z: pz });
      const dist = Math.hypot(this._pos.x - px, this._pos.z - pz);
      if (dist < nearest) nearest = dist;
    }
    this.nearest = nearest;
  }

  _setPanner(panner, p) {
    if (panner.positionX) {
      const t = this.ctx.currentTime;
      panner.positionX.setValueAtTime(p.x, t);
      panner.positionY.setValueAtTime(p.y, t);
      panner.positionZ.setValueAtTime(p.z, t);
    } else {
      panner.setPosition(p.x, p.y, p.z);
    }
  }

  clear() {
    for (const v of this.voices) {
      v.voice.stop();
      try { v.panner.disconnect(); } catch (_) {}
    }
    for (const b of this.beds) { try { b.stop(); } catch (_) {} }
    this.voices = [];
    this.beds = [];
    this.approach = false;
    this.nearest = Infinity;
    this._densityTimer = 0;
    this._bag = [];
    this._field = 0;
    this._fieldTarget = 0;
    this.fieldGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
