// Tipos de mano: fichas y mult base por nivel (§7.4). Cada nivel suma fichas y mult.
import type { HandType } from '../types';

interface HandBaseRow {
  fichas1: number; // fichas Nv.1
  mult1: number; // mult Nv.1
  fichasPerLevel: number;
  multPerLevel: number;
}

const HAND_BASE: Record<HandType, HandBaseRow> = {
  carta_alta: { fichas1: 5, mult1: 1, fichasPerLevel: 10, multPerLevel: 1 },
  pareja: { fichas1: 10, mult1: 2, fichasPerLevel: 15, multPerLevel: 1 },
  doble_pareja: { fichas1: 20, mult1: 2, fichasPerLevel: 20, multPerLevel: 1 },
  trio: { fichas1: 30, mult1: 3, fichasPerLevel: 20, multPerLevel: 2 },
  escalera: { fichas1: 30, mult1: 4, fichasPerLevel: 30, multPerLevel: 3 },
  color: { fichas1: 35, mult1: 4, fichasPerLevel: 15, multPerLevel: 2 },
  full: { fichas1: 40, mult1: 4, fichasPerLevel: 25, multPerLevel: 2 },
  poker: { fichas1: 60, mult1: 7, fichasPerLevel: 30, multPerLevel: 3 },
  escalera_color: { fichas1: 100, mult1: 8, fichasPerLevel: 40, multPerLevel: 4 },
  escalera_real: { fichas1: 100, mult1: 8, fichasPerLevel: 40, multPerLevel: 4 },
  // Especiales de UMBRAL (§7.4): la biblia solo da Nv.1. Incrementos por nivel PROVISIONALES
  // (a confirmar por el arquitecto cuando entren en contenido extendido, Bloque 22).
  quinteto: { fichas1: 120, mult1: 12, fichasPerLevel: 40, multPerLevel: 4 },
  quinteto_color: { fichas1: 160, mult1: 16, fichasPerLevel: 50, multPerLevel: 5 },
  hilera_negra: { fichas1: 140, mult1: 14, fichasPerLevel: 45, multPerLevel: 4 },
};

export interface HandBase {
  fichas: number;
  mult: number;
}

/** Fichas y mult base para un tipo de mano en un nivel dado (nivel >= 1). */
export function baseForLevel(type: HandType, level: number): HandBase {
  const row = HAND_BASE[type];
  const lv = Math.max(1, level);
  return {
    fichas: row.fichas1 + row.fichasPerLevel * (lv - 1),
    mult: row.mult1 + row.multPerLevel * (lv - 1),
  };
}
