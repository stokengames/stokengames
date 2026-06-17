import * as THREE from 'three';

// Visual rain for the street slice — lightweight falling line-segment streaks
// (cheap; ~300 streaks). Confined to the street volume and only really seen there
// (the platform is too far through the fog). Matches the rain audio. Teal-cool,
// low opacity so the streetlight reads through it rather than it dominating.
const COUNT = 320;
const AREA = { minX: 8, maxX: 30, minZ: -32, maxZ: -22, top: 8, ground: 0 };
const LEN = 0.42;

export function createRain() {
  const positions = new Float32Array(COUNT * 2 * 3); // 2 verts per streak
  const speeds = new Float32Array(COUNT);

  const reset = (i, y) => {
    const x = AREA.minX + Math.random() * (AREA.maxX - AREA.minX);
    const z = AREA.minZ + Math.random() * (AREA.maxZ - AREA.minZ);
    const top = y;
    const b = i * 6;
    positions[b] = x; positions[b + 1] = top; positions[b + 2] = z;            // top vert
    positions[b + 3] = x; positions[b + 4] = top - LEN; positions[b + 5] = z;  // bottom vert
    speeds[i] = 9 + Math.random() * 6;
  };
  for (let i = 0; i < COUNT; i++) reset(i, AREA.ground + Math.random() * AREA.top);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x9fc4c0, transparent: true, opacity: 0.28 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'rain';
  lines.frustumCulled = false;

  return {
    object: lines,
    update(dt) {
      for (let i = 0; i < COUNT; i++) {
        const b = i * 6;
        const dy = speeds[i] * dt;
        positions[b + 1] -= dy;
        positions[b + 4] -= dy;
        if (positions[b + 4] < AREA.ground) reset(i, AREA.top + Math.random() * 2);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
