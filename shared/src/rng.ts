/**
 * Deterministic seeded RNG. Same seed -> same sequence, so generators are
 * reproducible (and unit-testable). mulberry32 over a string-hashed seed.
 */
export interface SeededRng {
  /** float in [0,1) */
  next(): number;
  /** int in [min,max] inclusive */
  int(min: number, max: number): number;
  /** pick one element */
  pick<T>(arr: readonly T[]): T;
  /** in-place Fisher-Yates shuffle, returns a new array */
  shuffle<T>(arr: readonly T[]): T[];
  /** true with probability p */
  chance(p: number): boolean;
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 0x9e3779b9;
}

export function createRng(seed: string): SeededRng {
  let a = hashSeed(seed);
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}
