// GameAction — el unico modo de mutar el estado (§5.2). Event-sourcing: el action log
// es la lista ordenada de acciones aplicadas (sin TICK) y reconstruye el run.
import type { CardId, RunMode, VesselId } from '@umbral/shared';

/** Mutadores de inicio de run (modos custom/desafio, §12.7/§12.8). */
export interface RunModifiers {
  startingCandles?: number;
  startingSanity?: number;
  startingGold?: number;
  hands?: number;
  discards?: number;
  handSize?: number;
  /** Tamano de mazo (recorta del mazo del Recipiente; Mazo Minimo, etc.). */
  deckSize?: number;
  /** Flags de desafio no expresables aun (noShop, soloEscaleras...). Se leen en bloques futuros. */
  flags?: string[];
}

export type GameAction =
  | {
      type: 'START_RUN';
      seed: string;
      vessel: VesselId;
      ruleset: number;
      modifiers?: RunModifiers;
      mode?: RunMode;
      dailyDate?: string;
      weeklyId?: string;
      challengeId?: string;
    }
  | { type: 'SELECT_CARD'; cardId: CardId }
  | { type: 'DESELECT_CARD'; cardId: CardId }
  | { type: 'REORDER_HAND'; order: CardId[] }
  | { type: 'PLAY_HAND' }
  | { type: 'DISCARD' }
  | { type: 'BUY'; shopItemId: string }
  | { type: 'SELL_RELIC'; relicId: string }
  | { type: 'REROLL_SHOP' }
  | { type: 'USE_CONSUMABLE'; consumableId: string; targets: CardId[] }
  | { type: 'REORDER_RELICS'; order: string[] }
  | { type: 'CHOOSE_NODE'; nodeId: string }
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  | { type: 'PICK_REWARD'; rewardId: string }
  | { type: 'SKIP_REWARD' }
  | { type: 'REST_ACTION'; kind: 'heal' | 'upgrade' | 'remove'; target?: string }
  | { type: 'SCRY_KEEP'; cardId: CardId }
  | { type: 'SCRY_BURY'; cardId: CardId }
  | { type: 'NEXT' }
  // SOLO timers cosmeticos; NO afecta logica ni va al action log.
  | { type: 'TICK'; ms: number };

export type GameActionType = GameAction['type'];

/** Una START_RUN ya tipada (util para el constructor de run). */
export type StartRunAction = Extract<GameAction, { type: 'START_RUN' }>;
