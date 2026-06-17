import * as THREE from 'three';

// Platform light rig. Real platform lighting: a row of circular ceiling lamp
// fixtures (disc + dim point light) down the platform — nothing reads as an
// abstract rectangle. Plus the sodium vending beacon, the poster spotlight, a
// faint doorway guide, and a proximity charger glow (resolves on approach, like
// the poster). Everything is dim by design: dark enough to barely see, just
// enough to find the door and the poster. When in doubt, darker.

const LAMP = { intensity: 3.2, distance: 7, decay: 2.0, y: 3.0, discY: 3.22, z: -6.8, color: 0x7db7b0 };
const LAMP_XS = [-6, 0, 6, 12, 18]; // 5 fixtures down the platform
const BEACON = { intensity: 5, distance: 9, decay: 2.0, color: 0xffae54 };

// Over-door / over-stairs emergency exit markers — a dim red-amber fixture that
// self-glows plus a faint local pool. Consistent between the two, well under the
// poster spot / charger glow, off until the platform lights come up.
const EMERGENCY = { color: 0xff5630, intensity: 2.0, distance: 4.5, decay: 2.0, emissive: 1.3 };

function emergencyMarker(group, fx, fy, fz, lx, ly, lz) {
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.12, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x140704, emissive: EMERGENCY.color, emissiveIntensity: EMERGENCY.emissive })
  );
  fixture.position.set(fx, fy, fz);
  const light = new THREE.PointLight(EMERGENCY.color, EMERGENCY.intensity, EMERGENCY.distance, EMERGENCY.decay);
  light.position.set(lx, ly, lz);
  group.add(fixture, light);
}

export function createPlatformLights() {
  const group = new THREE.Group();
  group.name = 'platformLights';

  const discGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16);

  const lamps = [];
  for (const x of LAMP_XS) {
    const light = new THREE.PointLight(LAMP.color, LAMP.intensity, LAMP.distance, LAMP.decay);
    light.position.set(x, LAMP.y, LAMP.z);
    light.userData.base = LAMP.intensity;
    const disc = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({
      color: 0x0a0d0e, emissive: LAMP.color, emissiveIntensity: 1.3,
    }));
    disc.position.set(x, LAMP.discY, LAMP.z);
    light.userData.disc = disc;
    group.add(light, disc);
    lamps.push(light);
  }

  // Vending beacon — sodium, dim. (Its glowing panel is on the machine itself.)
  const beacon = new THREE.PointLight(BEACON.color, BEACON.intensity, BEACON.distance, BEACON.decay);
  beacon.position.set(19, 1.8, -10.8);
  beacon.userData.base = BEACON.intensity;
  group.add(beacon);

  // Poster spotlight — a soft glow at distance that resolves the poster up close.
  const posterSpot = new THREE.SpotLight(0xefe6cc, 6, 9, Math.PI / 8, 0.45, 1.6);
  posterSpot.position.set(8, 3.0, -9.4);
  posterSpot.target.position.set(8, 1.4, -11.8);
  group.add(posterSpot, posterSpot.target);

  // Emergency exit markers (off until the platform lights up): one over the train
  // door, one over the stairwell entrance, at the same dim level — "this way out."
  emergencyMarker(group, 0, 2.5, -1.45, 0, 2.25, -1.7);        // over the car door
  emergencyMarker(group, 18.5, 2.95, -12.0, 18.5, 2.6, -12.5); // over the stairwell entrance

  // Charger: proximity glow (driven by main.js from player distance), exactly
  // like the poster — faint far, resolving near. Starts faint.
  const chargerLight = new THREE.PointLight(0xffa64d, 0.4, 5, 2.0);
  chargerLight.position.set(14, 0.9, -11.2);
  const chargerLamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa64d, emissiveIntensity: 0.15 })
  );
  chargerLamp.position.set(14, 0.5, -11.55);
  group.add(chargerLight, chargerLamp);

  let killIndex = 0;

  return {
    group,
    beacon,
    chargerLight,
    chargerLamp,

    killNext() {
      if (killIndex >= lamps.length) return false;
      flickerOut(lamps[killIndex++]);
      return killIndex < lamps.length;
    },

    allLit() {
      killIndex = 0;
      for (const l of lamps) {
        l.intensity = l.userData.base;
        l.userData.disc.material.emissiveIntensity = 1.3;
      }
      beacon.intensity = beacon.userData.base;
    },

    relight() { this.allLit(); },

    // Soft glow far, resolves near — f in 0..1 from main (player proximity).
    setChargerProximity(f) {
      chargerLight.intensity = 0.4 + 5.0 * f;
      chargerLamp.material.emissiveIntensity = 0.15 + 1.6 * f;
    },
  };
}

// A dying fluorescent: erratic stutter, then dark. The disc goes cold too.
function flickerOut(light) {
  const base = light.userData.base;
  const disc = light.userData.disc;
  const steps = [0.0, base * 1.1, 0.0, 0.0, base * 0.7, 0.0, base * 0.3, 0.0, base * 0.12, 0.0];
  steps.forEach((v, i) => setTimeout(() => {
    light.intensity = v;
    disc.material.emissiveIntensity = v > 0 ? 1.5 : 0.03;
  }, i * 60 + Math.random() * 30));
}
