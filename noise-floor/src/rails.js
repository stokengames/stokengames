// On Rails replay controller. Drives the camera's XZ position along a recorded
// canonical path (rails-path.js) so a movement-averse player only has to LOOK
// (mouse or IJKL). It is a POSITION SOURCE plus two hooks — it never fires a beat
// the FSM doesn't already own. Free movement is the default and untouched; this
// runs only when on rails.
//
// Rail clock: seconds since TRAIN_SAFE, advancing real-time EXCEPT it parks at
// the charger until the player completes the (still-required) hold — the one beat
// that stays player-gated. The poster sting auto-fires as the camera arrives; the
// climb and the whole song-clock ending fire on their own existing triggers once
// the rail has carried the camera to them.

const POST_CHARGE = new Set(['FALSE_RELIEF', 'ENDING', 'CREDITS']);
const firstT = (path, s) => { const k = path.find((p) => p.s === s); return k ? k.t : null; };

export class RailsController {
  // hooks: { isFrozen(), isClimbing(), getState(), firePoster() }
  constructor(path, player, hooks) {
    this.path = path;
    this.player = player;
    this.hooks = hooks;
    // Beat anchors derived from the recording's state field — nothing to author.
    this.posterT = firstT(path, 'POSTER');           // auto-fire the sting here
    this.chargeArriveT = firstT(path, 'CHARGER');    // park here until the hold completes
    this.chargeResumeT = firstT(path, 'FALSE_RELIEF'); // resume from here afterwards
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.i = 0;                // interpolation cursor into path
    this.posterFired = false;
    this._chargeDone = false;
    this.waitingAtCharger = false; // read by main for the 8s "hold Spacebar" nudge
  }

  update(dt) {
    this.waitingAtCharger = false;
    if (this.hooks.isFrozen()) return;                          // final-line contact: freeze with the player
    if (this.hooks.isClimbing()) { this.clock += dt; return; }  // the fade-cut owns the camera; keep the clock moving
    if (!this.player.enabled) return;                           // resume overlay up: hold everything

    const state = this.hooks.getState();

    // Charger gate — the one required action. Park at the arrival position until
    // the live hold completes (FALSE_RELIEF fires), then resume from the recorded
    // departure point. Event-gated, so it's robust to how long the player takes.
    if (!this._chargeDone && this.chargeArriveT != null && this.clock >= this.chargeArriveT) {
      if (POST_CHARGE.has(state)) {
        this._chargeDone = true;
        if (this.chargeResumeT != null) this.clock = this.chargeResumeT;
      } else {
        this.clock = this.chargeArriveT;
        this._setPosAt(this.chargeArriveT);
        this.waitingAtCharger = true;
        return;
      }
    }

    this.clock += dt;

    // Poster sting auto-fires as the rail reaches it (not load-bearing; no press).
    if (!this.posterFired && this.posterT != null && this.clock >= this.posterT) {
      this.posterFired = true;
      this.hooks.firePoster();
    }

    this._setPosAt(this.clock);
  }

  // Linear-interpolate the recorded XZ at rail time t into player.pos; leaves
  // player.pos.y (eye height) alone. Cursor (this.i) advances monotonically.
  _setPosAt(t) {
    const s = this.path;
    if (!s.length) return;
    if (t <= s[0].t) { this.player.pos.x = s[0].x; this.player.pos.z = s[0].z; return; }
    const last = s[s.length - 1];
    if (t >= last.t) { this.player.pos.x = last.x; this.player.pos.z = last.z; return; }
    while (this.i < s.length - 1 && s[this.i + 1].t <= t) this.i++;
    while (this.i > 0 && s[this.i].t > t) this.i--;
    const a = s[this.i], b = s[this.i + 1];
    const f = (t - a.t) / Math.max(1e-4, b.t - a.t);
    this.player.pos.x = a.x + (b.x - a.x) * f;
    this.player.pos.z = a.z + (b.z - a.z) * f;
  }
}
