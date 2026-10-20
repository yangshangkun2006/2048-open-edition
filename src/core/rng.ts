import type { Rng } from './types';

// Seeded PRNG per PRD §6.6: xorshift32 with rejection sampling.
export function nextU32(rng: Rng): number {
  let x = rng.rngState;
  x ^= (x << 13) & 0xffffffff;
  x ^= x >>> 17;
  x ^= (x << 5) & 0xffffffff;
  rng.rngState = x >>> 0;
  return rng.rngState;
}

/** Unbiased integer in [0, n) via rejection sampling (avoids modulo bias). */
export function randInt(rng: Rng, n: number): number {
  const limit = Math.floor(2 ** 32 / n) * n;
  let r: number;
  do {
    r = nextU32(rng);
  } while (r >= limit);
  return r % n;
}

/** 128-bit crypto randomness, first 32 bits used as seed (PRD §6.6). */
export function newSeed(): { seed: number; weakRng: boolean } {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(4);
    crypto.getRandomValues(buf);
    return { seed: buf[0] ?? 0, weakRng: false };
  }
  // Fallback per PRD §9.2: playable, flagged as weak.
  return { seed: Math.floor(Math.random() * 0xffffffff) >>> 0, weakRng: true };
}
