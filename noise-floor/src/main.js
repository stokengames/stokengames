import * as THREE from 'three';
import { Player } from './player.js';
import { resolve, addBoxCollider, removeByTag, nearestWallDistance } from './colliders.js';
import { StateMachine, STATES } from './game/state.js';
import { Interactions } from './game/interactions.js';
import * as ui from './ui.js';
import { AudioEngine } from './audio/engine.js';
import { speakSynthesis, toggleSynthesis, synthesisEnabled } from './audio/name.js';
import { railPath } from './rails-path.js';
import { RailsController } from './rails.js';
import { RailsRecorder } from './rails-recorder.js';
import { build as buildTrain } from './scene/trainCar.js';
import { build as buildPlatform } from './scene/platform.js';
import { build as buildStairwell } from './scene/stairwell.js';
import { build as buildStreet } from './scene/street.js';
import { createPlatformLights } from './scene/lights.js';
import { createPassengers } from './scene/passengers.js';
import { createLighting } from './scene/lighting.js';
import { createRain } from './scene/rain.js';
import { createHaze } from './scene/haze.js';
import { createGrade } from './postfx/grade.js';

// Desktop-only per the GDD: gate touch / tiny-screen devices with an on-brand
// block screen rather than dropping them into broken controls. The render loop is
// skipped when blocked (see the foot of this file).
const blocked = ui.isTouchBlocked();
if (blocked) ui.showMobileBlock();

// Debug features (HUD, 1–9 state jumps, dev hotkeys) only behind ?debug — never in
// the playable build, where a stray keypress broke a player's run.
let DEBUG = false;
try { DEBUG = new URLSearchParams(location.search).has('debug'); } catch (_) {}
if (!DEBUG) ui.hideDebug();

// ?record captures a free-movement playthrough as the On Rails path (rails-recorder.js).
let RECORD = false;
try { RECORD = new URLSearchParams(location.search).has('record'); } catch (_) {}

// --- Renderer / scene / camera -------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Fog throughout; density retuned per location (denser on the platform). Background
// matches the fog so it reads seamless. Dark teal — darkness does the heavy lifting.
const FOG = { color: 0x081210, train: 0.06, death: 0.10, platform: 0.13, street: 0.075 };
scene.background = new THREE.Color(FOG.color);
scene.fog = new THREE.FogExp2(FOG.color, FOG.train);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);

// Real lighting (sparse points + tiny teal ambient) — no dev fill.
const lighting = createLighting();
scene.add(lighting.group);
const setMood = (ambient, fogDensity) => { lighting.setAmbient(ambient); scene.fog.density = fogDensity; };

// --- World ---------------------------------------------------------------------

const trainGroup = buildTrain();
const platform = buildPlatform();
const stairGroup = buildStairwell();
const street = buildStreet();
const lights = createPlatformLights();
const passengers = createPassengers();
const rain = createRain();
const haze = createHaze();
scene.add(trainGroup, platform.group, stairGroup, street.group, lights.group, passengers.group, rain.object, haze.object);

const grade = createGrade(renderer, scene, camera); // post stack: grade + vignette + grain

const markers = platform.markers;
const streetEndZ = street.endZ;

// Region light-gating (perf): only light the area in play. lights.group is the
// platform rig; street lamps and train lights toggle by region. Hidden lights
// drop out of the forward-render light loop entirely — a visual no-op off-region.
const setPlatformLights = (on) => { lights.group.visible = on; };
const setStreetLights = (on) => street.lights.forEach((l) => { l.visible = on; });
setPlatformLights(false); // off until the doors open onto the platform

// Player-follow lights (navigation aids):
//  - proxLight: a faint teal glow that comes up only when close to a wall/corner
//    on the dark platform, so the player can feel an edge without lighting the room.
//  - phoneLight: a small soft warm pool once the phone has power (post-charge),
//    the light of safety returning — eases getting out after charging.
const proxLight = new THREE.PointLight(0x9fb6b2, 0, 3.0, 2.0);
proxLight.visible = false;
const phoneLight = new THREE.PointLight(0xffe2b0, 0, 5.5, 2.0);
phoneLight.visible = false;
scene.add(proxLight, phoneLight);
let phoneOn = false;
const PROX_RANGE = 1.8, PROX_MAX = 3.2, PHONE_MAX = 4.0;

