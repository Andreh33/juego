// @umbral/content — TODO el contenido como data tipada. El engine lo interpreta (§5.4).
import type { ContentRegistry } from '@umbral/engine';
import { CONSUMABLES } from './consumables';
import { GENERAL_RELICS } from './relics';

function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) out[item.id] = item;
  return out;
}

/** Registro de contenido que se inyecta en el engine (reduce/replay). */
export const REGISTRY: ContentRegistry = {
  relics: byId(GENERAL_RELICS),
  consumables: byId(CONSUMABLES),
};

export { CONSUMABLES } from './consumables';
export { GENERAL_RELICS } from './relics';
