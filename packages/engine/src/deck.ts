// Construccion del mazo estandar de 52 cartas (§7.1). Determinista: mismos ids siempre.
import { type Card, RANKS, SUITS } from '@umbral/shared';

/** Id estable de una carta del mazo base. Las copias (augurios) anadiran sufijo en bloques futuros. */
export function baseCardId(suit: string, rank: number): string {
  return `${suit}_${rank}`;
}

/** 52 cartas: 4 palos x 13 rangos, sin mejora ni sello. */
export function buildStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: baseCardId(suit, rank), suit, rank, enhancement: null, seal: null });
    }
  }
  return deck;
}
