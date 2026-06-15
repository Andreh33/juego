// @umbral/content — TODO el contenido como data tipada. El engine lo interpreta (§5.4).
import type { ContentRegistry } from '@umbral/engine';
import { CONSUMABLES } from './consumables';
import { GENERAL_RELICS } from './relics';
import { VESSEL_RELICS } from './vessel-relics';
import { VESSELS } from './vessels';

function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) out[item.id] = item;
  return out;
}

/** Registro de contenido que se inyecta en el engine (reduce/replay). */
export const REGISTRY: ContentRegistry = {
  relics: byId([...GENERAL_RELICS, ...VESSEL_RELICS]),
  consumables: byId(CONSUMABLES),
  vessels: byId(VESSELS),
};

export { CONSUMABLES } from './consumables';
export { GENERAL_RELICS } from './relics';
export { VESSEL_RELICS } from './vessel-relics';
export { VESSELS } from './vessels';
