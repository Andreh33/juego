// Jefes (§11.7). Cada uno: lore, tell (visual/sonoro), infeccion de orla (§6.7) y un MODIFICADOR
// mecanico declarativo que el engine interpreta. Los efectos solo de render (orla/audio/
// alucinaciones) se describen aqui y se cablean en bloques visuales (13/18).
import type { Suit } from '@umbral/shared';

export interface BossModifier {
  /** Factor del objetivo del jefe. */
  objectiveFactor?: number;
  /** +/- manos en el combate de jefe. */
  handsDelta?: number;
  /** +/- descartes. */
  discardsDelta?: number;
  /** Destruye N cartas del mazo al iniciar (este combate; el mazo se reduce). */
  destroyDeckAtStart?: number;
  /** Pierde N Cordura por mano jugada. */
  sanityPerHand?: number;
  /** Pierde N monedas por mano jugada. */
  coinsPerHand?: number;
  /** Las figuras dan la mitad de fichas. */
  figuresHalf?: boolean;
  /** Palos silenciados (no dan fichas). */
  silenceSuits?: Suit[];
  /** Reduce los ×mult de reliquia. */
  relicXMultPenalty?: number;
  /** Nº de fases (cosmetico/estructura; el detalle por fase llega con render). */
  phases?: number;
}

export interface BossDef {
  id: string;
  name: string;
  sima: 1 | 2 | 3;
  lore: string;
  tell: string;
  orla: string;
  modifier: BossModifier;
  secret?: boolean;
  /** true = modificador de Elite (§11.8), no de jefe; excluido del pool de jefes. */
  elite?: boolean;
}
