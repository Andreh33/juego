// Construccion del mazo estandar de 52 cartas (§7.1). Determinista: mismos ids siempre.
import { type Card, RANKS, SUITS } from '@umbral/shared';
import type { VesselDef } from './content/vessel';

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

/** Mazo inicial de un Recipiente (§8): tamano + mejoras/sellos sembrados. */
export function buildVesselDeck(vessel: VesselDef): Card[] {
  let deck = buildStandardDeck();
  // Adelgazar: quita las cartas de menor rango hasta deckSize (mazo mas fino = mas control).
  if (vessel.deckSize < deck.length) {
    const toRemove = deck.length - vessel.deckSize;
    const removeIds = new Set(
      [...deck]
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .slice(0, toRemove)
        .map((c) => c.id),
    );
    deck = deck.filter((c) => !removeIds.has(c.id));
  }
  // Mejora inicial: una por palo (Coleccionista: 1 Grabado por palo).
  const pe = vessel.preEnhanced;
  if (pe?.oncePerSuit) {
    const seen = new Set<string>();
    deck = deck.map((c) => {
      if (c.suit && !seen.has(c.suit)) {
        seen.add(c.suit);
        return { ...c, enhancement: pe.enhancement };
      }
      return c;
    });
  }
  // Sellos iniciales (Profano: 2 Violeta).
  const ps = vessel.preSealed;
  if (ps) {
    let n = ps.count;
    deck = deck.map((c) => {
      if (n > 0) {
        n--;
        return { ...c, seal: ps.seal };
      }
      return c;
    });
  }
  return deck;
}
