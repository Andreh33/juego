// PRNG sembrado y determinista (§5.3, INV-1/INV-2).
//
// Algoritmo FIJO (no cambiar nunca: alteraría el determinismo cross-device):
//   - cyrb128: string seed -> 4x uint32 (material de semilla).
//   - sfc32:   generador de estado de 4 palabras (encaja con RngState{s0..s3} de §25).
//
// El estado del PRNG vive DENTRO de GameState (serializable). Nunca un PRNG global mutable.
// Los helpers AVANZAN el RngState que reciben (mutacion in situ de la pequena struct), igual
// que java.util.Random. Para "espiar" sin consumir, usa cloneRngState (p.ej. premonicion/scry).

/** Estado de un stream PRNG: 4 palabras de 32 bits (sfc32). Serializable (§25). */
export interface RngState {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
}

/**
 * cyrb128 (dominio publico, por bryc). Hash de string -> 4x uint32.
 * Se usa solo como material de semilla para sfc32.
 */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Iteraciones de calentamiento de sfc32 tras sembrar (mejora la distribucion inicial). */
const SFC32_WARMUP = 15;

/** Avanza el estado (sfc32) y devuelve un uint32 (0..2^32-1). Mutacion in situ. */
export function nextUint32(st: RngState): number {
  const a = st.s0 | 0;
  const b = st.s1 | 0;
  const c = st.s2 | 0;
  const d = st.s3 | 0;
  const t = (((a + b) | 0) + d) | 0;
  st.s3 = (d + 1) | 0;
  st.s0 = b ^ (b >>> 9);
  st.s1 = (c + (c << 3)) | 0;
  let nc = (c << 21) | (c >>> 11);
  nc = (nc + t) | 0;
  st.s2 = nc;
  return t >>> 0;
}

/** Float determinista en [0, 1). */
export function nextFloat(st: RngState): number {
  return nextUint32(st) / 4294967296;
}

/** Entero determinista en [min, max] (ambos inclusive). */
export function nextInt(st: RngState, min: number, max: number): number {
  if (max < min) throw new Error(`nextInt: max (${max}) < min (${min})`);
  const span = max - min + 1;
  return min + Math.floor(nextFloat(st) * span);
}

/** Devuelve true con probabilidad p (0..1). */
export function chance(st: RngState, p: number): boolean {
  return nextFloat(st) < p;
}

/** Baraja Fisher-Yates determinista. Devuelve un array NUEVO (no muta la entrada). */
export function shuffle<T>(st: RngState, input: readonly T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(st, 0, i);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** Elige n elementos distintos (sin reemplazo). Si n >= longitud, devuelve una baraja completa. */
export function pickN<T>(st: RngState, input: readonly T[], n: number): T[] {
  const k = Math.max(0, Math.min(n, input.length));
  return shuffle(st, input).slice(0, k);
}

/** Eleccion ponderada de un elemento. weights debe alinearse con items y sumar > 0. */
export function pickWeighted<T>(st: RngState, items: readonly T[], weights: readonly number[]): T {
  if (items.length === 0) throw new Error('pickWeighted: items vacio');
  if (items.length !== weights.length) {
    throw new Error('pickWeighted: items y weights de distinta longitud');
  }
  let total = 0;
  for (const w of weights) {
    if (w < 0) throw new Error('pickWeighted: peso negativo');
    total += w;
  }
  if (total <= 0) throw new Error('pickWeighted: suma de pesos <= 0');
  let r = nextFloat(st) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return items[i] as T;
  }
  // Salvaguarda por redondeo de punto flotante: el ultimo elemento.
  return items[items.length - 1] as T;
}

/** Copia profunda del estado (para espiar sin consumir: scry/premonicion). */
export function cloneRngState(st: RngState): RngState {
  return { s0: st.s0, s1: st.s1, s2: st.s2, s3: st.s3 };
}

/** Crea un RngState desde una semilla string (cyrb128 -> sfc32 + calentamiento). */
export function createRngState(seed: string): RngState {
  const [a, b, c, d] = cyrb128(seed);
  const st: RngState = { s0: a, s1: b, s2: c, s3: d };
  for (let i = 0; i < SFC32_WARMUP; i++) nextUint32(st);
  return st;
}

// ---- Streams independientes por dominio (§5.3) ----
// Cada stream deriva de seed + ':' + dominio, asi manipular un dominio (p.ej. descartes)
// no "mueve" otro (p.ej. la tienda). Esto hace el balanceo/debug deterministas por dominio.

export const RNG_STREAM_NAMES = [
  'deal',
  'shop',
  'map',
  'boss',
  'event',
  'reward',
  'halluc',
] as const;

export type RngStreamName = (typeof RNG_STREAM_NAMES)[number];

/** Conjunto de streams del run (§25). */
export interface RngStreams {
  deal: RngState;
  shop: RngState;
  map: RngState;
  boss: RngState;
  event: RngState;
  reward: RngState;
  halluc: RngState;
}

/** Construye todos los streams a partir de la semilla maestra del run. */
export function createRngStreams(seed: string): RngStreams {
  return {
    deal: createRngState(`${seed}:deal`),
    shop: createRngState(`${seed}:shop`),
    map: createRngState(`${seed}:map`),
    boss: createRngState(`${seed}:boss`),
    event: createRngState(`${seed}:event`),
    reward: createRngState(`${seed}:reward`),
    halluc: createRngState(`${seed}:halluc`),
  };
}
