// Objetivos de puntuacion por Umbral y tipo de nodo (§9.3), con varianza determinista ±5%.
import { nextInt, type RngState } from '@umbral/shared';

export type ObjectiveKind = 'combate' | 'elite' | 'jefe';

const TABLE: Record<number, Record<ObjectiveKind, number>> = {
  1: { combate: 300, elite: 450, jefe: 800 },
  2: { combate: 750, elite: 1150, jefe: 1900 },
  3: { combate: 1800, elite: 2700, jefe: 4400 },
  4: { combate: 4200, elite: 6300, jefe: 10000 },
  5: { combate: 9500, elite: 14000, jefe: 22000 },
  6: { combate: 21000, elite: 31000, jefe: 48000 },
  7: { combate: 46000, elite: 68000, jefe: 105000 },
  8: { combate: 100000, elite: 150000, jefe: 230000 },
};

/** Objetivo base sin varianza. Umbral 9+ (Infinito): ~×2 por Umbral desde el 8 (§9.6). */
export function baseObjective(umbral: number, kind: ObjectiveKind): number {
  const row = TABLE[Math.min(8, Math.max(1, umbral))];
  const base = row ? row[kind] : (TABLE[8]?.[kind] ?? 0);
  if (umbral <= 8) return base;
  return Math.round(base * 2 ** (umbral - 8));
}

/** Objetivo con varianza determinista ±5% (usa el stream del mapa). */
export function objectiveFor(umbral: number, kind: ObjectiveKind, rng: RngState): number {
  const base = baseObjective(umbral, kind);
  const pct = nextInt(rng, -5, 5); // ±5%
  return Math.round((base * (100 + pct)) / 100);
}
