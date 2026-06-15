import type { Card, Enhancement, Rank, Seal, Suit } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import type { ScoringRelic } from './effects';
import { scoreHand } from './score';

let counter = 0;
function mk(
  suit: Suit | null,
  rank: Rank | null,
  opts?: { enh?: Enhancement; seal?: Seal; id?: string },
): Card {
  return {
    id: opts?.id ?? `c${counter++}`,
    suit,
    rank,
    enhancement: opts?.enh ?? null,
    seal: opts?.seal ?? null,
  };
}

const CATALIZADOR: ScoringRelic = {
  defId: 'relic.catalizador',
  onHandPlayed: [{ kind: 'addMult', n: 4 }],
};
const ESPEJO_NEGRO: ScoringRelic = {
  defId: 'relic.espejo_negro',
  xMult: [{ kind: 'xMult', factor: 1.5 }],
};

describe('TESTS DE ORO (§7.8)', () => {
  it('Test 1 = 787: Pareja Nv.2, K grabado + K + basura; Catalizador, Espejo Negro', () => {
    const kHeart = mk('CALIZ', 13, { enh: 'grabado', id: 'KH' });
    const kKey = mk('LLAVE', 13, { id: 'KD' });
    const played = [kHeart, kKey, mk('HUESO', 2), mk('OJO', 5), mk('CALIZ', 8)];
    const r = scoreHand({
      played,
      handLevels: { pareja: { level: 2 } },
      relics: [CATALIZADOR, ESPEJO_NEGRO],
    });
    expect(r.handType).toBe('pareja');
    expect(r.fichas).toBe(75n);
    expect(r.multScaled).toBe(10_500_000n); // 10.5
    expect(r.score).toBe(787);
  });

  it('Test 2 = 1207: igual pero K con sello Sangre (retrigger ×1)', () => {
    const kHeart = mk('CALIZ', 13, { enh: 'grabado', seal: 'sangre', id: 'KH' });
    const kKey = mk('LLAVE', 13, { id: 'KD' });
    const played = [kHeart, kKey, mk('HUESO', 2), mk('OJO', 5), mk('CALIZ', 8)];
    const r = scoreHand({
      played,
      handLevels: { pareja: { level: 2 } },
      relics: [CATALIZADOR, ESPEJO_NEGRO],
    });
    expect(r.fichas).toBe(115n);
    expect(r.score).toBe(1207);
  });

  it('Test 3 (orden ×mult) = 270: el ×1.5 de Untado se aplica DESPUES del +4 de Marca', () => {
    // Pareja de Q: una carta Marcada (+4 mult, aditivo) y otra Untada (×1.5, diferido al paso 5).
    const marcada = mk('CALIZ', 12, { enh: 'marca', id: 'M' });
    const untada = mk('LLAVE', 12, { enh: 'untado', id: 'U' });
    const r = scoreHand({ played: [marcada, untada], handLevels: { pareja: { level: 1 } } });
    // fichas: 10 base + 10 + 10 = 30. mult: 2 base + 4 (Marca) = 6, ×1.5 (Untado, paso 5) = 9.
    expect(r.fichas).toBe(30n);
    expect(r.multScaled).toBe(9_000_000n);
    expect(r.score).toBe(270); // floor(30 × 9). Si el ×1.5 fuera ANTES del +4 seria floor(30×7)=210.
  });
});

describe('puntuacion base', () => {
  it('pareja Nv.1 sin reliquias = 60', () => {
    const r = scoreHand({
      played: [mk('CALIZ', 13), mk('LLAVE', 13)],
      handLevels: { pareja: { level: 1 } },
    });
    expect(r.fichas).toBe(30n); // 10 base + 10 + 10
    expect(r.score).toBe(60); // 30 × 2
  });

  it('niveles vacios -> nivel 1 por defecto', () => {
    const r = scoreHand({ played: [mk('CALIZ', 13), mk('LLAVE', 13)], handLevels: {} });
    expect(r.score).toBe(60);
  });
});

describe('valores de carta (§7.1)', () => {
  it('As vale 11 fichas', () => {
    const r = scoreHand({ played: [mk('CALIZ', 14)], handLevels: {} });
    expect(r.fichas).toBe(16n); // carta_alta base 5 + 11
  });

  it('figuras (J/Q/K) valen 10', () => {
    for (const rank of [11, 12, 13] as const) {
      const r = scoreHand({ played: [mk('CALIZ', rank)], handLevels: {} });
      expect(r.fichas).toBe(15n); // 5 + 10
    }
  });
});

