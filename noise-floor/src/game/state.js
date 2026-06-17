// Finite state machine owning the GDD beats. Every scripted event — battery
// hitting zero, the lights dying, the whisper of the player's name, the line
// inside the music — becomes a transition or a timer here, never scattered
// across scene/audio modules. Those modules subscribe via enter/update/exit
// handlers; they do not fire beats themselves.
//
// Phase 1 wires only the skeleton: state, per-state handlers, an elapsed timer,
// and debug jumps. The real triggers (battery drain, audio cues) arrive with
// later phases.

export const STATES = [
  'TITLE',
  'TRAIN_SAFE',
  'BATTERY_DEATH',
  'PLATFORM',
  'POSTER',
  'CHARGER',
  'FALSE_RELIEF',
  'ENDING',
  'CREDITS',
];

export class StateMachine {
  constructor() {
    this.state = null;
    this.handlers = {};     // name -> { enter?, update?, exit? }
    this.elapsed = 0;       // seconds since entering the current state
    this.playerName = '';   // carried from the title screen; used by BATTERY_DEATH in Phase 2
  }

  on(name, handler) {
    this.handlers[name] = handler;
    return this;
  }

  set(name) {
    if (name === this.state) return;
    const prev = this.handlers[this.state];
    if (prev && prev.exit) prev.exit(this);
    this.state = name;
    this.elapsed = 0;
    const next = this.handlers[name];
    if (next && next.enter) next.enter(this);
  }

  update(dt) {
    this.elapsed += dt;
    const h = this.handlers[this.state];
    if (h && h.update) h.update(dt, this);
  }
}
