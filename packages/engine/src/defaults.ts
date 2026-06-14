// Valores base del run (§9.3, §9.5, §10.1, §11.1, §11.2). Las variaciones por Recipiente
// (Bloque 8), Velo (Bloque 17) y mapa (Bloque 4) se aplican encima de estos.

export const BASE_CANDLES = 3; // §9.5
export const BASE_SANITY = 100; // §10.1
export const BASE_GOLD = 0;
export const BASE_RELIC_SLOTS = 5; // §11.1
export const BASE_CONSUMABLE_SLOTS = 2; // §11.2

// Recursos por combate (§9.3).
export const BASE_HANDS = 4;
export const BASE_DISCARDS = 3;
export const BASE_HAND_SIZE = 8;

/** Limite de cartas seleccionables para jugar una mano (§7.2). */
export const MAX_SELECTED = 5;

/**
 * Objetivo de combate provisional para el Bloque 2 (= Umbral 1 combate, §9.3).
 * En el Bloque 4 el objetivo lo fija el nodo del mapa.
 */
export const PLACEHOLDER_OBJECTIVE = 300;
