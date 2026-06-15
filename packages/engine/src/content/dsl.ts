// Modelo de datos de contenido (§5.4). El engine interpreta estos objetos; packages/content
// solo aporta los datos. Reliquias = data + efectos declarativos; cero `if`-por-id en el engine.
import type { Enhancement, Rarity, Seal, VesselId } from '@umbral/shared';
import type { Condition, Effect } from '../scoring/effects';
import type { HandType } from '../types';
import type { VesselDef } from './vessel';

/** Disparador de un escalador (reliquia que crece durante el run). */
export type ScalerTrigger =
  | { on: 'handPlayed'; handType?: HandType }
  | { on: 'cardScored' }
  | { on: 'discard' }
  | { on: 'bossDefeated' }
  | { on: 'enhanced' } // al mejorar una carta (augurio)
  | { on: 'cardDestroyed' }; // al destruir una carta

export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  flavor: string;
  tags: string[];
  vessel?: VesselId;
  // ---- Contribuciones de puntuacion (subset de hooks §5.4) ----
  onCardScored?: Effect[];
  onHandPlayed?: Effect[];
  xMult?: Effect[];
  retrigger?: { when: Condition; times: number; firstOnly?: boolean };
  // ---- Escaladora: crece durante el run (estado en RelicInstance.state.acc) ----
  scaler?: { trigger: ScalerTrigger; add: number; as: 'fichas' | 'mult' | 'xmult' };
  // ---- Modificadores de combate (al iniciar combate) ----
  modifyCombat?: { hands?: number; discards?: number; handSize?: number };
  // ---- Modificadores GLOBALES del scoring (Igualador, Sin Fondo, Eternidad, Caleidoscopio) ----
  cardChipOverride?: number;
  noRetriggerCap?: boolean;
  extraRetriggerPerSource?: number;
  wildSuit?: boolean;
  // ---- Hooks de run (§5.4) ----
  /** Al obtener la reliquia (p.ej. -1 vela maxima, +oro). */
  onAcquire?: { maxCandlesDelta?: number; sanityDelta?: number; goldDelta?: number };
  /** Al iniciar cada combate (Corona de Espinas, Sacrificio). */
  onCombatStart?: { sanityDelta?: number; destroyRandomDeck?: number };
  /** Al ganar un combate (Hambre). */
  onCombatEnd?: { destroyRandomDeck?: number };
  /** Al terminar un Umbral (Diezmo: factor de oro). */
  onUmbralEnd?: { goldFactor?: number };
}

export type ConsumableKind = 'augurio' | 'sello' | 'conjuro';

export interface ConsumableDef {
  id: string;
  name: string;
  kind: ConsumableKind;
  flavor: string;
  /** Augurio: mejora a aplicar a cartas objetivo. */
  applyEnhancement?: Enhancement;
  /** Augurio: sello a aplicar a cartas objetivo. */
  applySeal?: Seal;
  /** Augurio: maximo de cartas objetivo. */
  maxTargets?: number;
  /** Sello: sube +1 el nivel de un tipo de mano (o 'all'). */
  levelUpHand?: HandType | 'all';
}

export interface ContentRegistry {
  relics: Record<string, RelicDef>;
  consumables: Record<string, ConsumableDef>;
  vessels: Record<string, VesselDef>;
}

export const EMPTY_REGISTRY: ContentRegistry = { relics: {}, consumables: {}, vessels: {} };
