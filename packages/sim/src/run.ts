// Conduce una run completa con una politica y devuelve su resultado + telemetria de uso.
import {
  type ContentRegistry,
  type GameState,
  type RunSummary,
  reduce,
  startRun,
  summarizeRun,
} from '@umbral/engine';
import type { VesselId } from '@umbral/shared';
import { decide, MEDIUM, type Policy } from './policy';

export interface SimRunOpts {
  seed: string;
  vessel: VesselId;
  veil: number;
  policy?: Policy;
  /** Tope de acciones (evita bucles si la politica se atasca). */
  maxSteps?: number;
}

export interface SimRunResult {
  won: boolean;
  depth: number;
  score: number;
  steps: number;
  /** true si la run se corto por el tope de pasos (politica atascada). */
  stalled: boolean;
  summary: RunSummary;
  /** Reliquias que la run llego a poseer (para frecuencia de uso / reliquias muertas). */
  relicsHeld: string[];
}

export function simulateRun(registry: ContentRegistry, opts: SimRunOpts): SimRunResult {
  const policy = opts.policy ?? MEDIUM;
  const maxSteps = opts.maxSteps ?? 4000;
  let state: GameState = startRun(
    { type: 'START_RUN', seed: opts.seed, vessel: opts.vessel, ruleset: 1, veil: opts.veil },
    registry,
  );
  const relicsSeen = new Set<string>();
  let steps = 0;
  let stalled = false;
  while (state.phase !== 'fin' && steps < maxSteps) {
    for (const r of state.relics) relicsSeen.add(r.defId);
    const action = decide(state, registry, policy);
    if (!action) {
      stalled = true;
      break;
    }
    const next = reduce(state, action, registry).state;
    if (next === state) {
      // Accion ilegal (no muto el estado): la politica se atasco.
      stalled = true;
      break;
    }
    state = next;
    steps++;
  }
  for (const r of state.relics) relicsSeen.add(r.defId);
  if (steps >= maxSteps) stalled = true;
  const summary = summarizeRun(state, registry);
  return {
    won: summary.won,
    depth: summary.depth,
    score: state.runScore,
    steps,
    stalled,
    summary,
    relicsHeld: [...relicsSeen],
  };
}
