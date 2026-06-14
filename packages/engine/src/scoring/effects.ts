// Modelo de efectos declarativo MINIMO (semilla del DSL de §5.4).
// El DSL completo (§22.5, ausente en la biblia) y el content registry llegan en el Bloque 5.
// Aqui solo lo necesario para el motor de puntuacion y sus tests (reliquias de los tests de oro,
// condicionales por palo/rango, y un condicional sobre el mult para probar el orden de reliquias).
//
// IMPORTANTE: efectos = DATA, no funciones arbitrarias (INV de §5.4, §24.8). El engine los
// interpreta; el contenido (Bloque 5) solo aporta estos objetos.
import type { Rank, Suit } from '@umbral/shared';

export type Condition =
  | { type: 'always' }
  | { type: 'suit'; suit: Suit }
  | { type: 'rank'; rank: Rank }
  | { type: 'isFace' } // J/Q/K
  | { type: 'isAce' }
  | { type: 'hasEnhancement' }
  | { type: 'multAtLeast'; value: number }; // condicional sobre el mult en curso (orden importa)

export type Effect =
  | { kind: 'addFichas'; n: number; when?: Condition }
  | { kind: 'addMult'; n: number; when?: Condition }
  | { kind: 'xMult'; factor: number; when?: Condition };

/** Aporte de puntuacion de una reliquia (subconjunto de los hooks de §5.4). */
export interface RelicScoreDef {
  defId: string;
  /** Efectos aditivos por cada carta puntuada (paso 3d). `when` puede mirar la carta. */
  onCardScored?: Effect[];
  /** Efectos aditivos globales tras la mano (paso 4). */
  onHandPlayed?: Effect[];
  /** Multiplicadores aplicados en el paso 5, en orden de reliquia. */
  xMult?: Effect[];
  /** Re-disparos por carta: `times` extra cuando la carta cumple `when` (§7.6). */
  retrigger?: { when: Condition; times: number };
}