const player = new Player(camera);
const interactions = new Interactions();
interactions.add('poster', markers.poster, 2.3, { type: 'press', prompt: 'Spacebar — read', onInteract: openPoster });
interactions.add('charger', markers.charger, 2.3, { type: 'hold', prompt: 'Hold Spacebar — charge' });

// --- On Rails (accessibility) --------------------------------------------------
// A title-screen toggle: the camera auto-walks the recorded canonical path while
// the player only looks (mouse or IJKL). Purely additive — free movement is the
// default and its code path is untouched. The controller is a position source +
// two hooks; every FSM transition still belongs to the FSM. Hidden until a path
// has been recorded (rails-path.js empty → rails null → toggle hidden).
let onRails = false;
let chargerNudgeT = 0; // on rails: seconds parked at the charger before the "hold Spacebar" nudge
const recorder = RECORD ? new RailsRecorder() : null;
const rails = railPath.length
  ? new RailsController(railPath, player, {
      isFrozen: () => frozen,
      isClimbing: () => climbing,
      getState: () => machine.state,
      firePoster: () => openPoster(), // same call as a press; posterSeen-guarded
    })
  : null;
ui.setRailsAvailable(!!rails);

// --- Audio ---------------------------------------------------------------------

const engine = new AudioEngine();
let audioReady = false;
let loadReport = null;

// --- Tunables ------------------------------------------------------------------

const START_BATTERY = 23;
const DRAIN_SECONDS = 30; // train beat is exactly this long (23% → 0%)
const DRAIN_PER_SEC = START_BATTERY / DRAIN_SECONDS;

const DEATH = { STUTTER: 2.6, SILENCE: 3.0, WHISPER_FADE: 3.0, NAME_DELAY: 3.8 };
const DOOR_AFTER_NAME = 5.0;   // beat lands, field returns, then the doors part
const DOOR_TO_PLATFORM = 1.8;  // pneumatic + widen, then control passes to the platform

const LIGHT_KILL_INTERVAL = 2.2;
const CHARGE_TARGET = 31;
const CHARGE_SECONDS = 12; // hold; escalation reaches all 13 voices by the slam
const CHARGE_RATE = CHARGE_TARGET / CHARGE_SECONDS;
const FALSE_RELIEF_SECS = 5;
const LINE_GRACE = 4;         // let the final line breathe before the title card
const TITLE_HOLD = 4.5;
const TITLE_SONG_POS = 58;   // title card: 5s of nothing after the line (0:53), then it appears
const CREDITS_SONG_POS = 61; // credits begin 3s after the title; crawl runs ~0:61 → song end (~0:85)
const HELLO_SONG_POS = 80;  // song-time for the credits whisper (short edit ~85s → ~5s before end)
const STREET_SPAWN = { x: 18, z: -23.5, yaw: 0 }; // where the player emerges after the climb

const CREDITS_LINES = [
  'NOISE FLOOR', '',
  'A Stoken Games experiment', '', '',
  'Voices', 'Brandon · Eli · Anna · Josh · Mal · Isaac · Luke', '', '',
  '“Don’t Go Quiet”', 'by The Noise', '', '',
  'Built with Three.js + Web Audio', '', '',
  'Headphones. Always.', '', '', '',
  'Thank you for listening.',
];

// --- Mutable beat state --------------------------------------------------------

let posterSeen = false;
let postContact = false;
let charge = 0;
let platformEntered = false;
let exitBlocked = false;
let lightsDying = false;
let lightKillTimer = 0;
let endingLineFired = false;
let endingTitleShown = false;
let endingClock = 0;
let lineFiredClock = -1;
let climbing = false;
let emergedStreet = false;
let helloFired = false;
let announcerBackup = false; // false = take A, true = take B (P toggles)
let lastNameMode = '—';
let deathStage = null;
let idleTime = 0;            // for the idle control hint
let hintDismissed = false;   // once the player moves, the hint never returns
let frozen = false;          // movement freeze for the final-line contact
let edgeTimer = 2;           // peripheral-shadow pacing
let edgePulse = null;        // active formless shadow { x, y, age, dur, peak }
let edgeLastYaw = 0;
const lastPos = new THREE.Vector3();
const HINT_STATES = new Set(['TRAIN_SAFE', 'PLATFORM', 'POSTER']);
const CHARGE_MAX_DARKEN = 0.82; // how dark the charge hold bottoms out before the slam

