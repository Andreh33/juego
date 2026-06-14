// Deteccion del mejor tipo de mano entre las cartas JUGADAS (§7.2). Solo las cartas que forman
// el tipo puntuan base; el resto no (las reliquias pueden cambiarlo en bloques posteriores).
import type { Card } from '@umbral/shared';
import type { HandType } from '../types';

export interface DetectedHand {
  type: HandType;
  /** Ids de las cartas que forman el tipo (puntuan base). El orden de puntuacion lo fija score.ts. */
  scoring: Set<string>;
}

/** Carta con rango/palo garantizados (las Piedra no participan en la deteccion). */
type RankedCard = Card & { rank: number; suit: string };

function isRanked(c: Card): c is RankedCard {
  return c.rank !== null && c.suit !== null;
}

function isConsecutive(sortedAsc: readonly number[]): boolean {
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = sortedAsc[i - 1];
    const cur = sortedAsc[i];
    if (prev === undefined || cur === undefined || cur !== prev + 1) return false;
  }
  return true;
}

/** Devuelve las 5 cartas si forman escalera (As alto=14 o bajo=1), o null. Requiere 5 cartas. */
function findStraight(cards: readonly RankedCard[]): RankedCard[] | null {
  if (cards.length !== 5) return null;
  const ranks = cards.map((c) => c.rank);
  if (new Set(ranks).size !== 5) return null;
  // As alto (A=14)
  const high = [...cards].sort((a, b) => a.rank - b.rank);
  if (isConsecutive(high.map((c) => c.rank))) return high;
  // As bajo (A=1): 10-J-Q-K-A NO; A-2-3-4-5 SI
  if (ranks.includes(14)) {
    const lowVal = (c: RankedCard) => (c.rank === 14 ? 1 : c.rank);
    const low = [...cards].sort((a, b) => lowVal(a) - lowVal(b));
    if (isConsecutive(low.map(lowVal))) return low;
  }
  return null;
}

function isRoyal(straight: readonly RankedCard[]): boolean {
  const set = new Set<number>(straight.map((c) => c.rank));
  return [10, 11, 12, 13, 14].every((r) => set.has(r));
}

function setOf(cards: readonly Card[]): Set<string> {
  return new Set(cards.map((c) => c.id));
}

/** Agrupa por rango. */
function groupByRank(cards: readonly RankedCard[]): RankedCard[][] {
  const groups = new Map<number, RankedCard[]>();
  for (const c of cards) {
    const g = groups.get(c.rank) ?? [];
    g.push(c);
    groups.set(c.rank, g);
  }
  return [...groups.values()];
}

export function detectHand(played: readonly Card[]): DetectedHand {
  const cards = played.filter(isRanked);
  if (cards.length === 0) return { type: 'carta_alta', scoring: new Set() };

  const n = cards.length;
  const groups = groupByRank(cards);
  const isFlush = n === 5 && new Set(cards.map((c) => c.suit)).size === 1;
  const straight = findStraight(cards);

  const five = groups.find((g) => g.length === 5);
  if (five) return { type: isFlush ? 'quinteto_color' : 'quinteto', scoring: setOf(five) };

  if (straight && isFlush) {
    return {
      type: isRoyal(straight) ? 'escalera_real' : 'escalera_color',
      scoring: setOf(straight),
    };
  }

  const four = groups.find((g) => g.length === 4);
  if (four) return { type: 'poker', scoring: setOf(four) };

  const three = groups.find((g) => g.length === 3);
  const rankOf = (g: readonly RankedCard[]): number => g[0]?.rank ?? 0;
  const pairs = groups.filter((g) => g.length === 2).sort((a, b) => rankOf(b) - rankOf(a));

  if (three && pairs.length >= 1) {
    return { type: 'full', scoring: setOf([...three, ...(pairs[0] ?? [])]) };
  }
  if (isFlush) return { type: 'color', scoring: setOf(cards) };
  if (straight) return { type: 'escalera', scoring: setOf(straight) };
  if (three) return { type: 'trio', scoring: setOf(three) };
  if (pairs.length >= 2) {
    return { type: 'doble_pareja', scoring: setOf([...(pairs[0] ?? []), ...(pairs[1] ?? [])]) };
  }
  if (pairs.length === 1) return { type: 'pareja', scoring: setOf(pairs[0] ?? []) };

  // Carta alta: la de mayor rango (A=14 alto).
  let high: RankedCard | undefined;
  for (const c of cards) if (high === undefined || c.rank > high.rank) high = c;
  return { type: 'carta_alta', scoring: high ? new Set([high.id]) : new Set() };
}
