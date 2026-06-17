import * as THREE from 'three';

// Soft volumetric-ish haze: a handful of large, low-opacity sprites drifting
// slowly through the platform and street volumes. Cheap (each is one quad) and
// gives the air an actual fog body, so the atmosphere reads as haze rather than
// the film grain doing that job. Procedural soft texture — no asset.

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// volumes the haze fills (platform + street)
const VOLUMES = [
  { count: 26, minX: -8, maxX: 20, minY: 0.5, maxY: 2.8, minZ: -11, maxZ: -3, scale: 5.5 },
  { count: 15, minX: 10, maxX: 28, minY: 0.5, maxY: 4.5, minZ: -31, maxZ: -23, scale: 6.5 },
];

export function createHaze() {
  const tex = softTexture();
  const group = new THREE.Group();
  group.name = 'haze';
  const puffs = [];

  for (const v of VOLUMES) {
    for (let i = 0; i < v.count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: 0x35514e, transparent: true,
        opacity: 0.07 + Math.random() * 0.06, depthWrite: false, fog: true,
      });
      const s = new THREE.Sprite(mat);
      const sc = v.scale * (0.7 + Math.random() * 0.7);
      s.scale.set(sc, sc, 1);
      s.position.set(
        v.minX + Math.random() * (v.maxX - v.minX),
        v.minY + Math.random() * (v.maxY - v.minY),
        v.minZ + Math.random() * (v.maxZ - v.minZ)
      );
      group.add(s);
      puffs.push({ s, baseX: s.position.x, phase: Math.random() * Math.PI * 2, speed: 0.05 + Math.random() * 0.05 });
    }
  }

  return {
    object: group,
    update(t) {
      for (const p of puffs) p.s.position.x = p.baseX + Math.sin(t * p.speed + p.phase) * 1.2;
    },
  };
}
