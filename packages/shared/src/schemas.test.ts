import { describe, expect, it } from 'vitest';
import { createRngState, createRngStreams } from './prng';
import { CardSchema, RankSchema, RngStateSchema, RngStreamsSchema, SuitSchema } from './schemas';

describe('esquemas Zod del PRNG', () => {
  it('valida un RngState real y hace round-trip', () => {
    const st = createRngState('zod');
    const parsed = RngStateSchema.parse(JSON.parse(JSON.stringify(st)));
    expect(parsed).toEqual(st);
  });

  it('valida un RngStreams completo', () => {
    const s = createRngStreams('zod');
    expect(() => RngStreamsSchema.parse(JSON.parse(JSON.stringify(s)))).not.toThrow();
  });

  it('rechaza RngState con campos extra o no enteros', () => {
    expect(() => RngStateSchema.parse({ s0: 1, s1: 2, s2: 3, s3: 4, extra: 9 })).toThrow();
    expect(() => RngStateSchema.parse({ s0: 1.5, s1: 2, s2: 3, s3: 4 })).toThrow();
    expect(() => RngStateSchema.parse({ s0: 1, s1: 2, s2: 3 })).toThrow();
  });
});

describe('esquemas Zod de carta', () => {
  it('acepta una carta valida', () => {
    expect(() =>
      CardSchema.parse({
        id: 'c1',
        suit: 'CALIZ',
        rank: 14,
        enhancement: 'grabado',
        seal: 'sangre',
      }),
    ).not.toThrow();
  });

  it('acepta Piedra (suit/rank null) y cristalCharges opcional', () => {
    expect(() =>
      CardSchema.parse({
        id: 'piedra',
        suit: null,
        rank: null,
        enhancement: 'piedra',
        seal: null,
      }),
    ).not.toThrow();
    expect(() =>
      CardSchema.parse({
        id: 'cristal',
        suit: 'OJO',
        rank: 5,
        enhancement: 'cristal',
        seal: null,
        crystalCharges: 5,
      }),
    ).not.toThrow();
  });

  it('rechaza rango fuera de 2..14 y palo invalido', () => {
    expect(() => RankSchema.parse(1)).toThrow();
    expect(() => RankSchema.parse(15)).toThrow();
    expect(() => SuitSchema.parse('CORAZON')).toThrow();
  });
});
