// Thin DOM overlay manager. Phase 1 owns the title gate (with the name input
// pulled forward, since BATTERY_DEATH in Phase 2 whispers that name), the
// click-to-resume overlay, and the dev debug readout. The full HUD, captions,
// and ending card are the Phase 5 job — this file is their seed.

const titleEl = document.getElementById('title');
const resumeEl = document.getElementById('resume');
const debugEl = document.getElementById('debug-hud');
const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');
const batteryEl = document.getElementById('battery');
const captionEl = document.getElementById('caption');
const vignetteEl = document.getElementById('vignette');
const promptEl = document.getElementById('prompt');
const titleCardEl = document.getElementById('title-card');
const creditsEl = document.getElementById('credits');
const creditsScrollEl = document.getElementById('credits-scroll');
const fadeEl = document.getElementById('fade');
const mobileBlockEl = document.getElementById('mobile-block');
const loadingEl = document.getElementById('loading');

export function showLoading() { loadingEl.classList.remove('hidden'); }
export function hideLoading() { loadingEl.classList.add('hidden'); }

export function onStart(cb) {
  startBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    requestFullscreen(); // same gesture that unlocks audio (fullscreen needs one too)
    titleEl.classList.add('hidden');
    cb(name);
  });
}

// Desktop-only gate. Touch CAPABILITY alone must not block — touchscreen laptops
// driven by a mouse/trackpad report touch (and sometimes a coarse pointer) yet are
// perfectly valid desktops. The reliable signal is whether ANY hovering input
// exists: every desktop/laptop (incl. touchscreen ones) has a mouse/trackpad and
// reports `any-hover: hover`; a phone/tablet with no mouse reports `any-hover:
// none`. We block only that case AND a small viewport. `?desktop` forces through.
export function isTouchBlocked() {
  try {
    if (new URLSearchParams(location.search).has('desktop')) return false; // manual escape hatch
  } catch (_) {}
  const mm = window.matchMedia;
  if (!mm) return false; // can't detect → don't block (better than blocking a desktop)
  const noHover = mm('(any-hover: none)').matches; // no mouse/trackpad anywhere
  const small = window.innerWidth < 1100;
  return noHover && small;
}

export function showMobileBlock() {
  titleEl.classList.add('hidden');
  mobileBlockEl.classList.remove('hidden');
}

export function showResume() { resumeEl.classList.remove('hidden'); }
export function hideResume() { resumeEl.classList.add('hidden'); }

// Click anywhere on the resume overlay re-requests pointer lock. The gesture
// requirement is satisfied because this fires from a real click.
export function onResume(cb) {
  resumeEl.addEventListener('click', cb);
}

export function setDebug(text) { debugEl.textContent = text; }
export function hideDebug() { if (debugEl) debugEl.style.display = 'none'; }

// Fullscreen request, reusable for the Begin click and the resume-after-exit flow.
export function requestFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

// --- Battery HUD ---------------------------------------------------------------

// Decimals so the player sees it ticking down fast (e.g. 16.9%). With the debug
// HUD gone, this is the only on-screen UI during the train.
export function setBattery(percent) {
  batteryEl.classList.remove('hidden');
  batteryEl.textContent = `▮ BATTERY ${percent.toFixed(1)}%`;
  batteryEl.classList.toggle('low', percent <= 10 && percent > 4);
  batteryEl.classList.toggle('critical', percent <= 4);
}
export function hideBattery() { batteryEl.classList.add('hidden'); }

// --- Captions ------------------------------------------------------------------

let captionTimer = null;

// kind: 'whisper' (a spoken line, e.g. the name) or 'env' (an environmental cue).
// hold = seconds before auto-clear; 0 keeps it until clearCaption().
export function showCaption(text, { kind = 'whisper', hold = 4 } = {}) {
  if (captionTimer) { clearTimeout(captionTimer); captionTimer = null; }
  captionEl.className = `show ${kind}`;
  captionEl.textContent = text;
  if (hold > 0) {
    captionTimer = setTimeout(clearCaption, hold * 1000);
  }
}

export function clearCaption() {
  if (captionTimer) { clearTimeout(captionTimer); captionTimer = null; }
  captionEl.className = '';
}

// --- Vignette / prompt ---------------------------------------------------------

export function setVignette(intensity) {
  vignetteEl.style.opacity = Math.max(0, Math.min(1, intensity)).toFixed(3);
}

// Fade-to-black / back, for the scripted stair climb.
export function fadeOut(ms = 1500) {
  fadeEl.style.transition = `opacity ${ms}ms linear`;
  requestAnimationFrame(() => { fadeEl.style.opacity = '1'; });
}
export function fadeIn(ms = 1500) {
  fadeEl.style.transition = `opacity ${ms}ms linear`;
  requestAnimationFrame(() => { fadeEl.style.opacity = '0'; });
}
export function fadeClear() {
  fadeEl.style.transition = 'none';
  fadeEl.style.opacity = '0';
}

export function showPrompt(text) {
  promptEl.textContent = text;
  promptEl.classList.remove('hidden');
}
export function hidePrompt() { promptEl.classList.add('hidden'); }

const controlHintEl = document.getElementById('control-hint');
// Optional text override — On Rails reuses this same hint to nudge the charger hold.
export function showControlHint(text) {
  if (text != null) controlHintEl.textContent = text;
  controlHintEl.classList.add('show');
}
export function hideControlHint() { controlHintEl.classList.remove('show'); }

// --- On Rails toggle (title screen) --------------------------------------------
const railsToggle = document.getElementById('rails-toggle');
export function isOnRails() { return !!(railsToggle && railsToggle.checked); }
// Hide the toggle entirely until a path has been recorded (rails-path.js empty).
export function setRailsAvailable(v) {
  const row = document.getElementById('rails-toggle-row');
  if (row) row.style.display = v ? 'flex' : 'none';
}

// --- Ending card / credits -----------------------------------------------------

export function showTitleCard() { titleCardEl.classList.remove('hidden'); }
export function hideTitleCard() { titleCardEl.classList.add('hidden'); }

// Build and start the credits roll over `durationSec`. Paced via WAAPI so the
// content scrolls from below the screen to where the LAST line just clears the
// top exactly at the end — it consumes the full window and never finishes early
// and waits, regardless of how much text there is.
export function showCredits(lines, durationSec = 60) {
  creditsScrollEl.classList.remove('roll'); // ensure no leftover CSS animation
  creditsScrollEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  creditsEl.classList.remove('hidden');
  creditsScrollEl.getAnimations().forEach((a) => a.cancel());
  const vh = creditsEl.clientHeight || window.innerHeight; // start just below the screen
  const h = creditsScrollEl.scrollHeight;                  // end when the last line clears the top
  creditsScrollEl.animate(
    [{ top: `${vh}px` }, { top: `-${h}px` }],
    { duration: durationSec * 1000, easing: 'linear', fill: 'forwards' }
  );
}
export function hideCredits() {
  creditsScrollEl.getAnimations().forEach((a) => a.cancel());
  creditsEl.classList.add('hidden');
}
