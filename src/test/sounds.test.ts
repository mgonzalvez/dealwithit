/**
 * The table sounds are synthesised, so the only way to test them in Node is to
 * hand them a stand-in AudioContext that behaves like the real one.
 *
 * The stand-in deliberately makes `Q` a getter-only property (exactly like a
 * real BiquadFilterNode). That catches the kind of mistake that used to throw
 * inside the pointer handlers and silently break dragging on the table.
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import { playTableSound, setSoundMuted, primeAudio, type TableSound } from '../features/table/sounds';

class StubParam {
  value = 0;
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class StubFilter {
  type = 'bandpass';
  frequency = new StubParam();
  private q = new StubParam();

  // Real nodes expose Q as an AudioParam through a getter only.
  get Q(): StubParam {
    return this.q;
  }

  connect(): void {}
}

class StubSource {
  buffer: unknown = null;
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class StubOscillator {
  type = 'sine';
  frequency = new StubParam();
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class StubAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = { connect(): void {} };

  createGain() {
    return { gain: new StubParam(), connect(): void {} };
  }
  createBufferSource() {
    totals.sources += 1;
    return new StubSource();
  }
  createOscillator() {
    totals.oscillators += 1;
    return new StubOscillator();
  }
  createBiquadFilter() {
    return new StubFilter();
  }
  createBuffer(_channels: number, _length: number, _sampleRate: number) {
    const data = new Float32Array(100);
    return { getChannelData: () => data };
  }
  resume() {
    return Promise.resolve();
  }
}

const ALL_SOUNDS: TableSound[] = ['pickup', 'flip', 'shuffle', 'deal', 'draw', 'place', 'gather', 'cut'];

// The sounds module keeps one AudioContext alive, so counts are tracked
// globally rather than per instance.
const totals = { sources: 0, oscillators: 0 };
const nodeCount = () => totals.sources + totals.oscillators;

describe('table sounds', () => {
  let previousWindow: unknown;

  beforeEach(() => {
    previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = { AudioContext: StubAudioContext };
    setSoundMuted(false);
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = previousWindow;
  });

  it('every sound builds nodes without throwing', () => {
    for (const kind of ALL_SOUNDS) {
      const before = nodeCount();
      playTableSound(kind);
      if (nodeCount() === before) throw new Error(`${kind} produced no audio nodes`);
    }
  });

  it('the shuffle makes more noise than a single flip', () => {
    primeAudio();
    const beforeFlip = nodeCount();
    playTableSound('flip');
    const flipNodes = nodeCount() - beforeFlip;
    const beforeRiffle = nodeCount();
    playTableSound('shuffle');
    const riffleNodes = nodeCount() - beforeRiffle;
    if (riffleNodes <= flipNodes) {
      throw new Error(`shuffle should be busier than a flip (${riffleNodes} vs ${flipNodes})`);
    }
  });

  it('muting stops making sound', () => {
    setSoundMuted(true);
    const before = nodeCount();
    playTableSound('shuffle');
    if (nodeCount() !== before) throw new Error('muted sounds should create nothing');
  });
});
