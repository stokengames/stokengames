import * as THREE from 'three';

// First-person controller. Pointer lock and mouse-look are handled here; the
// state machine and global hotkeys live in main.js. Mouse-look only runs while
// `enabled` (i.e. while the pointer is actually locked), so dropping lock freezes
// the camera instead of leaving it spinning.

// Global walk-pace multiplier — the one knob to tune. 1.0 = original tuning;
// 0.55 ≈ 45% slower, for a calmer rail capture and a gentler free-movement feel.
const PACE_SCALE = 0.55;
const WALK = 1.5 * PACE_SCALE;  // m/s base walk (orig 1.5) — deliberately slow; horror hates a fast player
const FAST = 2.8 * PACE_SCALE;  // Shift fast-walk (orig 2.8), no true run per the GDD
const SENS = 0.0022;     // radians per pixel of mouse movement
const LOOK_KEY = 1.9;    // rad/s for IJKL keyboard-look (full no-mouse play)
const EYE = 1.6;         // eye height in meters
const RADIUS = 0.35;     // player footprint radius for collision
const PITCH_LIMIT = Math.PI / 2 - 0.05;

// Arrow keys and the numeric keypad mirror WASD (see update()). Scroll is already
// impossible (html/body are overflow:hidden), so we do NOT preventDefault on
// keydown — that was redundant and is the likely cause of the move+look conflict.

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, EYE, 0);
    this.keys = new Set();
    this.enabled = false;
    this.railMode = false; // On Rails: position is driven externally (rails.js); WASD translation is ignored, look stays live

    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._fwd = new THREE.Vector2();
    this._right = new THREE.Vector2();
    this._move = new THREE.Vector2();

    this._onMouseMove = (e) => {
      if (!this.enabled) return;
      this.yaw -= e.movementX * SENS;
      this.pitch -= e.movementY * SENS;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    };
    this._onKeyDown = (e) => { this.keys.add(e.code); };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  // Toggle mouse-look + movement. Clearing keys on disable prevents a held key
  // from "sticking" while the resume overlay is up.
  setEnabled(v) {
    this.enabled = v;
    if (!v) this.keys.clear();
  }

  teleport(x, z, yaw = 0) {
    this.pos.set(x, EYE, z);
    this.yaw = yaw;
    this.pitch = 0;
  }

  update(dt, resolve) {
    if (this.enabled) {
      // Heading basis on the XZ plane. At yaw 0 the camera looks down -Z, so
      // forward = (-sin yaw, -cos yaw) and right is its perpendicular.
      this._fwd.set(-Math.sin(this.yaw), -Math.cos(this.yaw));
      this._right.set(Math.cos(this.yaw), -Math.sin(this.yaw));

      const fwd = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.keys.has('Numpad8');
      const back = this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.keys.has('Numpad2');
      const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.keys.has('Numpad4');
      const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.keys.has('Numpad6');
      const f = (fwd ? 1 : 0) - (back ? 1 : 0);
      const r = (right ? 1 : 0) - (left ? 1 : 0);

      this._move.set(
        this._fwd.x * f + this._right.x * r,
        this._fwd.y * f + this._right.y * r
      );
      if (this._move.lengthSq() > 0 && !this.railMode) { // on rails, position comes from rails.js
        this._move.normalize();
        const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? FAST : WALK;
        this.pos.x += this._move.x * speed * dt;
        this.pos.z += this._move.y * speed * dt;
        resolve(this.pos, RADIUS);
      }

      // Keyboard look (IJKL) — turn/tilt the view with keys so the whole game is
      // playable on a bare trackpad, no mouse. Adds into the same yaw/pitch the
      // mouse drives, so the two coexist. Yaw sign matches mouse-look (right = −).
      const ly = (this.keys.has('KeyJ') ? 1 : 0) - (this.keys.has('KeyL') ? 1 : 0); // J left, L right
      const lp = (this.keys.has('KeyI') ? 1 : 0) - (this.keys.has('KeyK') ? 1 : 0); // I up, K down
      if (ly || lp) {
        this.yaw += ly * LOOK_KEY * dt;
        this.pitch += lp * LOOK_KEY * dt;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
      }
    }

    this.camera.position.copy(this.pos);
    this._euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this._euler);
  }
}
