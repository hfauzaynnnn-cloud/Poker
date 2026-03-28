/**
 * SoundManager — Web Audio API poker sounds (no external dependencies)
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function playTone(
  freq: number, type: OscillatorType = 'sine',
  volume = 0.15, duration = 0.08, attack = 0.005, decay = 0.06
) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + attack + decay);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {}
}

function playNoise(volume = 0.05, duration = 0.06) {
  try {
    const c = getCtx();
    const bufSize = c.sampleRate * duration;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buf;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start();
  } catch {}
}

export const SFX = {
  /** Card dealt to player */
  cardDeal: () => {
    playNoise(0.04, 0.05);
    playTone(380, 'triangle', 0.07, 0.06, 0.002, 0.055);
  },

  /** Card flipped face up */
  cardFlip: () => {
    playNoise(0.035, 0.04);
    playTone(520, 'sine', 0.06, 0.05);
  },

  /** Chip placed / call */
  chipClick: () => {
    playTone(800, 'square', 0.08, 0.05, 0.002, 0.045);
    playNoise(0.03, 0.03);
  },

  /** Multiple chips — raise / bet */
  chipStack: () => {
    [0, 50, 100].forEach(delay => {
      setTimeout(() => {
        playTone(700 + Math.random() * 200, 'square', 0.06, 0.04, 0.002, 0.035);
        playNoise(0.025, 0.025);
      }, delay);
    });
  },

  /** Fold */
  fold: () => {
    playTone(220, 'sine', 0.08, 0.12, 0.005, 0.11);
  },

  /** Check */
  check: () => {
    playTone(600, 'triangle', 0.06, 0.06, 0.002, 0.055);
  },

  /** Win / pot awarded */
  win: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.12, 0.18, 0.005, 0.15), i * 100);
    });
  },

  /** Error / invalid action */
  error: () => {
    playTone(180, 'sawtooth', 0.08, 0.15, 0.002, 0.13);
  },

  /** New hand start */
  newHand: () => {
    playTone(440, 'sine', 0.07, 0.1);
    setTimeout(() => playTone(554, 'sine', 0.07, 0.1), 120);
  },

  /** All-in */
  allIn: () => {
    playTone(300, 'sawtooth', 0.12, 0.3, 0.01, 0.28);
    setTimeout(() => playTone(450, 'triangle', 0.1, 0.2), 100);
  },

  /** Button click (generic UI) */
  click: () => {
    playTone(660, 'sine', 0.05, 0.04, 0.002, 0.035);
  },

  /** Copy to clipboard */
  copy: () => {
    playTone(880, 'sine', 0.05, 0.05);
    setTimeout(() => playTone(1100, 'sine', 0.04, 0.05), 60);
  },
};

/** Call this once on first user gesture to unlock audio context */
export function unlockAudio() {
  try { getCtx().resume(); } catch {}
}