// --- Name moment ---------------------------------------------------------------

function triggerName() {
  const word = (machine.playerName || '').trim() || 'you';
  if (synthesisEnabled()) {
    lastNameMode = 'synthesis(dev)';
    ui.showCaption(word, { kind: 'whisper', hold: 5 });
    speakSynthesis(word);
  } else {
    lastNameMode = 'procedural';
    engine.whispers.speakName(camera, word, () => ui.showCaption(word, { kind: 'whisper', hold: 5 }));
  }
}

// --- Beat helpers --------------------------------------------------------------

const trainSpawn = () => player.teleport(-7, 0, -Math.PI / 2); // west end, looking down the car (+X); side door mid-car

function openTrainDoors() {
  const d = trainGroup.userData.door;
  if (d.open) return;
  d.open = true;
  removeByTag('door');
  passengers.setEarcupGlow(true); // the glow returns when the door opens
  trainGroup.userData.setPosterGlow(true); // the door-side poster lights back with them
  setPlatformLights(true);        // platform glow becomes visible through the doorway
  if (audioReady) engine.world.doorOpen();
}

function resetForTrain() {
  posterSeen = false; charge = 0; postContact = false;
  platformEntered = false; lightsDying = false; lightKillTimer = 0;
  endingLineFired = false; endingTitleShown = false; lineFiredClock = -1; climbing = false; emergedStreet = false; helloFired = false;
  idleTime = 0; hintDismissed = false; frozen = false; ui.hideControlHint();
  if (audioReady) { grade.setDarken(0); grade.setEdgeShadow(0.5, 0.5, 0); }
  setMood(lighting.AMBIENT.train, FOG.train);
  lighting.setTrainLights(1); // car lit and safe
  setPlatformLights(false); setStreetLights(false); // only the train is lit now
  phoneOn = false; phoneLight.visible = false; proxLight.visible = false;
  passengers.setEarcupGlow(true);
  trainGroup.userData.setPosterGlow(true); // lit and safe with the rest of the car
  lights.allLit();
  ui.hidePrompt(); grade.setVignette(0); ui.hideTitleCard(); ui.hideCredits(); ui.clearCaption();
  ui.fadeClear();
  interactions.setEnabled('poster', true);
  interactions.setEnabled('charger', true);
  if (exitBlocked) { removeByTag('exitblock'); exitBlocked = false; }

  // Re-close the door for a clean replay.
  const d = trainGroup.userData.door;
  if (d.open) {
    d.open = false; d.t = 0; d.panel.position.x = d.closedX;
    addBoxCollider(d.closedX, -1.5, 3, 0.12, 'door');
  }
  if (audioReady) {
    engine.whispers.clear();
    engine.whispers.setApproach(false);
    engine.whispers.setCouplingFloor(0);
    engine.world.setRumble(0.25, 0.6); // low rattle under the music
    engine.world.setRain(0, 0.5);      // silence any rain on replay (no-op if none)
    engine.world.startLeak(engine.buf.instr);
  }
}

function openPoster() {
  if (posterSeen) return;
  posterSeen = true;
  interactions.setEnabled('poster', false);
  machine.set('POSTER');
  const dur = audioReady ? engine.playAnnouncer(announcerBackup) : 3;
  ui.showCaption('Keep your audio playing at all times.', { kind: 'whisper', hold: Math.max(5, dur) });
  setTimeout(() => { if (machine.state === 'POSTER') machine.set('PLATFORM'); }, (dur + 0.6) * 1000);
}

