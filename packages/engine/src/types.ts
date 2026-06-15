// Modelo de datos canonico del run (§25). Todo serializable (INV-4).
import type { Card, NodeType, RngStreams, RunMode, RunPhase, VesselId } from '@umbral/shared';
import type { GameAction } from './actions';
import type { FeelEvent } from './events';

// ---- Tipos de mano (catalogo; la deteccion y los niveles llegan en el Bloque 3) ----
export type HandType =
  | 'carta_alta'
  | 'pareja'
  | 'doble_pareja'
  | 'trio'
  | 'escalera'
  | 'color'
  | 'full'
  | 'poker'
  | 'escalera_color'
  | 'escalera_real'
  // Especiales de UMBRAL (desbloqueables, §7.4). No activas al inicio.
  | 'quinteto'
  | 'quinteto_color'
  | 'hilera_negra';

/** Tipos de mano estandar, con nivel inicial al empezar un run. */
export const STANDARD_HAND_TYPES = [
  'carta_alta',
  'pareja',
  'doble_pareja',
  'trio',
  'escalera',
  'color',
  'full',
  'poker',
  'escalera_color',
  'escalera_real',
] as const satisfies readonly HandType[];

export interface HandLevel {
  level: number;
}

// ---- Instancias de contenido ----
export interface RelicInstance {
  defId: string;
  /** Las escaladoras guardan aqui su acumulado (§25). */
  state?: Record<string, number>;
}

export interface ConsumableInstance {
  defId: string;
}

// ---- Mapa (generacion real en el Bloque 4) ----
export interface MapNode {
  id: string;
  type: NodeType;
  row: number;
  next: string[];
  visited: boolean;
  /** Objetivo de puntuacion (combate/elite/jefe), fijado al generar el mapa (§9.3). */
  objective?: number;
}

export interface UmbralMap {
  umbral: number;
  nodes: MapNode[];
  currentNodeId: string | null;
}

// ---- Combate ----
export interface CombatState {
  objective: number;
  accumulated: number;
  handsLeft: number;
  discardsLeft: number;
  handSize: number;
  /** Cartas en mano (ids hacia GameState.deck). */
  hand: string[];
  /** Cartas seleccionadas, EN ORDEN (importa para el scoring, §7.3). */
  selected: string[];
  /** Resto del mazo barajado, del que se repone. */
  drawPile: string[];
  bossId?: string;
  /** Fases y contadores del modificador de jefe/elite. */
  bossState?: Record<string, number>;
  /** Bonos temporales del combate (Eco, Frenesi...). */
  combatRelicState?: Record<string, number>;
}

// ---- Tienda / recompensa (placeholders serializables; contenido en Bloques 9/10) ----
export type ShopItemKind = 'relic' | 'arcano' | 'vale';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  cost: number;
  /** Id del contenido (reliquia/consumible/vale) que entrega. */
  payloadId: string;
}

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
  rerollsThisVisit: number;
}

export type RewardOptionKind = 'relic' | 'arcano' | 'skip';

export interface RewardOption {
  id: string;
  kind: RewardOptionKind;
}

export interface RewardState {
  options: RewardOption[];
}

// ---- Resultado del run ----
export interface RunResult {
  status: 'won' | 'lost' | 'abandoned';
  depth: number;
  score: number;
}

// ---- GameState (raiz) ----
export interface GameState {
  schemaVersion: number;
  rulesetVersion: number;
  seed: string;
  vessel: VesselId;
  veil: number;
  mode: RunMode;
  rng: RngStreams;
  phase: RunPhase;
  umbral: number; // 1..8, 9+ = infinito
  sima: 1 | 2 | 3 | 4; // 4 = bajo el fondo (infinito)
  candles: number;
  maxCandles: number;
  sanity: number; // 0..100
  maxSanity: number;
  gold: number;
  /** Puntuacion total acumulada del run (suma de combates ganados; para el marcador, §15). */
  runScore: number;
  /** Jefes ya enfrentados en este run (para no repetir, §11.7). */
  usedBosses: string[];
  /** Recursos base por combate (defaults + modificadores; los vales/Recipiente los suben). */
  baseCombat: { hands: number; discards: number; handSize: number };
  deck: Card[];
  /** ORDEN importa (§7.3). */
  relics: RelicInstance[];
  relicSlots: number;
  consumables: ConsumableInstance[];
  consumableSlots: number;
  handLevels: Record<string, HandLevel>;
  vouchers: string[];
  map: UmbralMap | null;
  combat: CombatState | null;
  shop?: ShopState;
  pendingReward?: RewardState;
  pendingEvent?: { eventId: string };
  /** Action log (sin TICK): guardar/reanudar y repetir/compartir el run. */
  log: GameAction[];
  result?: RunResult;
}

/** Resultado de reduce: nuevo estado + eventos cosmeticos (§5.2). */
export interface ReduceResult {
  state: GameState;
  events: FeelEvent[];
}
