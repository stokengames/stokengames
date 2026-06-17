import * as THREE from 'three';
import { box } from './box.js';

// Short dark stair-foot vestibule off the platform's back-wall exit. The climb
// itself is a scripted transition (fade → handled rise → emerge in the street),
// so there are no real steps to walk — the old floating steps read wrong and are
// gone. Crossing into this volume triggers the transition (main.js).
export function build() {
  const g = new THREE.Group();
  g.name = 'stairwell';

  const minX = 15, maxX = 23, nearZ = -12, farZ = -18, H = 3.2, T = 0.3;
  const cx = (minX + maxX) / 2, cz = (nearZ + farZ) / 2, wid = nearZ - farZ;

  box(g, { x: cx, y: -T / 2, z: cz, w: maxX - minX, h: T, d: wid, color: 0x20292a });
  box(g, { x: minX, y: H / 2, z: cz, w: T, h: H, d: wid, color: 0x222c2c, solid: true });
  box(g, { x: maxX, y: H / 2, z: cz, w: T, h: H, d: wid, color: 0x222c2c, solid: true });
  box(g, { x: cx, y: H / 2, z: farZ, w: maxX - minX, h: H, d: T, color: 0x1a2222, solid: true });

  return g;
}
