// FeelEvent — eventos COSMETICOS emitidos por reduce (§25, §5.2). Ignorarlos no cambia
// la correccion del estado: reproducir el run sin ellos da el mismo GameState (INV-2).
import type { CardId } from '@umbral/shared';

export type FeelEvent =
  | { t: 'cardScored'; cardId: CardId; chips: number; mult: number; retrigger?: boolean }
  | { t: 'relicFired'; relicId: string; value: number; kind: 'fichas' | 'mult' | 'xmult' }
  | { t: 'scorePop'; total: number }
  | { t: 'shake'; intensity: number }
  | { t: 'slowmo'; ms: number }
  | { t: 'sanityShift'; delta: number }
  | { t: 'cardDestroyed'; cardId: CardId }
  | { t: 'bossReact'; bossId: string; cue: string }
  | { t: 'error'; reason: string };
