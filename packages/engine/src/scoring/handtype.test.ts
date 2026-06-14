import type { Card, Rank, Suit } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import { detectHand } from './handtype';

let counter = 0;
function mk(suit: Suit | null, rank: Rank | null, id?: string): Card {
  return { id: id ?? `c${counter++}`, suit, rank, enhancement: null, seal: null };
}

describe('detectHand', () => {
  it('pareja: solo las 2 iguales puntuan', () => {
    const k1 = mk('CALIZ', 13);
    const k2 = mk('LLAVE', 13);
    const d = detectHand([k1, k2, mk('HUESO', 2), mk('OJO', 5), mk('CALIZ', 8)]);
    expect(d.type).toBe('pareja');
    expect(d.scoring).toEqual(new Set([k1.id, k2.id]));
  });

  it('doble pareja: las 4 cartas de los dos pares', () => {
    const cards = [
      mk('CALIZ', 13),
      mk('LLAVE', 13),
      mk('HUESO', 12),
      mk('OJO', 12),
      mk('CALIZ', 2),
    ];
    const d = detectHand(cards);
    expect(d.type).toBe('doble_pareja');
    expect(d.scoring.size).toBe(4);
  });

  it('trio, poker y full', () => {
    expect(
      detectHand([mk('CALIZ', 8), mk('LLAVE', 8), mk('HUESO', 8), mk('OJO', 2), mk('CALIZ', 5)])
        .type,
    ).toBe('trio');
    expect(
      detectHand([mk('CALIZ', 8), mk('LLAVE', 8), mk('HUESO', 8), mk('OJO', 8), mk('CALIZ', 5)])
        .type,
    ).toBe('poker');
    const full = detectHand([
      mk('CALIZ', 8),
      mk('LLAVE', 8),
      mk('HUESO', 8),
      mk('OJO', 2),
      mk('CALIZ', 2),
    ]);
    expect(full.type).toBe('full');
    expect(full.scoring.size).toBe(5);
  });

  it('color (flush) no consecutivo', () => {
    const d = detectHand([
      mk('CALIZ', 2),
      mk('CALIZ', 5),
      mk('CALIZ', 9),
      mk('CALIZ', 12),
      mk('CALIZ', 14),
    ]);
    expect(d.type).toBe('color');
    expect(d.scoring.size).toBe(5);
  });

  it('escalera con As alto (10-J-Q-K-A)', () => {
    const d = detectHand([
      mk('CALIZ', 10),
      mk('LLAVE', 11),
      mk('HUESO', 12),
      mk('OJO', 13),
      mk('CALIZ', 14),
    ]);
    expect(d.type).toBe('escalera');
  });

  it('escalera con As bajo (A-2-3-4-5)', () => {
    const d = detectHand([
      mk('CALIZ', 14),
      mk('LLAVE', 2),
      mk('HUESO', 3),
      mk('OJO', 4),
      mk('CALIZ', 5),
    ]);
    expect(d.type).toBe('escalera');
  });

  it('NO es escalera si hay hueco (10-J-Q-K-2)', () => {
    const d = detectHand([
      mk('CALIZ', 10),
      mk('LLAVE', 11),
      mk('HUESO', 12),
      mk('OJO', 13),
      mk('CALIZ', 2),
    ]);
    expect(d.type).toBe('carta_alta');
  });

  it('escalera de color y escalera real', () => {
    const sf = detectHand([mk('OJO', 5), mk('OJO', 6), mk('OJO', 7), mk('OJO', 8), mk('OJO', 9)]);
    expect(sf.type).toBe('escalera_color');
    const royal = detectHand([
      mk('OJO', 10),
      mk('OJO', 11),
      mk('OJO', 12),
      mk('OJO', 13),
      mk('OJO', 14),
    ]);
    expect(royal.type).toBe('escalera_real');
  });

  it('prioridad color vs escalera: una escalera de color NO es color ni escalera', () => {
    const d = detectHand([
      mk('HUESO', 4),
      mk('HUESO', 5),
      mk('HUESO', 6),
      mk('HUESO', 7),
      mk('HUESO', 8),
    ]);
    expect(d.type).toBe('escalera_color');
  });

  it('carta alta: solo la mas alta puntua', () => {
    const ace = mk('CALIZ', 14);
    const d = detectHand([mk('LLAVE', 2), mk('HUESO', 5), mk('OJO', 9), mk('CALIZ', 11), ace]);
    expect(d.type).toBe('carta_alta');
    expect(d.scoring).toEqual(new Set([ace.id]));
  });

  it('quinteto y quinteto de color (cartas duplicadas)', () => {
    const five = (suit: Suit) => [
      mk(suit, 7, 'q1'),
      mk(suit, 7, 'q2'),
      mk(suit, 7, 'q3'),
      mk(suit, 7, 'q4'),
      mk(suit, 7, 'q5'),
    ];
    expect(detectHand(five('CALIZ')).type).toBe('quinteto_color');
    const mixed = [
      mk('CALIZ', 7, 'a'),
      mk('LLAVE', 7, 'b'),
      mk('HUESO', 7, 'c'),
      mk('OJO', 7, 'd'),
      mk('CALIZ', 7, 'e'),
    ];
    expect(detectHand(mixed).type).toBe('quinteto');
  });

  it('pareja jugando solo 2 cartas', () => {
    expect(detectHand([mk('CALIZ', 9), mk('OJO', 9)]).type).toBe('pareja');
  });
});