// Lights, vignette, prompt, whisper proximity — shared across the platform beats.
function platformTick(dt) {
  if (lightsDying) {
    lightKillTimer += dt;
    if (lightKillTimer >= LIGHT_KILL_INTERVAL) {
      lightKillTimer = 0;
      if (!lights.killNext()) lightsDying = false;
    }
  }

  const cur = interactions.update(player.pos);
  if (cur) {
    ui.showPrompt(cur.tag === 'charger' ? `Hold Spacebar — charging ${Math.floor(charge)}%` : cur.prompt);
  } else {
    ui.hidePrompt();
  }

  // Vignette tied to the nearest whisper.
  const n = engine.whispers.nearest;
  const vig = isFinite(n) ? Math.max(0, Math.min(1, (6 - n) / (6 - 1.2))) * 0.85 : 0;
  grade.setVignette(vig);
}

function handleCharger(dt) {
  const cur = interactions.current;
  const near = cur && cur.tag === 'charger';
  const holding = player.keys.has('Space');
  if (near && holding && charge < CHARGE_TARGET) {
    if (machine.state !== 'CHARGER') machine.set('CHARGER');
    charge = Math.min(CHARGE_TARGET, charge + CHARGE_RATE * dt);
    ui.setBattery(charge);
    if (audioReady) engine.whispers.escalate(camera, dt, charge / CHARGE_TARGET); // gather across the hold; peaks at the slam
    // The dark closes in with the voices, bottoming out as the charge fills...
    grade.setDarken((charge / CHARGE_TARGET) * CHARGE_MAX_DARKEN);
    // ...then the slam (FALSE_RELIEF enter) resets darken to 0 — full vision returns.
    if (charge >= CHARGE_TARGET) machine.set('FALSE_RELIEF');
  } else if (machine.state === 'CHARGER') {
    machine.set('PLATFORM');
  }
}

// Scripted climb: walk into the stair vestibule → fade → handled rise → emerge in
// the street. No real stair-climbing (honors no-new-mechanics) and it gives us
// control of the ending's timing without re-editing the master.
function startClimb() {
  if (climbing || emergedStreet) return;
  climbing = true;
  player.setEnabled(false);          // freeze input during the cut
  ui.fadeOut(1800);
  // Street rain (stereo, looping) rises as we surface, and plays through the street.
  if (audioReady) { engine.world.startRain(engine.buf.rain); engine.world.setRain(0.6, 2.0); }
  setTimeout(() => {
    player.teleport(STREET_SPAWN.x, STREET_SPAWN.z, STREET_SPAWN.yaw);
    setMood(lighting.AMBIENT.street, FOG.street); // street: lighter fog, sodium cuts through
    setPlatformLights(false); setStreetLights(true); // platform is behind us now
    ui.fadeIn(1800);
    setTimeout(() => {
      if (document.pointerLockElement === canvas) player.setEnabled(true);
      climbing = false;
      emergedStreet = true;
    }, 1900);
  }, 2000);
}

function endingTick(dt) {
  endingClock += dt;

  // Everything in the tail is on the SONG CLOCK so it's identical every run and
  // the credits finish exactly as the song ends — independent of how the player
  // paced the walk/climb.
  if (audioReady) {
    const pos = engine.music.position();
    // Final line on the literal bridge.
    if (!endingLineFired && pos >= engine.cues.bridge) {
      endingLineFired = true;
      engine.playFinalLine();
      ui.showCaption("It doesn't work once you've heard us.", { kind: 'whisper', hold: 4 }); // clears before the title at 0:58
      ui.fadeOut(1800); // fade the lit street to black — the 5s of nothing before the title
      frozen = true;    // the contact roots the player in place
    }
    // Title card, then credits — both anchored to song position.
    if (!endingTitleShown && pos >= TITLE_SONG_POS) {
      endingTitleShown = true;
      ui.showTitleCard();
    }
    if (pos >= CREDITS_SONG_POS) { machine.set('CREDITS'); return; }
  }

  if (climbing) return;
  if (audioReady && player.pos.z < -22) engine.world.setRain(0.55); // rain swells in the open
  // Crossing into the stair vestibule triggers the climb.
  if (!emergedStreet && player.pos.z < -12.5) startClimb();
}

// --- State machine -------------------------------------------------------------

const machine = new StateMachine();
machine.battery = START_BATTERY;

