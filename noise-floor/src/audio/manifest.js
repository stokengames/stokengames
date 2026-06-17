// Source manifest. Real recordings now wired as files; the engine loads them and
// falls back to the procedural generators automatically on any failed/missing
// load (see loader.js). Swapping an alternate take is a one-line edit here — e.g.
// point `lineFinal` at line-final-anna.ogg to A/B the ending voice.

const A = './assets/audio/';

export const manifest = {
  // The earbud track (stereo, not positional). Full master — train / natural play.
  music: A + 'dont-go-quiet.ogg',
  // Shortened edit (~29s removed between chorus and bridge) — used for the charger
  // slam-back through the ENDING so the bridge arrives sooner. Chorus still 0:30.
  musicShort: A + 'dont-go-quiet-short.ogg',
  // Instrumental: credits bed + source for the leaking-earbud world snippets.
  musicInstrumental: A + 'dont-go-quiet-instrumental.ogg',

  // Cue points (seconds). `chorus` is the slam-back start; `bridge` is where the
  // final line threads in — on the SHORT edit, at 0:53.
  musicCues: { voice: 12, chorus: 30, bridge: 53 },

  // Field voice loops (positional). Loop points sit in breath gaps.
  whispers: [
    A + 'whisper-01.ogg', A + 'whisper-02.ogg', A + 'whisper-03.ogg',
    A + 'whisper-04.ogg', A + 'whisper-05.ogg', A + 'whisper-06.ogg',
    A + 'whisper-07.ogg', A + 'whisper-08.ogg', A + 'whisper-09.ogg',
    A + 'whisper-10.ogg', A + 'whisper-11.ogg', A + 'whisper-12.ogg',
  ],
  // Rare-rotation fragment — low level, infrequent, just another household voice.
  whisperRare: A + 'whisper-13-spicy-ice-cream.ogg',

  // Breath texture under the field — continuous, low, weakly positional.
  beds: [A + 'bed-breathing-1.ogg', A + 'bed-breathing-2.ogg'],

  // Street rain — the ending's sensory anchor. RECORDED loop only (never
  // synthesised — synthetic filtered noise is what kept reading as hiss). Null
  // until supplied; drop a path here to swap it in, same seam as everything else.
  // Stereo (ambient room sound, not positional), looping. 40s seamless loop
  // (crossfade-wrapped) trimmed from an 8-min master kept in raw/.
  rain: A + 'rain-loop.ogg',

  // The ending line, threaded into the bridge. (anna take; eli is the alt.)
  lineFinal: A + 'line-final-anna.ogg',
  // The single extra credits whisper.
  lineCredits: A + 'line-credits-hello.ogg',
  // Clean PSA read; aged-broadcast treatment is applied in-engine (announcer.js).
  // Slots swapped so the backup take is the default (A, fires on the poster); the
  // original is the B comparison, one P press away. Files unchanged — flip these
  // two lines back to revert.
  announcer: A + 'announcer-psa-backup.ogg',     // A — default / canonical take
  announcerBackup: A + 'announcer-psa.ogg',      // B — original take (via P)
};
