/**
 * Table sounds, synthesised with the Web Audio API — no audio files, so
 * nothing to download and nothing that breaks offline / PWA use.
 *
 * Every sound is built from the same ingredients: a filtered burst of noise
 * (the "scrape" of cardboard) plus a short low sine (the "thud" of a card
 * meeting felt). That is roughly what a real card actually makes.
 */

export type TableSound =
  | 'pickup'
  | 'flip'
  | 'shuffle'
  | 'deal'
  | 'draw'
  | 'place'
  | 'gather'
  | 'cut';

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

const MASTER_GAIN = 0.6;

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) {
    try {
      audio = new Ctor();
      master = audio.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(audio.destination);
    } catch {
      return null;
    }
  }
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/**
 * Browsers refuse to play audio before a user gesture. The context is created
 * (and resumed) as soon as the player touches anything, so the very first
 * shuffle or flip is not silently swallowed.
 */
export function primeAudio(): void {
  ensureAudio();
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    const length = ac.sampleRate * 1.5;
    noise = ac.createBuffer(1, length, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function burst(
  ac: AudioContext,
  opts: {
    at?: number;
    duration: number;
    frequency: number;
    sweepTo?: number;
    gain: number;
    q?: number;
    type?: BiquadFilterType;
  }
): void {
  if (!master) return;
  const start = ac.currentTime + (opts.at ?? 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.frequency;
  filter.Q.value = opts.q ?? 1.1;
  if (opts.sweepTo) filter.frequency.linearRampToValueAtTime(opts.sweepTo, start + opts.duration);
  const gain = ac.createGain();
  const attack = Math.min(0.015, opts.duration * 0.35);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(opts.gain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(start, Math.random() * 0.8);
  src.stop(start + opts.duration + 0.03);
}

function thud(ac: AudioContext, at: number, frequency: number, duration: number, gain: number): void {
  if (!master) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), start + duration);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

/** Picking a card or a stack up: a soft rustle of cardboard. */
function pickup(ac: AudioContext) {
  burst(ac, { duration: 0.07, frequency: 1200, sweepTo: 700, gain: 0.22, q: 0.7 });
  burst(ac, { at: 0.05, duration: 0.05, frequency: 1600, gain: 0.14, q: 0.7 });
}

/** One card turning over: a crisp snap with felt underneath. */
function flip(ac: AudioContext) {
  burst(ac, { duration: 0.09, frequency: 2200, sweepTo: 900, gain: 0.42, q: 0.7 });
  thud(ac, 0.03, 160, 0.09, 0.22);
}

/** A riffle: a run of small clicks, then the pack squares up with a clack. */
function shuffle(ac: AudioContext) {
  let t = 0.02;
  for (let i = 0; i < 14; i += 1) {
    burst(ac, {
      at: t,
      duration: 0.03,
      frequency: 700 + Math.random() * 1100,
      gain: 0.2 + Math.random() * 0.12,
      q: 0.9
    });
    t += 0.028 + Math.random() * 0.022;
  }
  burst(ac, { at: t + 0.03, duration: 0.09, frequency: 1400, sweepTo: 500, gain: 0.34, q: 0.6 });
  thud(ac, t + 0.04, 120, 0.14, 0.3);
}

/** Dealing: the card slides off the pack ("thwip") and lands on the felt. */
function deal(ac: AudioContext) {
  burst(ac, { duration: 0.14, frequency: 1800, sweepTo: 420, gain: 0.3, q: 0.8 });
  thud(ac, 0.08, 130, 0.12, 0.26);
}

/** Drawing a card off a stack: a distinct flick. */
function draw(ac: AudioContext) {
  burst(ac, { duration: 0.09, frequency: 2400, sweepTo: 1200, gain: 0.32, q: 0.8 });
  thud(ac, 0.04, 180, 0.06, 0.12);
}

/** A card being set down on the felt. */
function place(ac: AudioContext) {
  thud(ac, 0, 110, 0.12, 0.3);
  burst(ac, { duration: 0.06, frequency: 1300, gain: 0.18, q: 0.6 });
}

/** Gathering a scattered pile back together. */
function gather(ac: AudioContext) {
  burst(ac, { duration: 0.08, frequency: 1500, sweepTo: 800, gain: 0.26, q: 0.7 });
  thud(ac, 0.05, 120, 0.12, 0.28);
}

/** Cutting the deck: two short clacks. */
function cut(ac: AudioContext) {
  burst(ac, { duration: 0.05, frequency: 1700, gain: 0.26, q: 0.7 });
  burst(ac, { at: 0.09, duration: 0.06, frequency: 1400, gain: 0.24, q: 0.7 });
  thud(ac, 0.1, 110, 0.1, 0.22);
}

export function playTableSound(kind: TableSound): void {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  if (kind === 'pickup') pickup(ac);
  else if (kind === 'flip') flip(ac);
  else if (kind === 'shuffle') shuffle(ac);
  else if (kind === 'deal') deal(ac);
  else if (kind === 'draw') draw(ac);
  else if (kind === 'gather') gather(ac);
  else if (kind === 'cut') cut(ac);
  else place(ac);
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
}

export function isSoundMuted(): boolean {
  return muted;
}