machine.on('TRAIN_SAFE', {
  enter(m) {
    m.battery = START_BATTERY;
    trainSpawn();
    resetForTrain();
    if (onRails && rails) rails.reset(); // restart the rail for a clean (re)play
    if (recorder) recorder.start();      // ?record: begin capturing this run
    if (audioReady) engine.startMusic(0);
  },
  update(dt, m) {
    m.battery = Math.max(0, m.battery - DRAIN_PER_SEC * dt);
    ui.setBattery(m.battery);
    if (m.battery <= 0) m.set('BATTERY_DEATH');
  },
});

machine.on('BATTERY_DEATH', {
  enter() {
    deathStage = { whispers: false, name: false, nameAt: 0, doorsOpened: false, doorsAt: 0, toPlatform: false };
    ui.clearCaption();
    lighting.setTrainLights(0);              // the world dims as the music dies
    passengers.setEarcupGlow(false);         // protection gone — earcups go dark
    trainGroup.userData.setPosterGlow(false); // the door-side poster goes dark too
    setMood(0.012, FOG.death);
    if (audioReady) {
      engine.music.stutterOut(DEATH.STUTTER);
      engine.world.stopLeak();
      engine.world.setRumble(0.7, 0.5); // mix collapses to rumble (no hiss)
    }
  },
  update(dt, m) {
    if (!audioReady) return;
    const whisperAt = DEATH.STUTTER + DEATH.SILENCE;

    if (!deathStage.whispers && m.elapsed >= whisperAt) {
      deathStage.whispers = true;
      engine.whispers.spawnBehind(camera); // ~5-voice base layer
      engine.whispers.fadeIn(DEATH.WHISPER_FADE); // up to the audible base level
      ui.showCaption('…whispering, close behind…', { kind: 'env', hold: 6 });
    }
    if (!deathStage.name && m.elapsed >= whisperAt + DEATH.NAME_DELAY) {
      deathStage.name = true;
      deathStage.nameAt = m.elapsed;
      postContact = true;
      triggerName();
    }
    // After the name lands and the field returns, the doors part (Beat 3 handoff).
    if (deathStage.name && !deathStage.doorsOpened && m.elapsed >= deathStage.nameAt + DOOR_AFTER_NAME) {
      deathStage.doorsOpened = true;
      deathStage.doorsAt = m.elapsed;
      openTrainDoors();
      // Field stays at the audible base — no drop after the train.
    }
    if (deathStage.doorsOpened && !deathStage.toPlatform && m.elapsed >= deathStage.doorsAt + DOOR_TO_PLATFORM) {
      deathStage.toPlatform = true;
      m.set('PLATFORM'); // no teleport — the player walks out themselves
    }
  },
});

machine.on('PLATFORM', {
  enter() {
    setMood(lighting.AMBIENT.platform, FOG.platform); // near-black; dead sections = void
    lighting.setTrainLights(0);
    setPlatformLights(true); // covers debug jumps straight to the platform
    if (!trainGroup.userData.door.open) openTrainDoors(); // covers debug jumps
    if (audioReady) {
      engine.world.setRumble(0, 1.0); // no sustained bed on the platform
      if (engine.whispers.voices.length === 0) { engine.whispers.spawnBehind(camera); engine.whispers.fadeIn(1.0); }
      engine.whispers.setApproach(true);
    }
    if (!platformEntered) {
      platformEntered = true;
      lights.allLit(); lightsDying = true; lightKillTimer = 0;
      interactions.setEnabled('poster', !posterSeen);
      interactions.setEnabled('charger', true);
      if (!exitBlocked) { addBoxCollider(markers.exitX, markers.exitZ, 6, 0.6, 'exitblock'); exitBlocked = true; }
    }
  },
  update(dt) { platformTick(dt); handleCharger(dt); },
});

machine.on('POSTER', { update(dt) { platformTick(dt); } });

machine.on('CHARGER', { update(dt) { platformTick(dt); handleCharger(dt); } });

