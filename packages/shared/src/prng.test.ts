import { describe, expect, it } from 'vitest';
import {
  chance,
  cloneRngState,
  createRngState,
  createRngStreams,
  cyrb128,
  nextFloat,
  nextInt,
  nextUint32,
  pickN,
  pickWeighted,
  RNG_STREAM_NAMES,
  type RngState,
  shuffle,
} from './prng';

/** Extrae una secuencia de n uint32 (avanza el estado). */
function sequence(st: RngState, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(nextUint32(st));
  return out;
}

describe('cyrb128', () => {
  it('es determinista: misma string -> mismas 4 palabras', () => {
    expect(cyrb128('umbral')).toEqual(cyrb128('umbral'));
  });

  it('strings distintas -> salidas distintas', () => {
    expect(cyrb128('umbral')).not.toEqual(cyrb128('umbrai'));
    expect(cyrb128('seed:deal')).not.toEqual(cyrb128('seed:shop'));
  });

  it('devuelve 4 uint32 (0..2^32-1)', () => {
    for (const w of cyrb128('xyz')) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(2 ** 32);
    }
  });
});

describe('determinismo del stream (sfc32)', () => {
  it('misma seed -> misma secuencia byte a byte', () => {
    const a = sequence(createRngState('semilla-1'), 1000);
    const b = sequence(createRngState('semilla-1'), 1000);
    expect(a).toEqual(b);
  });

  it('seeds distintas -> secuencias distintas', () => {
    const a = sequence(createRngState('semilla-1'), 50);
    const b = sequence(createRngState('semilla-2'), 50);
    expect(a).not.toEqual(b);
  });

  it('nextFloat siempre en [0, 1)', () => {
    const st = createRngState('floats');
    for (let i = 0; i < 100000; i++) {
      const f = nextFloat(st);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('nextUint32 siempre en [0, 2^32)', () => {
    const st = createRngState('uints');
    for (let i = 0; i < 100000; i++) {
      const u = nextUint32(st);
      expect(Number.isInteger(u)).toBe(true);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(2 ** 32);
    }
  });
});

describe('helpers', () => {
  it('nextInt respeta [min, max] inclusive y cubre ambos extremos', () => {
    const st = createRngState('ints');
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 100000; i++) {
      const v = nextInt(st, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      if (v === 3) sawMin = true;
      if (v === 7) sawMax = true;
    }
    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });

  it('nextInt(n, n) devuelve siempre n', () => {
    const st = createRngState('fixed');
    for (let i = 0; i < 100; i++) expect(nextInt(st, 5, 5)).toBe(5);
  });

  it('nextInt lanza si max < min', () => {
    expect(() => nextInt(createRngState('x'), 5, 2)).toThrow();
  });

  it('chance es determinista y aproxima la probabilidad', () => {
    const st = createRngState('chance');
    let hits = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) if (chance(st, 0.3)) hits++;
    expect(hits / n).toBeGreaterThan(0.28);
    expect(hits / n).toBeLessThan(0.32);
  });

  it('chance(0) nunca y chance(1) siempre', () => {
    const st = createRngState('edge');
    for (let i = 0; i < 1000; i++) {
      expect(chance(st, 0)).toBe(false);
      expect(chance(st, 1)).toBe(true);
    }
  });

  it('shuffle es determinista, permuta y no muta la entrada', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = shuffle(createRngState('sh'), input);
    const b = shuffle(createRngState('sh'), input);
    expect(a).toEqual(b);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // intacta
    expect([...a].sort((x, y) => x - y)).toEqual(input); // mismo multiconjunto
  });

  it('shuffle con semillas distintas suele dar orden distinto', () => {
    const input = Array.from({ length: 52 }, (_, i) => i);
    expect(shuffle(createRngState('a'), input)).not.toEqual(shuffle(createRngState('b'), input));
  });

  it('pickN devuelve n distintos, subconjunto de la entrada, determinista', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const a = pickN(createRngState('p'), input, 3);
    const b = pickN(createRngState('p'), input, 3);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    for (const x of a) expect(input).toContain(x);
  });

  it('pickN con n >= longitud devuelve una baraja completa', () => {
    const input = [1, 2, 3];
    const r = pickN(createRngState('p'), input, 10);
    expect(r).toHaveLength(3);
    expect([...r].sort()).toEqual([1, 2, 3]);
  });

  it('pickWeighted nunca elige peso 0 y respeta la distribucion', () => {
    const st = createRngState('w');
    const items = ['raro', 'comun'] as const;
    const weights = [0, 1];
    for (let i = 0; i < 1000; i++) expect(pickWeighted(st, items, weights)).toBe('comun');
  });

  it('pickWeighted aproxima los pesos', () => {
    const st = createRngState('w2');
    const counts = { a: 0, b: 0 };
    const n = 100000;
    for (let i = 0; i < n; i++) counts[pickWeighted(st, ['a', 'b'] as const, [3, 1])]++;
    const ratio = counts.a / n;
    expect(ratio).toBeGreaterThan(0.72);
    expect(ratio).toBeLessThan(0.78);
  });

  it('pickWeighted valida entradas', () => {
    const st = createRngState('w3');
    expect(() => pickWeighted(st, [], [])).toThrow();
    expect(() => pickWeighted(st, ['a'], [1, 2])).toThrow();
    expect(() => pickWeighted(st, ['a'], [-1])).toThrow();
    expect(() => pickWeighted(st, ['a'], [0])).toThrow();
  });
});

describe('streams independientes (§5.3)', () => {
  it('todos los dominios esperados existen', () => {
    const s = createRngStreams('seed');
    for (const name of RNG_STREAM_NAMES) {
      expect(s[name]).toBeDefined();
    }
  });

  it('misma seed -> streams identicos', () => {
    const s1 = createRngStreams('run-7');
    const s2 = createRngStreams('run-7');
    for (const name of RNG_STREAM_NAMES) {
      expect(sequence(s1[name], 100)).toEqual(sequence(s2[name], 100));
    }
  });

  it('dominios distintos producen secuencias distintas', () => {
    const s = createRngStreams('run-7');
    const deal = sequence(s.deal, 50);
    const shop = sequence(s.shop, 50);
    const map = sequence(s.map, 50);
    expect(deal).not.toEqual(shop);
    expect(deal).not.toEqual(map);
    expect(shop).not.toEqual(map);
  });

  it('manipular un dominio (deal) NO mueve otro (shop)', () => {
    const s1 = createRngStreams('run-7');
    const s2 = createRngStreams('run-7');
    // s1: consumimos mucho de deal antes de tocar shop.
    sequence(s1.deal, 500);
    const shopAfterDeal = sequence(s1.shop, 50);
    // s2: shop "virgen", sin tocar deal.
    const shopVirgin = sequence(s2.shop, 50);
    expect(shopAfterDeal).toEqual(shopVirgin);
  });
});

describe('round-trip de estado (INV-4) y clone', () => {
  it('serializar/deserializar el estado continua la misma secuencia', () => {
    const st = createRngState('round-trip');
    sequence(st, 37); // avanzamos un poco
    const restored = JSON.parse(JSON.stringify(st)) as RngState;
    expect(sequence(restored, 100)).toEqual(sequence(st, 100));
  });

  it('cloneRngState avanza igual y no afecta al original', () => {
    const st = createRngState('clone');
    const clone = cloneRngState(st);
    const fromClone = sequence(clone, 100);
    const fromOriginal = sequence(st, 100);
    expect(fromClone).toEqual(fromOriginal);
    // El clon avanzo de forma independiente: el original no se vio afectado por consumir el clon.
    expect(st).toEqual(clone);
  });
});
