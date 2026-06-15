// Progresion persistente (§12.2 desbloqueos, §12.3 logros). Modelo de datos serializable.
// El engine evalua condiciones declarativas; el contenido aporta los catalogos (UnlockDef[],
// AchievementDef[]). Cero `if`-por-id (§5.4).

import type { VesselId } from '@umbral/shared';

/** Condicion declarativa sobre el "stat bag" (perfil + resumen de run aplanados). */
export type ProgCond =
  | { key: string; gte: number }
  | { key: string; lte: number }
  | { key: string; eq: number }
  | { all: ProgCond[] }
  | { any: ProgCond[] };

export type UnlockKind = 'recipiente' | 'reliquia' | 'mazo' | 'mano' | 'jefe' | 'cosmetico';

export interface UnlockDef {
  id: string;
  name: string;
  desc: string;
  kind: UnlockKind;
  /** Id del contenido que se desbloquea (recipiente/reliquia/mano/...). */
  payload?: string;
  cond: ProgCond;
}

export type AchievementCategory =
  | 'progreso'
  | 'puntuacion'
  | 'builds'
  | 'riesgo'
  | 'profundidad'
  | 'coleccionista'
  | 'secreto';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  secret?: boolean;
  cond: ProgCond;
}

/** Estadisticas persistentes del jugador (lifetime). Se mergea de forma no destructiva. */
export interface ProfileStats {
  runsPlayed: number;
  runsWon: number;
  goldEarned: number;
  bestHandScore: number;
  maxDepth: number;
  /** Recipientes con los que se ha ganado al menos 1 run. */
  vesselsWon: VesselId[];
  /** Velo maximo superado por Recipiente. */
  veilCleared: Partial<Record<VesselId, number>>;
  relicsSeen: string[];
  bossesDefeated: string[];
  eventsResolved: string[];
  /** Maximas reliquias Malditas llevadas a la vez (lifetime). */
  maxMalditasHeld: number;
  unlocked: string[];
  achievements: string[];
}

/** Resumen de una run terminada (derivado del GameState final). */
export interface RunSummary {
  won: boolean;
  vessel: VesselId;
  veil: number;
  /** Umbral alcanzado. */
  depth: number;
  mode: string;
  bestHandScore: number;
  minSanity: number;
  touchedSanity0: boolean;
  candlesLost: number;
  goldPeak: number;
  goldEarned: number;
  maxDiscardsUsed: number;
  malditasHeld: number;
  relicCount: number;
  relicsHeld: string[];
  enhancedCards: number;
  noXmultRelics: boolean;
  noFlatRelics: boolean;
  singleSuitDeck: boolean;
  bossesDefeated: string[];
  eventsResolved: string[];
}
