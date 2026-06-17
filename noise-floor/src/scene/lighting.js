import * as THREE from 'three';

// Global ambient + train fluorescents. The platform's section rig lives in
// lights.js; the street streetlight in street.js. Bias is hard toward dark: the
// ambient is a tiny teal fill, deliberately low, and on the platform it drops to
// near-nothing so the dead sections after blackout read as genuine black (the
// void is the scare there) — point lights do all the real work. All values are
// tunable; when in doubt, push them down.
const AMBIENT = {
  train: 0.035,
  platform: 0.005,  // ~black; blacked-out sections should be true void
  street: 0.018,
};

const TRAIN_BASE = 7; // fluorescent intensity (physical decay), tune for darkness

export function createLighting() {
  const group = new THREE.Group();
  group.name = 'lighting';

  const ambient = new THREE.AmbientLight(0x14302d, AMBIENT.train);
  group.add(ambient);

  // Train ceiling fluorescents — cool, faintly teal, silhouetting the passengers.
  const trainLights = [];
  for (const x of [-6, -1, 4]) {
    const l = new THREE.PointLight(0xbfeede, TRAIN_BASE, 11, 2.0);
    l.position.set(x, 2.45, 0);
    group.add(l);
    trainLights.push(l);
  }

  return {
    group,
    AMBIENT,
    setAmbient(v) { ambient.intensity = v; },
    // scale 0 also hides them so they drop out of the forward-render light loop.
    setTrainLights(scale) {
      for (const l of trainLights) { l.intensity = TRAIN_BASE * scale; l.visible = scale > 0; }
    },
  };
}
