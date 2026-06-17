import * as THREE from 'three';
import { addBoxCollider } from '../colliders.js';

// Passenger silhouettes — a person in a bulky coat with headphones, faceless.
// Blocky low-poly forms (not smooth cones) so they read as a body: hips/lap,
// coat torso, real shoulders, arms, head with a headband + lit ear cups. They sit
// in profile facing across the car, so as the player walks the X axis none ever
// face them. The ear-cup glow is the protection of the always-on audio: it dies
// with the battery and returns when the platform door opens (toggled from main).

const MAT = new THREE.MeshStandardMaterial({ color: 0x111f1d, roughness: 0.9, metalness: 0.0 });
const HP_MAT = new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.6, metalness: 0.2 });
const CUP_MAT = new THREE.MeshStandardMaterial({ color: 0x05080a, emissive: 0x5fb0a8, emissiveIntensity: 0.35 });
const CUP_GLOW = 0.35;

// Rounded soft human silhouette — smaller torso, legless, no hood. The headphones
// carry the "listening" read. Origin at the hip (seated vs standing set by group Y).
function makeFigure() {
  const g = new THREE.Group();
  const add = (geo, x, y, z = 0, mat = MAT) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m;
  };

  // Smaller torso + sloped shoulders + arms + neck.
  add(new THREE.CapsuleGeometry(0.16, 0.26, 4, 12), 0, 0.3).scale.set(1, 1, 0.82);  // torso
  add(new THREE.SphereGeometry(0.21, 14, 10), 0, 0.55).scale.set(1, 0.5, 0.85);     // shoulders
  const armL = add(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), -0.2, 0.32); armL.rotation.z = 0.07;
  const armR = add(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), 0.2, 0.32); armR.rotation.z = -0.07;
  add(new THREE.CapsuleGeometry(0.045, 0.04, 3, 8), 0, 0.69);                        // neck

  // Head (rounded) + headphones.
  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), MAT));
  head.add(new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 16, Math.PI), HP_MAT));
  const cupGeo = new THREE.CapsuleGeometry(0.046, 0.028, 3, 10);
  for (const sx of [-0.13, 0.13]) {
    const cup = new THREE.Mesh(cupGeo, CUP_MAT);
    cup.rotation.z = Math.PI / 2; cup.position.x = sx;
    head.add(cup);
  }
  head.position.y = 0.8;
  g.add(head);

  g.userData.head = head;
  g.userData.headBaseY = head.position.y;
  return g;
}

export function createPassengers() {
  const group = new THREE.Group();
  group.name = 'passengers';
  const figures = [];

  const seats = [
    { x: -7.5, z: 1.05, face: -1 }, { x: -4.5, z: 1.05, face: -1 },
    { x: 2.5, z: 1.05, face: -1 }, { x: 5.5, z: 1.05, face: -1 }, { x: 8, z: 1.05, face: -1 },
    { x: -7.5, z: -1.05, face: 1 }, { x: -4, z: -1.05, face: 1 },
    { x: 4.5, z: -1.05, face: 1 }, { x: 7.5, z: -1.05, face: 1 },
  ];
  for (const s of seats) {
    const f = makeFigure();
    f.position.set(s.x, 0.5, s.z);
    f.rotation.y = s.face > 0 ? 0 : Math.PI;
    addFigure(group, figures, f);
  }

  for (const st of [{ x: -2.2, z: 0.85 }, { x: 6.5, z: -0.85 }]) {
    const f = makeFigure();
    f.position.set(st.x, 0.85, st.z);
    f.rotation.y = st.z > 0 ? 0 : Math.PI;
    addFigure(group, figures, f);
    addBoxCollider(st.x, st.z, 0.55, 0.55, 'passenger');
  }

  return {
    group,
    // The audio's protection: off when the battery dies, back when the door opens.
    setEarcupGlow(on) { CUP_MAT.emissiveIntensity = on ? CUP_GLOW : 0; },
    // Static — the passengers just sit (no bob/nod/sway).
    update() {},
  };
}

function addFigure(group, figures, fig) {
  group.add(fig);
  figures.push(fig);
}
