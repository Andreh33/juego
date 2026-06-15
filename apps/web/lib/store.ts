// Puente reactivo engine<->React (§3): el store NO tiene logica de juego. Solo guarda el
// GameState, despacha acciones al reducer puro (con el REGISTRY de contenido) y expone los
// FeelEvent del ultimo paso. Toda la logica vive en @umbral/engine.
'use client';
import { REGISTRY } from '@umbral/content';
import { type FeelEvent, type GameAction, type GameState, reduce, startRun } from '@umbral/engine';
import type { RunMode, VesselId } from '@umbral/shared';
import { create } from 'zustand';
import { setMuted, sfx } from './audio';

/** Elige el SFX (B7) según la acción y el estado resultante. No afecta a la lógica. */
function playSfx(action: GameAction, next: GameState | null, illegal: boolean): void {
  if (illegal) return;
  if (next?.phase === 'fin') {
    if (next.result?.status === 'won') sfx.win();
    else sfx.lose();
    return;
  }
  switch (action.type) {
    case 'SELECT_CARD':
      sfx.select();
      break;
    case 'DESELECT_CARD':
      sfx.deselect();
      break;
    case 'PLAY_HAND':
      sfx.play();
      break;
    case 'DISCARD':
      sfx.discard();
      break;
    case 'BUY':
    case 'REROLL_SHOP':
      sfx.coin();
      break;
    case 'PICK_REWARD':
      sfx.reward();
      break;
    default:
      sfx.nav();
  }
}

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
  /** Silencio del SFX (Ajustes, B20). */
  muted: boolean;
  newRun: (cfg: RunConfig) => void;
  dispatch: (action: GameAction) => void;
  abandon: () => void;
  toggleMute: () => void;
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
  muted: false,
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
    sfx.nav();
    set({ state, events: [], lastError: null });
  },
  dispatch: (action) => {
    const cur = get().state;
    if (!cur) return;
    const { state, events } = reduce(cur, action, REGISTRY);
    const err = events.find((e) => e.t === 'error');
    const illegal = err !== undefined;
    playSfx(action, illegal ? null : state, illegal);
    set({
      state,
      events,
      lastError: err && 'reason' in err ? (err.reason as string) : null,
    });
  },
  abandon: () => set({ state: null, events: [], lastError: null }),
  toggleMute: () =>
    set((s) => {
      const muted = !s.muted;
      setMuted(muted);
      return { muted };
    }),
}));