machine.on('FALSE_RELIEF', {
  enter() {
    if (audioReady) {
      engine.startMusic(engine.cues.chorus, false, true); // slam back at the chorus, on the short edit
      engine.whispers.setApproach(false);
      engine.whispers.setCouplingFloor(0.18);   // rule 3: they persist, quieter
      engine.world.setRumble(0, 0.8);           // keep the platform/ending free of any bed
    }
    lights.relight(); lightsDying = false;
    setMood(0.013, FOG.death);                   // warmth returns (sections relit)
    grade.setDarken(0);                           // the dark lifts fully at the slam
    edgeTimer = 3.5; edgePulse = null;            // first post-charge peripheral shadow ~3.5s later
    phoneOn = true;                               // phone has power → the soft player light returns
    interactions.setEnabled('charger', false);
    ui.hidePrompt();
    if (exitBlocked) { removeByTag('exitblock'); exitBlocked = false; }
    ui.setBattery(CHARGE_TARGET);
  },
  update(dt, m) { platformTick(dt); if (m.elapsed >= FALSE_RELIEF_SECS) m.set('ENDING'); },
});

machine.on('ENDING', {
  enter() {
    endingLineFired = false; endingTitleShown = false; lineFiredClock = -1;
    endingClock = 0; climbing = false; emergedStreet = false;
    // Rain is street-only — it comes in during the climb, not here on the platform.
  },
  update(dt) { platformTick(dt); endingTick(dt); },
});

machine.on('CREDITS', {
  enter() {
    ui.hideTitleCard(); grade.setVignette(0); ui.hidePrompt(); ui.clearCaption();
    if (audioReady) engine.whispers.clear();
    if (recorder) recorder.finish(); // ?record: serialize + download rails-path.js

    // The ending song keeps playing straight into the credits — no track switch,
    // so the handoff is seamless (it's the same continuous playback). Fit the
    // crawl to whatever song time is left (a little faster is fine).
    const remaining = audioReady && engine.music ? engine.music.remaining() : 45;
    const crawl = isFinite(remaining) ? Math.max(20, remaining) : 45;
    ui.showCredits(CREDITS_LINES, crawl);

    // Instrumental ONLY as a fallback, and only if the song actually runs out
    // before the crawl finishes.
    if (audioReady && isFinite(remaining) && crawl > remaining + 0.5) {
      setTimeout(() => { if (machine.state === 'CREDITS') engine.startCreditsBed(); }, remaining * 1000);
    }

    helloFired = false; // fired from update() at a FIXED song position (HELLO_SONG_POS)
  },
  // Anchor "hello" to song position, not the crawl, so it's identical every run:
  // ~5s before the short edit ends, right as the song is finishing.
  update() {
    if (helloFired || !audioReady || !engine.music) return;
    if (engine.music.position() >= HELLO_SONG_POS) {
      helloFired = true;
      engine.playCreditsWhisper();
      ui.showCaption('hello', { kind: 'whisper', hold: 4 });
    }
  },
});

// --- Pointer lock --------------------------------------------------------------

const canvas = renderer.domElement;
const lock = () => canvas.requestPointerLock();

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  player.setEnabled(locked);
  if (!locked && machine.state !== 'TITLE' && machine.state !== null) ui.showResume();
  else ui.hideResume();
});

// Exiting fullscreen mid-game (Esc / browser UI) also drops pointer lock in most
// browsers, which left input stuck. Treat it exactly like a pointer-lock release:
// drop the lock if still held and show the resume overlay; resuming re-enters
// fullscreen + lock so E and movement work again cleanly.
document.addEventListener('fullscreenchange', () => {
  const inGame = audioReady && machine.state !== 'TITLE' && machine.state !== null;
  if (!document.fullscreenElement && inGame) {
    if (document.pointerLockElement) document.exitPointerLock();
    ui.showResume();
  }
});

ui.onResume(() => { ui.requestFullscreen(); lock(); });

ui.onStart(async (name) => {
  machine.playerName = name;
  ui.showLoading();
  engine.init();
  await engine.resume();
  loadReport = await engine.loadAssets(); // real audio; procedural fallback on misses
  await Promise.all([platform.posterReady, trainGroup.userData.posterReady]); // poster textures decoded — no pop-in
  engine.startWorld();
  audioReady = true;
  ui.hideLoading();
  onRails = !!rails && ui.isOnRails() && !RECORD; // recording is always done in free movement
  player.railMode = onRails;
  machine.set('TRAIN_SAFE');
  lock();
});

