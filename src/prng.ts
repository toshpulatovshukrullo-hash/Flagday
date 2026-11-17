/** Seeded PRNG (mulberry32) — the only randomness allowed in the film. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stateless hash → [0,1) for (index, salt). */
export const hash01 = (i: number, salt = 0): number => mulberry32((i * 2654435761) ^ (salt * 40503 + 0x9e3779b9))();
