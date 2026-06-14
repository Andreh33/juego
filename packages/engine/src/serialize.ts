// Serializacion de estado (INV-4). Carga con migracion en cadena (§5.5).
import { migrateSave } from './migrations';
import type { GameState } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Reconstruye un GameState desde JSON aplicando migraciones si el schemaVersion es antiguo.
 * La validacion Zod completa de bordes de red/save llega en el Bloque 14.
 */
export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as Record<string, unknown>;
  return migrateSave(raw) as unknown as GameState;
}
