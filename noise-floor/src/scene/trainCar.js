import * as THREE from 'three';
import { box } from './box.js';

// Gray-box train car running along X (x -9..9, length 18), with a SIDE door in
// the south long wall (z = -1.5) facing the platform — the side exit reads as the
// natural place to leave. The car is back to full length; the "empty walk" is
// solved by passengers (passengers.js), not by shortening. The south bench is
// split around the door so nothing blocks the threshold. The door is FSM-driven
// (group.userData.door); main.js slides the panel and drops the 'door' collider.
export function build() {
  const g = new THREE.Group();
  g.name = 'trainCar';

  const L = 18, W = 3, H = 2.6, T = 0.2;
  const gapMinX = -1.5, gapMaxX = 1.5;   // 3 m side door in the south wall
  const doorCx = 0, doorW = gapMaxX - gapMinX;

  box(g, { x: 0, y: -T / 2, z: 0, w: L, h: T, d: W, color: 0x3a4444 });
  box(g, { x: 0, y: H + T / 2, z: 0, w: L, h: T, d: W, color: 0x222a2a });

  // North wall solid; south wall split around the door gap.
  box(g, { x: 0, y: H / 2, z: W / 2, w: L, h: H, d: T, color: 0x44504f, solid: true });
  box(g, { x: (-L / 2 + gapMinX) / 2, y: H / 2, z: -W / 2, w: gapMinX - (-L / 2), h: H, d: T, color: 0x44504f, solid: true });
  box(g, { x: (gapMaxX + L / 2) / 2, y: H / 2, z: -W / 2, w: (L / 2) - gapMaxX, h: H, d: T, color: 0x44504f, solid: true });

  // End caps.
  box(g, { x: L / 2, y: H / 2, z: 0, w: T, h: H, d: W, color: 0x3a4848, solid: true });
  box(g, { x: -L / 2, y: H / 2, z: 0, w: T, h: H, d: W, color: 0x3a4848, solid: true });

  // North bench runs the length; south bench is split around the doorway.
  box(g, { x: 0, y: 0.25, z: W / 2 - 0.35, w: L - 1.5, h: 0.5, d: 0.6, color: 0x2c3636, solid: true, tag: 'seat' });
  box(g, { x: (-L / 2 + gapMinX) / 2 - 0.2, y: 0.25, z: -(W / 2 - 0.35), w: gapMinX - (-L / 2) - 1, h: 0.5, d: 0.6, color: 0x2c3636, solid: true, tag: 'seat' });
  box(g, { x: (gapMaxX + L / 2) / 2 + 0.2, y: 0.25, z: -(W / 2 - 0.35), w: (L / 2) - gapMaxX - 1, h: 0.5, d: 0.6, color: 0x2c3636, solid: true, tag: 'seat' });

  // Sliding door panel covering the gap. (The over-door emergency light that
  // marks this exit lives in lights.js, so it only comes on when the platform
  // lights up — i.e. when the door opens.)
  const panel = box(g, {
    x: doorCx, y: H / 2, z: -W / 2, w: doorW, h: H, d: 0.12,
    color: 0x55706c, solid: true, tag: 'door',
  });
  g.userData.door = {
    panel,
    closedX: doorCx,
    openX: doorCx - doorW - 0.3,
    open: false,
    t: 0,
  };

  // Companion civil-defense poster on the south wall right beside the door — the
  // player meets the messaging before they ever reach the platform. Same
  // treatment as the platform companions: small (~A2), dim, un-spotlit, faint
  // emissive doubling as soft glow. `posterReady` lets main await it (no pop-in).
  const POSTER_GLOW = 0.08; // matches the platform companions
  const posterMat = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: POSTER_GLOW, roughness: 0.95, metalness: 0,
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68), posterMat);
  poster.position.set(2.6, 1.4, -W / 2 + T / 2 + 0.02); // beside the door, faces into the car (+z)
  g.add(poster);
  // The poster self-glows, so it must die with the train lights + passenger earcups
  // at BATTERY_DEATH (main toggles this alongside setEarcupGlow) — never lit in the dark.
  g.userData.setPosterGlow = (on) => { posterMat.emissiveIntensity = on ? POSTER_GLOW : 0; };
  g.userData.posterReady = new THREE.TextureLoader().loadAsync('./assets/textures/poster-lit-areas.png')
    .then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      posterMat.map = tex;
      posterMat.emissiveMap = tex;
      posterMat.needsUpdate = true;
    })
    .catch(() => {}); // a missing texture shouldn't block the game

  return g;
}
