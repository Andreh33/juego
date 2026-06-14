// Valor en fichas base de una carta (§7.1): numero = su valor; J/Q/K = 10; A = 11.
import type { Card } from '@umbral/shared';

export function cardChipValue(card: Card): number {
  if (card.rank === null) return 0; // Piedra: sin rango (gana sus fichas por la mejora Piedra)
  if (card.rank >= 11 && card.rank <= 13) return 10; // J, Q, K
  if (card.rank === 14) return 11; // A
  return card.rank; // 2..10
}
