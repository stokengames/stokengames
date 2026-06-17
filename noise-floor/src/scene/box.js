import * as THREE from 'three';
import { addBoxCollider } from '../colliders.js';

// One shared box factory so scene modules stay terse and every solid that the
// player can hit also lands in the collider registry from a single call site.
// MeshStandardMaterial + the temporary dev lights in main.js make depth readable
// while gray-boxing; the real material/lighting work is the Phase 4 look pass.
export function box(group, opts) {
  const {
    x = 0, y = 0, z = 0,
    w = 1, h = 1, d = 1,
    color = 0x888888,
    solid = false,
    tag = 'wall',
  } = opts;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })
  );
  mesh.position.set(x, y, z);
  group.add(mesh);

  if (solid) addBoxCollider(x, z, w, d, tag);
  return mesh;
}
