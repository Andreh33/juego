// Recipientes (clases jugables, §8). Cada uno: mazo inicial, reliquia inicial, recursos, sesgo
// y MECANICA unica. El engine interpreta estos campos (mecanica = conjunto fijo de 6 clases core).
import type { Enhancement, Seal, VesselId } from '@umbral/shared';
import type { Effect } from '../scoring/effects';

export type VesselMechanic = 'none' | 'eco' | 'catalogo' | 'frenesi' | 'premonicion';

export interface VesselDef {
  id: VesselId;
  name: string;
  lore: string;
  /** Tamaño del mazo inicial (52 estandar; Vidente 44, Profano 48). */
  deckSize: number;
  /** Mejora inicial sembrada (Coleccionista: 1 Grabado por palo). */
  preEnhanced?: { enhancement: Enhancement; oncePerSuit?: boolean };
  /** Sellos iniciales (Profano: 2 Violeta). */
  preSealed?: { seal: Seal; count: number };
  startingRelicId: string;
  startingGold: number;
  baseCombat: { hands: number; discards: number; handSize: number };
  /** Factor del objetivo de combate (Usurero 1.05). */
  objectiveFactor: number;
  /** Multiplicador del bono de Cordura §10.3 (Profano 2 — "Comunion"). */
  corduraBonusMult: number;
  /** Divisor del interes (5 base; Usurero "Capital" 4). */
  interestDivisor: number;
  /** Efectos innatos aplicados cada mano (Usurero "Capital": +1 ficha por moneda). */
  innate?: Effect[];
  mechanic: VesselMechanic;
  mechanicParams?: {
    perRepeat?: number; // Eco: +mult por repetir tipo de mano
    multPerFrenesi?: number; // Frenesi: +mult por punto
    fichasPerSuit?: number; // Catalogo: +fichas por palo completado
    threshold?: number; // Catalogo: nº de mejoras para "completar" un palo
  };
}
