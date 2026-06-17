// SpeechSynthesis name voice — now a DEV CURIOSITY only, behind the M toggle.
// It was cut as the canonical name moment because it cannot be routed through the
// audio graph (no whisper processing, no ducking, no positioning) and reads as a
// robot. The canonical name whisper is now procedural, in whispers.speakName().
// This stays only so we can A/B it while tuning.

let useSynthesis = false; // procedural is canon; flip on with M to hear synthesis
export function toggleSynthesis() { useSynthesis = !useSynthesis; return useSynthesis; }
export function synthesisEnabled() { return useSynthesis; }

// Fire-and-forget; never blocks. Returns 'synthesis' or 'unavailable'.
export function speakSynthesis(word) {
  const synth = typeof window !== 'undefined' && window.speechSynthesis;
  if (!synth) return 'unavailable';
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.rate = 0.55; u.pitch = 0.35; u.volume = 0.6;
    const voices = synth.getVoices();
    if (voices && voices.length) u.voice = voices[0];
    synth.speak(u);
    return 'synthesis';
  } catch (_) {
    return 'unavailable';
  }
}
