// @umbral/content — TODO el contenido como data tipada. El engine lo interpreta (§5.4).
import type { ContentRegistry, UnlockDef } from '@umbral/engine';
import { BOSSES } from './bosses';
import { CONSUMABLES } from './consumables';
import { COSMETICS } from './cosmetics';
import { ELITES } from './elites';
import { EVENTS } from './events';
import { GENERAL_RELICS } from './relics';
import { UNLOCKS } from './unlocks';
import { VESSEL_RELICS } from './vessel-relics';
import { VESSELS } from './vessels';
import { VOUCHERS } from './vouchers';

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
  vouchers: byId(VOUCHERS),
  bosses: byId([...BOSSES, ...ELITES]),
  events: byId(EVENTS),
};

/** Todos los desbloqueos (arbol §12.2 + cosmeticos), para el motor de progresion. */
export const ALL_UNLOCKS: UnlockDef[] = [...UNLOCKS, ...COSMETICS];

export { ACHIEVEMENTS } from './achievements';
export { BOSSES } from './bosses';
export { CONSUMABLES } from './consumables';
export { COSMETICS } from './cosmetics';
export { ELITES } from './elites';
export { EVENTS } from './events';
export * from './modes';
export { GENERAL_RELICS } from './relics';
export { UNLOCKS } from './unlocks';
export { VESSEL_RELICS } from './vessel-relics';
export { VESSELS } from './vessels';
export { VOUCHERS } from './vouchers';