// --- Hotkeys -------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (!audioReady) return;

  // Spacebar is the interact key — bigger, findable by feel in the dark. (Movement
  // lives in player.js.) No preventDefault needed — the page is overflow:hidden.
  if (e.code === 'Space') {
    if (interactions.current && interactions.current.type === 'press') interactions.trigger();
    return;
  }

  if (onRails) return; // state jumps / dev keys would desync the rail clock — off on rails
  if (!DEBUG) return;  // state jumps + dev hotkeys are debug-only, off in normal play

  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= STATES.length) { machine.set(STATES[n - 1]); return; }
  switch (e.code) {
    case 'KeyB':
      if (machine.state === 'TRAIN_SAFE') machine.battery = Math.min(machine.battery, 0.5);
      break;
    case 'KeyN': triggerName(); break;
    case 'KeyM': toggleSynthesis(); break;
    case 'KeyP':
      announcerBackup = !announcerBackup;
      engine.playAnnouncer(announcerBackup);
      break;
  }
});

// --- Resize / loop -------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  grade.setSize(window.innerWidth, window.innerHeight);
});

const PLATFORMISH = new Set(['PLATFORM', 'POSTER', 'CHARGER', 'FALSE_RELIEF', 'ENDING']);

// Edge-of-vision shadows — formless peripheral darkenings that pulse at a random
// screen edge during the charge and the post-contact beats, denser while charging,
// and vanish if the player snaps toward one. HARD CONSTRAINT: never a figure or
// shape; this only ever feeds the shader a point + intensity (a soft smudge).
const SHADOW_STATES = new Set(['CHARGER', 'FALSE_RELIEF', 'ENDING']); // during the charge + post-charge (full vision, punctuated)
function updateEdgeShadows(dt) {
  const active = postContact && SHADOW_STATES.has(machine.state);
  if (!active) {
    if (edgePulse) { edgePulse = null; grade.setEdgeShadow(0.5, 0.5, 0); }
    edgeLastYaw = player.yaw;
    return;
  }
  const turnRate = Math.abs(player.yaw - edgeLastYaw) / Math.max(dt, 1e-3);
  edgeLastYaw = player.yaw;

  if (!edgePulse) {
    edgeTimer -= dt;
    grade.setEdgeShadow(0.5, 0.5, 0);
    if (edgeTimer <= 0) {
      const charging = machine.state === 'CHARGER';
      const e = Math.floor(Math.random() * 4);
      let x = 0.12 + Math.random() * 0.76, y = 0.12 + Math.random() * 0.76;
      if (e === 0) x = 0.02 + Math.random() * 0.1;       // left edge
      else if (e === 1) x = 0.88 + Math.random() * 0.1;  // right edge
      else if (e === 2) y = 0.02 + Math.random() * 0.1;  // top edge
      else y = 0.88 + Math.random() * 0.1;               // bottom edge
      edgePulse = { x, y, age: 0, dur: 0.9 + Math.random() * 0.7, peak: charging ? 0.6 : 0.42 };
      edgeTimer = charging ? (1.1 + Math.random() * 1.0) : (3.0 + Math.random() * 2.0); // 3–5s post-charge
    }
  }
  if (edgePulse) {
    edgePulse.age += dt;
    const p = edgePulse;
    let inten = Math.sin(Math.min(1, p.age / p.dur) * Math.PI) * p.peak; // fade in → out
    if (turnRate > 1.4) inten *= Math.max(0, 1 - (turnRate - 1.4) * 1.2); // gone before the eye focuses
    grade.setEdgeShadow(p.x, p.y, Math.max(0, inten));
    if (p.age >= p.dur) edgePulse = null;
  }
}

// Inverse music coupling, mirrored game-side.
function musicLevel() {
  switch (machine.state) {
    case 'TRAIN_SAFE': return 1;
    case 'BATTERY_DEATH': return Math.max(0, 1 - machine.elapsed / DEATH.STUTTER);
    case 'PLATFORM': case 'POSTER': case 'CHARGER': return 0;
    case 'FALSE_RELIEF': case 'ENDING': case 'CREDITS': return 1;
    default: return 0;
  }
}

