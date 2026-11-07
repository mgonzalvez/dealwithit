/**
 * Table sounds, synthesised with the Web Audio API — no audio files, so
 * nothing to download and nothing that breaks offline / PWA use.
 *
 * Every sound is built from the same ingredients: a filtered burst of noise
 * (the "scrape" of cardboard) plus a short low sine (the "thud" of the card
 * meeting the felt). That is roughly what a real card actually makes.
 */

export type TableSound = 'flip' | 'shuffle' | 'deal' | 'draw' | 'place' | 'gather';

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) {
    try {
      audio = new Ctor();
      master = audio.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(audio.destination);
    } catch {
      return null;
    }
  }
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    const length = ac.sampleRate * 1.2;
    noise = ac.createBuffer(1, length, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function burst(
  ac: AudioContext,
  opts: { at?: number; duration: number; frequency: number; sweepTo?: number; gain: number; q?: number; type?: BiquadFilterType }
) {
  if (!master) return;
  const start = ac.currentTime + (opts.at ?? 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.frequency;
  (filter as unknown as { Q: number }).Q = opts.q ?? 1.1;
  if (opts.sweepTo) filter.frequency.linearRampToValueAtTime(opts.sweepTo, start + opts.duration);
  const gain = ac.createGain();
  const attack = Math.min(0.012, opts.duration * 0.35);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(opts.gain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(start, Math.random() * 0.6);
  src.stop(start + opts.duration + 0.02);
}

function thud(ac: AudioContext, at: number, frequency: number, duration: number, gain: number) {
  if (!master) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.6), start + duration);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** One card turning over: a quick snap with a soft felt thud underneath. */
function flip(ac: AudioContext) {
  burst(ac, { duration: 0.055, frequency: 1900, sweepTo: 800, gain: 0.3, q: 0.7 });
  thud(ac, 0.02, 150, 0.07, 0.16);
}

/** A riffle: a run of small clicks, then the pack squares up with a clack. */
function shuffle(ac: AudioContext) {
  let t = 0.02;
  for (let i = 0; i < 12; i += 1) {
    burst(ac, {
      at: t,
      duration: 0.026,
      frequency: 800 + Math.random() * 900,
      gain: 0.13 + Math.random() * 0.08,
      q: 0.9
    });
    t += 0.03 + Math.random() * 0.02;
  }
  burst(ac, { at: t + 0.03, duration: 0.06, frequency: 1300, sweepTo: 500, gain: 0.24, q: 0.6 });
  thud(ac, t + 0.04, 110, 0.1, 0.2);
}

/** Dealing: the card slides off the pack ("thwip") and lands on the felt. */
function deal(ac: AudioContext) {
  burst(ac, { duration: 0.11, frequency: 1600, sweepTo: 420, gain: 0.2, q: 0.8 });
  thud(ac, 0.06, 120, 0.1, 0.2);
}

/** Drawing a card off a stack: a small flick. */
function draw(ac: AudioContext) {
  burst(ac, { duration: 0.06, frequency: 2200, sweepTo: 1100, gain: 0.22, q: 0.8 });
}

/** A card being set down, or a stack gathered together. */
function place(ac: AudioContext) {
  thud(ac, 0, 100, 0.09, 0.22);
  burst(ac, { duration: 0.04, frequency: 1200, gain: 0.12, q: 0.6 });
}

export function playTableSound(kind: TableSound): void {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  if (kind === 'flip') flip(ac);
  else if (kind === 'shuffle') shuffle(ac);
  else if (kind === 'deal') deal(ac);
  else if (kind === 'draw') draw(ac);
  else place(ac);
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.42;
  if (!muted) ensureAudio();
}

export function isSoundMuted(): boolean {
  return muted;
}