describe('mejoras de carta (§7.7)', () => {
  it('grabado +30 fichas', () => {
    expect(
      scoreHand({ played: [mk('CALIZ', 13, { enh: 'grabado' })], handLevels: {} }).fichas,
    ).toBe(45n);
  });
  it('marca +4 mult', () => {
    const r = scoreHand({ played: [mk('CALIZ', 13, { enh: 'marca' })], handLevels: {} });
    expect(r.score).toBe(75); // fichas 15 × mult 5
  });
  it('untado ×1.5 mult (paso 3b)', () => {
    const r = scoreHand({ played: [mk('CALIZ', 13, { enh: 'untado' })], handLevels: {} });
    expect(r.score).toBe(22); // floor(15 × 1.5)
  });
  it('cristal +50 fichas', () => {
    expect(
      scoreHand({ played: [mk('CALIZ', 13, { enh: 'cristal' })], handLevels: {} }).fichas,
    ).toBe(65n);
  });
  it('piedra puntua +50 aunque no forme tipo', () => {
    // Piedra + pareja de Q: la Piedra suma +50 aunque no sea parte del par.
    const r = scoreHand({
      played: [mk(null, null, { enh: 'piedra', id: 'stone' }), mk('CALIZ', 12), mk('LLAVE', 12)],
      handLevels: {},
    });
    expect(r.handType).toBe('pareja');
    expect(r.scoringIds).toContain('stone');
    expect(r.fichas).toBe(80n); // base 10 + Q10 + Q10 + piedra(0+50)
  });
});

describe('sellos de carta (§7.7)', () => {
  it('ocre da +1 moneda al puntuar', () => {
    expect(
      scoreHand({ played: [mk('CALIZ', 13, { seal: 'ocre' })], handLevels: {} }).coinsGained,
    ).toBe(1);
  });
  it('violeta: -2 cordura y +6 mult', () => {
    const r = scoreHand({ played: [mk('CALIZ', 13, { seal: 'violeta' })], handLevels: {} });
    expect(r.sanityDelta).toBe(-2);
    expect(r.score).toBe(105); // fichas 15 × mult 7
  });
});

describe('retriggers (§7.6)', () => {
  it('sello Sangre re-dispara una vez', () => {
    const r = scoreHand({
      played: [mk('CALIZ', 13, { enh: 'grabado', seal: 'sangre' })],
      handLevels: {},
    });
    // base 5 + 2×(10+30) = 85
    expect(r.fichas).toBe(85n);
  });

  it('el tope de 20 disparos por carta se respeta', () => {
    const bigRetrigger: ScoringRelic = {
      defId: 'relic.test_retrigger',
      retrigger: { when: { type: 'always' }, times: 50 },
    };
    const r = scoreHand({
      played: [mk('CALIZ', 13, { enh: 'grabado' })],
      handLevels: {},
      relics: [bigRetrigger],
    });
    // 20 disparos × (10+30) + base 5 = 805 (no 51 disparos)
    expect(r.fichas).toBe(805n);
  });
});

describe('reliquias condicionales y orden (§7.3)', () => {
  it('onCardScored condicional por palo', () => {
    const corazonNegro: ScoringRelic = {
      defId: 'relic.corazon_negro',
      onCardScored: [{ kind: 'addMult', n: 3, when: { type: 'suit', suit: 'CALIZ' } }],
    };
    // Pareja de CALIZ: +3 mult por cada CALIZ puntuado (2) = +6.
    const r = scoreHand({
      played: [mk('CALIZ', 13, { id: 'a' }), mk('CALIZ', 13, { id: 'b' })],
      handLevels: {},
      relics: [corazonNegro],
    });
    expect(r.score).toBe(30 * 8); // fichas 30 × mult (2 + 6) = 240
  });

  it('el orden de las reliquias cambia el resultado con ×mult condicionales', () => {
    const setup: ScoringRelic = { defId: 'setup', onHandPlayed: [{ kind: 'addMult', n: 7 }] };
    const a: ScoringRelic = {
      defId: 'A',
      xMult: [{ kind: 'xMult', factor: 2, when: { type: 'always' } }],
    };
    const b: ScoringRelic = {
      defId: 'B',
      xMult: [{ kind: 'xMult', factor: 2, when: { type: 'multAtLeast', value: 10 } }],
    };
    const played = [mk('CALIZ', 13)]; // carta alta: fichas 15, mult base 1
    const ab = scoreHand({ played, handLevels: {}, relics: [setup, a, b] });
    const ba = scoreHand({ played, handLevels: {}, relics: [setup, b, a] });
    expect(ab.score).toBe(480); // 8 ->×2=16(>=10) ->×2=32 ; 15×32
    expect(ba.score).toBe(240); // 8 -> B salta ->×2=16 ; 15×16
    expect(ab.score).not.toBe(ba.score);
  });
});

describe('determinismo en enteros (INV-2)', () => {
  it('mismo input -> misma puntuacion exacta (cross-device)', () => {
    const build = () =>
      scoreHand({
        played: [
          mk('CALIZ', 13, { enh: 'grabado', seal: 'sangre', id: 'KH' }),
          mk('LLAVE', 13, { id: 'KD' }),
        ],
        handLevels: { pareja: { level: 2 } },
        relics: [CATALIZADOR, ESPEJO_NEGRO],
      });
    const a = build();
    const b = build();
    expect(a.score).toBe(b.score);
    expect(a.fichas).toBe(b.fichas);
    expect(a.multScaled).toBe(b.multScaled);
    expect(Number.isInteger(a.score)).toBe(true);
  });

  it('bono de Cordura suma mult plano (§10.3)', () => {
    const base = scoreHand({ played: [mk('CALIZ', 13)], handLevels: {} });
    const withBonus = scoreHand({ played: [mk('CALIZ', 13)], handLevels: {}, corduraMultBonus: 5 });
    expect(base.score).toBe(15); // 15 × 1
    expect(withBonus.score).toBe(90); // 15 × (1 + 5)
  });
});
