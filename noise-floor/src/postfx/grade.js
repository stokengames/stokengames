import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// One combined post pass: color grade (muted teal shadows / sodium-orange
// highlights, slight desaturate + contrast), proximity vignette, and animated
// film grain. RenderPass → grade → OutputPass (OutputPass does ACES tone-map +
// sRGB, so the grade runs in linear — thresholds are tuned for that).
//
// The vignette uniform is driven by whisper proximity. Its most important moment
// is the charger hold: as the field stacks and closes in, this constricts the
// clear centre inward — the visual echo of the audio.

const GRAIN = 0.028; // film grain amount (halved — fog now carries the atmosphere)

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0 },      // 0..1 proximity (constriction)
    grain: { value: GRAIN },
    darken: { value: 0 },        // 0..1 global darkening (charger hold)
    edgeShadow: { value: new THREE.Vector3(0.5, 0.5, 0) }, // xy = screen pos, z = intensity
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, vignette, grain, darken;
    uniform vec3 edgeShadow;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // --- split-tone grade (linear input; dark scene → mostly teal shadows) ---
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 teal   = vec3(0.16, 0.42, 0.42);
      vec3 sodium = vec3(1.0, 0.60, 0.26);
      vec3 tint = mix(teal, sodium, smoothstep(0.03, 0.5, l));
      c = mix(c, c * tint, 0.4);          // gentle tone split
      c = mix(vec3(l), c, 0.85);          // slight desaturate
      c = (c - 0.04) * 1.06 + 0.04;       // slight contrast, low pivot (dark)

      // --- vignette: mild always-on edge + proximity constriction inward ---
      float r = length(vUv - 0.5) * 1.414;
      float baseVig = smoothstep(0.62, 1.06, r) * 0.5;
      float prox = smoothstep(1.0 - 0.78 * vignette, 1.06, r) * vignette;
      float v = clamp(baseVig + prox, 0.0, 1.0);
      c *= 1.0 - v;

      // --- animated film grain ---
      float g = hash(vUv * resolution + fract(time) * 91.7) * 2.0 - 1.0;
      c += g * grain;

      // --- peripheral shadow: a soft, FORMLESS darkening that only lives in the
      // edges of frame near a drifting point. Never a shape — just a smudge of dark
      // suggestion (driven/vanished from JS). ---
      float em = smoothstep(0.30, 0.58, r);                 // periphery only
      float dd = distance(vUv, edgeShadow.xy);
      float sh = edgeShadow.z * em * (1.0 - smoothstep(0.0, 0.34, dd));
      c *= 1.0 - clamp(sh, 0.0, 1.0) * 0.7;

      // --- global darken (charger hold closing in) ---
      c *= 1.0 - darken;

      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function createGrade(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  const u = gradePass.uniforms;
  const setSize = (w, h) => { composer.setSize(w, h); u.resolution.value.set(w, h); };
  setSize(window.innerWidth, window.innerHeight);

  return {
    setSize,
    setVignette(v) { u.vignette.value = Math.max(0, Math.min(1, v)); },
    setDarken(v) { u.darken.value = Math.max(0, Math.min(1, v)); },
    setEdgeShadow(x, y, intensity) { u.edgeShadow.value.set(x, y, Math.max(0, intensity)); },
    render(dt) { u.time.value += dt; composer.render(); },
  };
}
