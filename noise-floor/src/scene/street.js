import * as THREE from 'three';
import { box } from './box.js';

// Street slice (Beat 6 end): wet road, building facades, the rain reading
// visually (rain.js), and a row of 5 circular streetlamps lining the street —
// each a globe on a pole casting a sodium pool on the wet road. The road is a
// glossy dark material so the lamps smear across it as a wet sheen (cheap fake —
// no planar reflector, to hold 60fps).
export function build() {
  const g = new THREE.Group();
  g.name = 'street';

  const minX = 8, maxX = 30, nearZ = -22, farZ = -32, T = 0.3;
  const cx = (minX + maxX) / 2, cz = (nearZ + farZ) / 2, wid = nearZ - farZ;

  // Wet road — low roughness + some metalness so the lamps reflect as a sheen.
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(maxX - minX, T, wid),
    new THREE.MeshStandardMaterial({ color: 0x0b1012, roughness: 0.22, metalness: 0.55 })
  );
  road.position.set(cx, -T / 2, cz);
  g.add(road);

  // Building facades boxing the slice in (box() keeps their colliders).
  box(g, { x: minX, y: 3.5, z: cz, w: 0.4, h: 7, d: wid, color: 0x12181a, solid: true });
  box(g, { x: maxX, y: 3.5, z: cz, w: 0.4, h: 7, d: wid, color: 0x12181a, solid: true });
  box(g, { x: cx, y: 3.5, z: farZ, w: maxX - minX, h: 7, d: 0.4, color: 0x12181a, solid: true });

  // 5 circular streetlamps spaced evenly across the street, lining the road. Each
  // is a glowing globe on a pole with a sodium point light pooling on the road.
  // The point lights default off (region-gated) — only lit once in the street, so
  // they don't add to the light count during the heavier platform/charger moment.
  const globeGeo = new THREE.SphereGeometry(0.2, 12, 8);
  const lampZ = -30.5, poleH = 5;
  const lights = [];
  for (const x of [11, 15.5, 20, 24.5, 29]) {
    box(g, { x, y: poleH / 2, z: lampZ, w: 0.16, h: poleH, d: 0.16, color: 0x2a2824, solid: true });
    const globe = new THREE.Mesh(globeGeo, new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffb155, emissiveIntensity: 3,
    }));
    globe.position.set(x, poleH - 0.2, lampZ);
    g.add(globe);
    const light = new THREE.PointLight(0xffa64d, 14, 15, 2.0);
    light.position.set(x, poleH - 0.2, lampZ);
    light.visible = false;
    g.add(light);
    lights.push(light);
  }

  return { group: g, endZ: -29, lights }; // crossing south of endZ → title card
}
