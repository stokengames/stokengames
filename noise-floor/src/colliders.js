// Shared collider registry. The whole gray-box world is axis-aligned boxes, so
// AABB is the exact-fit primitive and no broadphase is needed at this scale.
// Collision is solved in the XZ plane only: floors are flat and fixed-height in
// Phase 1, so there is nothing to resolve vertically yet.

const solids = []; // { minX, maxX, minZ, maxZ, tag }

export function clearColliders() {
  solids.length = 0;
}

// Distance (XZ) from a point to the nearest solid surface — used to fade a faint
// proximity light up when the player is about to bump a wall in the dark.
export function nearestWallDistance(pos) {
  let best = Infinity;
  for (const b of solids) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const d = Math.hypot(pos.x - cx, pos.z - cz);
    if (d < best) best = d;
  }
  return best;
}

// Register a solid box by its center and footprint. Y is ignored on purpose.
export function addBoxCollider(cx, cz, w, d, tag = 'wall') {
  solids.push({
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
    tag,
  });
}

// Drop colliders by tag — used to "open" the train doors (remove the blocker).
export function removeByTag(tag) {
  for (let i = solids.length - 1; i >= 0; i--) {
    if (solids[i].tag === tag) solids.splice(i, 1);
  }
}

// Push a circle (player footprint) out of every solid it overlaps. Two passes
// settle the common case of being wedged between two boxes (a corner). Resolving
// against the nearest face leaves tangential motion intact, which is what gives
// clean wall-sliding without a physics engine.
export function resolve(pos, r) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of solids) {
      const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;

      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = r - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // Center is inside the box: eject through the nearest face.
        const left = pos.x - b.minX, right = b.maxX - pos.x;
        const near = pos.z - b.minZ, far = b.maxZ - pos.z;
        const m = Math.min(left, right, near, far);
        if (m === left) pos.x = b.minX - r;
        else if (m === right) pos.x = b.maxX + r;
        else if (m === near) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
  }
}
