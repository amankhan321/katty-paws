// Lightweight synthesized audio — upbeat chiptune loop + SFX.
// No audio files (no copyright); everything is generated with oscillators.
// Must be unlocked by a user gesture before it will sound (browser autoplay rules).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextNoteTime = 0;
let stepIdx = 0;

// upbeat C-major pentatonic loop (Hz); 0 = rest
const MELODY = [
  523, 659, 784, 659, 523, 659, 784, 880, 784, 659, 523, 587, 659, 784, 659, 0,
  587, 698, 880, 698, 587, 698, 880, 1046, 880, 698, 587, 523, 587, 659, 587, 0,
];
const BASS = [131, 0, 131, 0, 98, 0, 98, 0, 110, 0, 110, 0, 87, 0, 98, 0];
const STEP = 0.15; // seconds per step (~upbeat)

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.2;
    musicGain.connect(master);
  }
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  when: number,
  vol: number,
  dest: AudioNode
) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(dest);
  o.start(when);
  o.stop(when + dur + 0.02);
}

export function unlock() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("katty_muted") === "1";
  } catch {
    return false;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    window.localStorage.setItem("katty_muted", m ? "1" : "0");
  } catch {}
  if (master && ctx) master.gain.setValueAtTime(m ? 0 : 0.55, ctx.currentTime);
}

export function startMusic() {
  const c = ensureCtx();
  if (!c) return;
  unlock();
  if (musicTimer != null) return;
  stepIdx = 0;
  nextNoteTime = c.currentTime + 0.06;
  musicTimer = setInterval(() => {
    if (!ctx || !musicGain) return;
    if (ctx.state !== "running") {
      nextNoteTime = ctx.currentTime + 0.06;
      return;
    }
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const f = MELODY[stepIdx % MELODY.length];
      if (f > 0) tone(f, 0.14, "square", nextNoteTime, 0.5, musicGain);
      const b = BASS[stepIdx % BASS.length];
      if (b > 0) tone(b, 0.18, "triangle", nextNoteTime, 0.7, musicGain);
      nextNoteTime += STEP;
      stepIdx++;
    }
  }, 60);
}

export function stopMusic() {
  if (musicTimer != null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function sfxJump() {
  const c = ensureCtx();
  if (!c || !master) return;
  const t = c.currentTime;
  tone(440, 0.12, "square", t, 0.35, master);
  tone(660, 0.12, "square", t + 0.04, 0.3, master);
}

export function sfxCoin() {
  const c = ensureCtx();
  if (!c || !master) return;
  const t = c.currentTime;
  tone(988, 0.08, "square", t, 0.35, master);
  tone(1319, 0.12, "square", t + 0.05, 0.35, master);
}

export function sfxShield() {
  const c = ensureCtx();
  if (!c || !master) return;
  const t = c.currentTime;
  // rising power-up sweep
  for (let i = 0; i < 6; i++) {
    tone(523 + i * 130, 0.09, "sawtooth", t + i * 0.05, 0.3, master);
  }
}

export function sfxDie() {
  const c = ensureCtx();
  if (!c || !master) return;
  const t = c.currentTime;
  // descending tumble
  tone(330, 0.14, "square", t, 0.4, master);
  tone(247, 0.16, "square", t + 0.1, 0.4, master);
  tone(165, 0.3, "square", t + 0.22, 0.4, master);
}
