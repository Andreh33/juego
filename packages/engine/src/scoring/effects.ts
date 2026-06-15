// DSL de efectos declarativo (§5.4, §22.5). Efectos = DATA, no funciones (INV §5.4, §24.8).
// El engine interpreta; el contenido (packages/content) solo aporta estos objetos.
import type { Rank, Suit } from '@umbral/shared';
import type { HandType } from '../types';

/** Condicion declarativa, evaluada contra el contexto de puntuacion. */
export type Condition =
  | { type: 'always' }
  // Por carta (onCardScored / retrigger):
  | { type: 'suit'; suit: Suit }
  | { type: 'rank'; rank: Rank }
  | { type: 'isFace' } // J/Q/K
  | { type: 'isAce' }
  | { type: 'hasEnhancement' }
  // Globales (onHandPlayed / xMult):
  | { type: 'multAtLeast'; value: number }
  | { type: 'handType'; any: HandType[] }
  | { type: 'exactlyCards'; count: number }
  | { type: 'atLeastCards'; count: number }
  | { type: 'goldAtLeast'; value: number }
  | { type: 'sanityBelow'; value: number }
  | { type: 'firstHand' }
  | { type: 'allFourSuits' }
  | { type: 'handHasFigure' }
  | { type: 'not'; cond: Condition };

/** Conteos del contexto que escalan un efecto (efecto.n × conteo). */
export type CountRef =
  | 'playedCards'
  | 'cardsInHandNotPlayed'
  | 'figuresPlayed'
  | 'acesPlayed'
  | 'gold'
  | 'xmultRelics'
  | 'bossesDefeated';

export type Effect =
  | { kind: 'addFichas'; n: number; per?: CountRef; max?: number; when?: Condition }
  | { kind: 'addMult'; n: number; per?: CountRef; max?: number; when?: Condition }
  | { kind: 'xFichas'; factor: number; when?: Condition }
  | { kind: 'xMult'; factor: number; perStep?: { per: CountRef; step: number }; when?: Condition };

/** Contribucion de puntuacion de una reliquia (resuelta del RelicDef + estado de instancia). */
export interface ScoringRelic {
  defId: string;
  onCardScored?: Effect[];
  onHandPlayed?: Effect[];
  xMult?: Effect[];
  retrigger?: { when: Condition; times: number };
}

/** Contexto global del scoring (lo aporta reduce: §10.3, economia, etc.). */
export interface ScoreContext {
  gold: number;
  sanity: number;
  isFirstHand: boolean;
  bossesDefeated: number;
  /** Nº de cartas en mano que NO se jugaron (para Mano Abierta, etc.). */
  cardsInHandNotPlayed: number;
  /** Nº de reliquias con ×mult (para Convergencia, etc.). */
  xmultRelics: number;
}
