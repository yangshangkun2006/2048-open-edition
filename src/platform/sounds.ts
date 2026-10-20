// Synthesized sound effects via WebAudio (no audio files, zero bytes, PRD
// §8.7 semantics). Default off; unlocked by the first user gesture.

let ctx: AudioContext | null = null;
let enabled = false;
let volume = 0.5;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function setSoundVolume(v: number): void {
  volume = v;
}

export function unlockAudio(): void {
  if (!enabled || ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, durationMs: number, type: OscillatorType, when = 0, gain = 1): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain * volume, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playMove(): void {
  if (!enabled || !ctx) return;
  tone(520, 60, 'triangle');
}

export function playMerge(value: number): void {
  if (!enabled || !ctx) return;
  if (value >= 128) {
    tone(392, 150, 'triangle', 0, 0.8); // G4
    tone(587.33, 200, 'triangle', 0.08, 0.8); // D5
  } else {
    tone(330, 80, 'triangle', 0, 0.6);
  }
}

export function playWin(): void {
  if (!enabled || !ctx) return;
  tone(523.25, 180, 'triangle', 0, 0.7);
  tone(659.25, 180, 'triangle', 0.12, 0.7);
  tone(783.99, 320, 'triangle', 0.24, 0.7);
}

export function playLose(): void {
  if (!enabled || !ctx) return;
  tone(220, 220, 'sine', 0, 0.5);
}
