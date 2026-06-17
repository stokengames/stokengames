import * as THREE from 'three';

// Minimal proximity interaction registry. Each item has a world position and a
// radius; the nearest enabled item within range becomes `current` and shows a
// prompt. Press-to-interact (poster) calls trigger(); hold-to-interact (charger)
// is driven directly by main.js reading key state against `current`.
export class Interactions {
  constructor() {
    this.items = [];
    this.current = null;
    this._v = new THREE.Vector3();
  }

  // type: 'press' | 'hold'. prompt is the HUD text. onInteract used for 'press'.
  add(tag, position, radius, { type = 'press', prompt = 'Press E', onInteract = null } = {}) {
    this.items.push({ tag, position, radius, type, prompt, onInteract, enabled: true });
  }

  setEnabled(tag, v) {
    for (const it of this.items) if (it.tag === tag) it.enabled = v;
  }

  // Returns the current item (or null). Picks the nearest enabled item in range.
  update(playerPos) {
    let best = null, bestD = Infinity;
    for (const it of this.items) {
      if (!it.enabled) continue;
      const d = Math.hypot(playerPos.x - it.position.x, playerPos.z - it.position.z);
      if (d <= it.radius && d < bestD) { best = it; bestD = d; }
    }
    this.current = best;
    return best;
  }

  trigger() {
    if (this.current && this.current.type === 'press' && this.current.onInteract) {
      this.current.onInteract();
    }
  }
}
