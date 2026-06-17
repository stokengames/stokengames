import * as THREE from 'three';
import { box } from './box.js';

// Gray-box platform, placed to the south of the train so the player walks out the
// car door (−z) onto it. Back wall at z=-12 with an exit gap near the far end
// leading to the stairwell. Returns the group plus marker positions so main.js
// can register interactables (poster, charger) and place the vending beacon.
export function build() {
  const minX = -10, maxX = 22;
  const nearZ = -1.6, backZ = -12;
  const H = 3.2, T = 0.3;
  const cx = (minX + maxX) / 2;
  const cz = (nearZ + backZ) / 2;
  const len = maxX - minX;
  const wid = nearZ - backZ;

  // Exit gap in the back wall (to the stairwell).
  const exitMinX = 16, exitMaxX = 21;

  const g = new THREE.Group();
  g.name = 'platform';

  box(g, { x: cx, y: -T / 2, z: cz, w: len, h: T, d: wid, color: 0x33403f });

  // Ceiling — so the fluorescent tubes read as mounted fixtures, not rectangles
  // hanging in the void. Dark; the fog hides its extent. Non-solid (out of reach).
  box(g, { x: cx, y: H + T / 2, z: cz, w: len, h: T, d: wid, color: 0x1a2120 });

  // Back wall, split around the exit gap.
  box(g, { x: (minX + exitMinX) / 2, y: H / 2, z: backZ, w: exitMinX - minX, h: H, d: T, color: 0x3a4747, solid: true });
  box(g, { x: (exitMaxX + maxX) / 2, y: H / 2, z: backZ, w: maxX - exitMaxX, h: H, d: T, color: 0x3a4747, solid: true });

  // Side walls.
  box(g, { x: minX, y: H / 2, z: cz, w: T, h: H, d: wid, color: 0x344040, solid: true });
  box(g, { x: maxX, y: H / 2, z: cz, w: T, h: H, d: wid, color: 0x344040, solid: true });

  // North edge (train side): a low platform-edge barrier with a gap at the car
  // side doorway (x -1.5..1.5), so the only way onto the platform is through the car.
  box(g, { x: (minX - 1.5) / 2, y: 0.6, z: nearZ, w: -1.5 - minX, h: 1.2, d: T, color: 0x2a3434, solid: true });
  box(g, { x: (1.5 + maxX) / 2, y: 0.6, z: nearZ, w: maxX - 1.5, h: 1.2, d: T, color: 0x2a3434, solid: true });

  // Columns down the platform.
  for (let x = minX + 5; x < maxX - 3; x += 7) {
    box(g, { x, y: H / 2, z: cz, w: 0.6, h: H, d: 0.6, color: 0x2c3838, solid: true, tag: 'column' });
  }

  // Vending machine — the navigable safety beacon (point light in lights.js). A
  // glowing front panel makes the glow read as coming FROM the machine, not an
  // abstract sodium rectangle floating in the dark.
  box(g, { x: 19, y: 1, z: backZ + 0.8, w: 1.2, h: 2, d: 0.8, color: 0x1d5a55, solid: true, tag: 'vending' });
  const vendPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb15a, emissiveIntensity: 0.4 })
  );
  vendPanel.position.set(19, 1.1, backZ + 1.21);
  g.add(vendPanel);

  // Poster on the back wall (Beat 4), on the path between the car door (~x 0) and
  // the charger (x 14); the lights.js spotlight draws the eye. A dark frame box
  // backs a textured plane carrying poster.png — aged into the scene by the
  // spotlight + fog + grain, not pre-distressed. A faint emissive map keeps it
  // legible at interaction distance even in the low light.
  box(g, { x: 8, y: 1.6, z: backZ + 0.16, w: 1.3, h: 1.72, d: 0.06, color: 0x161a18, tag: 'poster' });
  const posterMat = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.92, metalness: 0,
  });
  const posterFace = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.54), posterMat);
  posterFace.position.set(8, 1.6, backZ + 0.21);
  g.add(posterFace);
  // Async texture loads; `posterReady` lets the loading screen wait for all of
  // them (no pop-in). Each load applies the map + a faint emissive so the poster
  // self-reads in the dark.
  const loader = new THREE.TextureLoader();
  const posterLoads = [];
  const loadPoster = (url, mat) => {
    posterLoads.push(loader.loadAsync(url).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      mat.map = tex; mat.emissiveMap = tex; mat.needsUpdate = true;
    }).catch(() => {})); // a missing texture shouldn't block the game
  };
  loadPoster('./assets/textures/poster.png', posterMat);

  // Companion civil-defense posters — believable A2-ish size (~0.5×0.68 m) at eye
  // level, dim/un-spotlit, no frame, each with a faint emissive that doubles as
  // soft wall glow. Scattered across walls + heights like a real station's pasted
  // notices, NOT a row. (poster-lit-areas lives on the train car, by the door, so
  // the player meets civil-defense messaging before reaching the platform.)
  const PW = 0.5, PH = 0.68;
  const companion = (url, x, y, z, rotY, emissive) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: emissive, roughness: 0.95, metalness: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY; // 0 = back wall (+z); +π/2 = west wall (+x); −π/2 = east wall (−x)
    g.add(mesh);
    loadPoster(url, mat);
  };
  const wallZ = backZ + 0.21;          // just off the back wall, faces the player
  const westX = minX + T / 2 + 0.06;   // just off the west side wall
  const eastX = maxX - T / 2 - 0.06;   // just off the east side wall
  // The two by the charger flank it at different heights (not level) so the dwell
  // spot has both the nudge and the lore in view while the player holds still.
  companion('./assets/textures/poster-report-silence.png', 12, 1.68, wallZ, 0, 0.07);            // by charger — text-heavy lore, high
  companion('./assets/textures/poster-battery.png', 15.7, 1.45, wallZ, 0, 0.085);                // by charger — the load-bearing nudge, low
  companion('./assets/textures/poster-sound-safety.png', westX, 1.55, -4.5, Math.PI / 2, 0.075); // west wall, near the entrance
  companion('./assets/textures/poster-quiet-remembers.png', eastX, 1.8, -6.5, -Math.PI / 2, 0.04); // east wall, oldest/dimmest, hung high

  const posterReady = Promise.all(posterLoads);

  // Charger outlet near the exit stairs (Beat 5).
  box(g, { x: 14, y: 0.5, z: backZ + 0.3, w: 0.4, h: 0.4, d: 0.3, color: 0x7a6a2a, tag: 'charger' });

  const markers = {
    poster: new THREE.Vector3(8, 1.4, backZ + 0.9),
    charger: new THREE.Vector3(14, 1.0, backZ + 1.0),
    vending: new THREE.Vector3(19, 1.2, backZ + 1.2),
    exitZ: backZ,          // crossing south of this enters the stairwell
    exitX: (exitMinX + exitMaxX) / 2,
  };
  return { group: g, markers, posterReady };
}
