// Recompensa de combate: draft 1 de 3 (§9.7). El contenido real (reliquias/arcanos) llega en
// el Bloque 9; aqui van placeholders con la forma final para que el flujo sea jugable/testeable.
import type { RewardState } from '../types';
import type { ObjectiveKind } from './objectives';

/** Draft de recompensa. Elite/jefe garantizan reliquia (>=poco comun); aqui todo es placeholder. */
export function generateReward(_kind: ObjectiveKind): RewardState {
  return {
    options: [
      { id: 'reward.relic.placeholder', kind: 'relic' },
      { id: 'reward.arcano.placeholder', kind: 'arcano' },
      { id: 'reward.skip', kind: 'skip' },
    ],
  };
}
