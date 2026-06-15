// SFX del juego (B7). Placeholder PROCEDURAL con Web Audio (sin assets): blips sintetizados para
// dar feedback inmediato. Cuando lleguen los stems reales se sustituye por Howler (§14.2) sin
// tocar los puntos de llamada. Respeta un flag de silencio (lo controla Ajustes, B20).
'use client';

let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.5;

export function setMuted(m: boolean): void {
  muted = m;
}
export function isMuted(): boolean {
  return muted;
}
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

function tone({ freq, dur, type = 'sine', gain = 0.08, slideTo, delay = 0 }: ToneOpts): void {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  const peak = gain * volume;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  select: () => tone({ freq: 620, dur: 0.06, type: 'triangle', gain: 0.06 }),
  deselect: () => tone({ freq: 380, dur: 0.05, type: 'triangle', gain: 0.05 }),
  play: () => {
    tone({ freq: 330, dur: 0.18, type: 'sawtooth', gain: 0.05, slideTo: 660 });
    tone({ freq: 494, dur: 0.22, type: 'sine', gain: 0.05, delay: 0.03 });
  },
  discard: () => tone({ freq: 240, dur: 0.14, type: 'sawtooth', gain: 0.05, slideTo: 120 }),
  coin: () => {
    tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.04 });
    tone({ freq: 1320, dur: 0.07, type: 'square', gain: 0.04, delay: 0.05 });
  },
  reward: () => {
    [523, 659, 784].forEach((f, i) => {
      tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.05, delay: i * 0.06 });
    });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => {
      tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.06, delay: i * 0.1 });
    });
  },
  lose: () => {
    [392, 311, 233].forEach((f, i) => {
      tone({ freq: f, dur: 0.4, type: 'sine', gain: 0.06, delay: i * 0.14 });
    });
  },
  nav: () => tone({ freq: 500, dur: 0.04, type: 'sine', gain: 0.04 }),
} as const;

export type SfxName = keyof typeof sfx;
