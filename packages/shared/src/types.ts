// Tipos base compartidos (subconjunto canonico de §25 "NO REINVENTAR").
// Aqui viven solo los primitivos transversales (cartas, ids, rarezas, fases). El GameState
// completo y las GameAction llegan en el Bloque 2 (packages/engine usa estos como cimiento).

// ---- Cartas ----
/** Palos tematicos. Ids neutros para el engine: CALIZ(corazon), LLAVE(diamante), HUESO(trebol), OJO(pica). */
export type Suit = 'CALIZ' | 'LLAVE' | 'HUESO' | 'OJO';

/** Rango: 2..10, 11=J, 12=Q, 13=K, 14=A. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const SUITS = ['CALIZ', 'LLAVE', 'HUESO', 'OJO'] as const satisfies readonly Suit[];
export const RANKS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const satisfies readonly Rank[];

/** Mejora de carta (una por carta). null = sin mejora. */
export type Enhancement =
  | 'grabado'
  | 'marca'
  | 'untado'
  | 'dorado'
  | 'cristal'
  | 'piedra'
  | 'espejo'
  | null;

/** Sello de carta (uno por carta, independiente de la mejora). null = sin sello. */
export type Seal = 'ocre' | 'sangre' | 'verdin' | 'violeta' | 'dorado' | null;

/** Identificador unico por instancia de carta en el mazo. */
export type CardId = string;

export interface Card {
  id: CardId;
  /** null si es Piedra (sin rango/palo). */
  suit: Suit | null;
  /** null si es Piedra. */
  rank: Rank | null;
  enhancement: Enhancement;
  seal: Seal;
  /** Cargas restantes de Cristal (fragilidad 1/5). */
  crystalCharges?: number;
}

// ---- Contenido / run ----
export type Rarity = 'comun' | 'pococomun' | 'rara' | 'espectral' | 'maldita' | 'legendaria';

export type VesselId = 'heraldo' | 'vidente' | 'usurero' | 'coleccionista' | 'bestia' | 'profano';

export type NodeType =
  | 'combate'
  | 'elite'
  | 'tienda'
  | 'evento'
  | 'tesoro'
  | 'descanso'
  | 'santuario'
  | 'jefe';

export type RunPhase =
  | 'mapa'
  | 'combate'
  | 'tienda'
  | 'evento'
  | 'recompensa'
  | 'descanso'
  | 'santuario'
  | 'jefe'
  | 'fin';

export type RunMode = 'carrera' | 'diario' | 'semanal' | 'infinito' | 'desafio' | 'custom';