const clock = new THREE.Clock();
let tNow = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  tNow += dt;

  if (onRails && rails) rails.update(dt); // drive the camera along the recorded canonical path
  player.update(frozen ? 0 : dt, resolve); // dt 0 → movement frozen (final-line contact)
  if (recorder) recorder.update(dt, machine.state, player.pos); // ?record: capture this frame
  passengers.update(tNow); // headbob, always alive
  rain.update(dt);
  haze.update(tNow);

  // Charger proximity glow — faint far, resolves as the player approaches.
  const cd = Math.hypot(player.pos.x - markers.charger.x, player.pos.z - markers.charger.z);
  lights.setChargerProximity(Math.max(0.05, Math.min(1, (8 - cd) / 8)));
  const speed = Math.hypot(player.pos.x - lastPos.x, player.pos.z - lastPos.z) / Math.max(dt, 1e-3);
  lastPos.copy(player.pos);

  if (!onRails) {
    // Idle control hint — nudge a stuck player; gone for good once they move.
    if (audioReady && !hintDismissed && HINT_STATES.has(machine.state)) {
      if (speed > 0.15) { hintDismissed = true; ui.hideControlHint(); }
      else { idleTime += dt; if (idleTime > 4) ui.showControlHint(); }
    } else if (!hintDismissed) {
      ui.hideControlHint();
    }
  } else {
    // On rails the movement hint is moot. Instead, the SAME idle-hint pattern
    // nudges the one required action — the charger hold — if the player is parked
    // there and hasn't started after ~8s (the failure this mode exists to catch).
    if (rails && rails.waitingAtCharger && charge < 0.5) {
      chargerNudgeT += dt;
      if (chargerNudgeT > 8) ui.showControlHint('Hold Spacebar to charge your phone');
    } else {
      chargerNudgeT = 0;
      ui.hideControlHint();
    }
  }

  if (audioReady) updateEdgeShadows(dt); // peripheral paranoia (charge + after)

  // Wall-proximity light — only fades up near a wall on the dark platform beats.
  const onDarkPlatform = machine.state === 'PLATFORM' || machine.state === 'POSTER' || machine.state === 'CHARGER';
  if (onDarkPlatform) {
    const near = Math.max(0, Math.min(1, (PROX_RANGE - nearestWallDistance(player.pos)) / PROX_RANGE));
    proxLight.position.set(player.pos.x, 1.4, player.pos.z);
    proxLight.intensity = near * PROX_MAX;
    proxLight.visible = near > 0.01;
  } else if (proxLight.visible) {
    proxLight.visible = false;
  }

  // Phone light — soft warm pool around the player once charged.
  if (phoneOn) {
    phoneLight.position.set(player.pos.x, 1.5, player.pos.z);
    phoneLight.intensity = PHONE_MAX;
    phoneLight.visible = true;
  } else if (phoneLight.visible) {
    phoneLight.visible = false;
  }

  // Door slide.
  const d = trainGroup.userData.door;
  if (d.open && d.t < 1) {
    d.t = Math.min(1, d.t + dt / 1.4);
    d.panel.position.x = THREE.MathUtils.lerp(d.closedX, d.openX, d.t);
  }

  machine.update(dt);

  if (audioReady) {
    engine.updateListener(camera);
    engine.whispers.setMusicCoupling(musicLevel());
    engine.whispers.update(dt, camera, speed);
  }
  if (!PLATFORMISH.has(machine.state)) { grade.setVignette(0); ui.hidePrompt(); }

  if (DEBUG) {
    ui.setDebug(
      `STATE: ${machine.state ?? 'TITLE'}   NAME: ${machine.playerName || '—'}   BATT: ${machine.battery.toFixed(1)}%\n` +
      `charge ${charge.toFixed(0)}%  voices ${engine.whispers ? engine.whispers.voices.length : 0}  ` +
      `poster ${posterSeen ? 'seen' : '—'}  PSA:${announcerBackup ? 'B' : 'A'}  name:${lastNameMode}\n` +
      `[1-9] jump  [B] →brink  [N] name  [M] synth  [P] PSA A/B  [E] interact`
    );
  }

  grade.render(dt); // composer: render → grade/vignette/grain → output
}

if (!blocked) frame(); // touch/small-screen devices see only the block screen
