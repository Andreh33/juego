// Eventos (§11.9) y Santuarios (§10.5) como DATA: lamina + opciones de riesgo/recompensa.
// Deterministas (stream de eventos). El engine aplica el efecto de la opcion elegida.
import type { Rarity } from '@umbral/shared';

export interface EventOptionEffect {
  goldDelta?: number;
  sanityDelta?: number;
  /** Cambio en velas actuales (clamp a maxCandles). */
  candleDelta?: number;
  /** Cambio en velas maximas. */
  maxCandleDelta?: number;
  /** Cambio en cordura maxima. */
  maxSanityDelta?: number;
  /** Destruye N cartas aleatorias del mazo (depurar/riesgo). */
  destroyRandomDeck?: number;
  /** Otorga una reliquia aleatoria de esta rareza (si hay slot). */
  gainRelicRarity?: Rarity;
  /** Otorga un consumible aleatorio de este tipo (si hay slot). */
  gainConsumableKind?: 'augurio' | 'sello' | 'conjuro';
}

export interface EventOption {
  id: string;
  label: string;
  effect: EventOptionEffect;
}

export interface EventDef {
  id: string;
  name: string;
  lore: string;
  /** true = nodo Santuario (§10.5); false/undefined = Evento (§11.9). */
  santuario?: boolean;
  options: EventOption[];
}
