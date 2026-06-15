// Economia de oro (§13.3).
import type { ObjectiveKind } from './objectives';

/** Recompensa de oro por ganar un combate: +5 normal, +8 elite, +12 jefe. */
export function combatGoldReward(kind: ObjectiveKind): number {
  if (kind === 'jefe') return 12;
  if (kind === 'elite') return 8;
  return 5;
}

/** Oro por saltar la recompensa (§9.7). */
export const SKIP_REWARD_GOLD = 6;

/** Interes: +1 por cada 5 de oro en mano, tope +5 (§13.3). */
export function interest(gold: number, cap = 5): number {
  return Math.min(cap, Math.floor(Math.max(0, gold) / 5));
}
