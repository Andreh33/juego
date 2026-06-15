// Puente reactivo engine<->React (§3): el store NO tiene logica de juego. Solo guarda el
// GameState, despacha acciones al reducer puro (con el REGISTRY de contenido) y expone los
// FeelEvent del ultimo paso. Toda la logica vive en @umbral/engine.
'use client';
import { REGISTRY } from '@umbral/content';
import { type FeelEvent, type GameAction, type GameState, reduce, startRun } from '@umbral/engine';
import type { RunMode, VesselId } from '@umbral/shared';
import { create } from 'zustand';

export interface RunConfig {
  vessel: VesselId;
  veil: number;
  mode: RunMode;
  seed?: string;
}

interface GameStore {
  state: GameState | null;
  events: FeelEvent[];
  /** Mensaje de la ultima accion ilegal (para feedback ligero). */
  lastError: string | null;
  newRun: (cfg: RunConfig) => void;
  dispatch: (action: GameAction) => void;
  abandon: () => void;
}

function randomSeed(): string {
  // Solo UI: la aleatoriedad del seed inicial no afecta al determinismo del engine.
  const n = Math.floor(Math.random() * 0xffffffff);
  return `seed-${n.toString(36)}-${Date.now().toString(36)}`;
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  events: [],
  lastError: null,
  newRun: (cfg) => {
    const seed = cfg.seed && cfg.seed.length > 0 ? cfg.seed : randomSeed();
    const state = startRun(
      {
        type: 'START_RUN',
        seed,
        vessel: cfg.vessel,
        ruleset: 1,
        veil: cfg.veil,
        mode: cfg.mode,
      },
      REGISTRY,
    );
    set({ state, events: [], lastError: null });
  },
  dispatch: (action) => {
    const cur = get().state;
    if (!cur) return;
    const { state, events } = reduce(cur, action, REGISTRY);
    const err = events.find((e) => e.t === 'error');
    set({
      state,
      events,
      lastError: err && 'reason' in err ? (err.reason as string) : null,
    });
  },
  abandon: () => set({ state: null, events: [], lastError: null }),
}));
