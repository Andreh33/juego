// El motor como reductor puro y event-sourced (§5.2).
//   reduce(state, action) -> { state, events }
// Reglas duras: puro y sincrono; sin await, sin Date.now(), sin Math.random().
// El action log = acciones aplicadas (sin TICK). Cada accion valida su legalidad; una accion
// ilegal devuelve el estado SIN cambios + un FeelEvent de error (no se registra en el log).
//
// Bloque 2 = ESQUELETO: transiciona fases y mecaniza el combate (seleccionar/jugar/descartar)
// SIN scoring (Bloque 3) y SIN mapa real (Bloque 4). Un START_RUN abre directamente un combate
// provisional para tener una superficie manipulable y determinista.
import { createRngStreams, type RngStreams, shuffle } from '@umbral/shared';
import type { GameAction, StartRunAction } from './actions';
import { buildStandardDeck } from './deck';
import {
  BASE_CANDLES,
  BASE_CONSUMABLE_SLOTS,
  BASE_DISCARDS,
  BASE_GOLD,
  BASE_HAND_SIZE,
  BASE_HANDS,
  BASE_RELIC_SLOTS,
  BASE_SANITY,
  MAX_SELECTED,
  PLACEHOLDER_OBJECTIVE,
} from './defaults';
import type { FeelEvent } from './events';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import {
  type CombatState,
  type GameState,
  type HandLevel,
  type ReduceResult,
  type RelicInstance,
  STANDARD_HAND_TYPES,
} from './types';

// ---- Helpers internos ----

function illegal(state: GameState, reason: string): ReduceResult {
  return { state, events: [{ t: 'error', reason }] };
}

/** Aplica una accion: anade al log y devuelve el resultado. `next` ya trae los cambios de estado. */
function commit(next: GameState, action: GameAction, events: FeelEvent[] = []): ReduceResult {
  return { state: { ...next, log: [...next.log, action] }, events };
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const x of b) {
    const c = counts.get(x);
    if (c === undefined || c === 0) return false;
    counts.set(x, c - 1);
  }
  return true;
}

/** Repone la mano hasta handSize tomando del frente del drawPile (§7.2). Sin rng en Bloque 2. */
function refill(
  hand: readonly string[],
  drawPile: readonly string[],
  handSize: number,
): { hand: string[]; drawPile: string[] } {
  const need = handSize - hand.length;
  if (need <= 0) return { hand: [...hand], drawPile: [...drawPile] };
  const drawn = drawPile.slice(0, need);
  return { hand: [...hand, ...drawn], drawPile: drawPile.slice(drawn.length) };
}

function initialHandLevels(): Record<string, HandLevel> {
  const levels: Record<string, HandLevel> = {};
  for (const t of STANDARD_HAND_TYPES) levels[t] = { level: 1 };
  return levels;
}

// ---- Constructor de run (START_RUN) ----

/** Construye el GameState inicial de un run y abre el primer combate (placeholder, Bloque 2). */
export function startRun(action: StartRunAction): GameState {
  const { seed, vessel, ruleset, modifiers } = action;
  const rng: RngStreams = createRngStreams(seed);

  const deck = buildStandardDeck();
  const handSize = modifiers?.handSize ?? BASE_HAND_SIZE;

  // Baraja inicial determinista con el stream de reparto.
  const shuffled = shuffle(
    rng.deal,
    deck.map((c) => c.id),
  );
  const hand = shuffled.slice(0, handSize);
  const drawPile = shuffled.slice(handSize);

  const combat: CombatState = {
    objective: PLACEHOLDER_OBJECTIVE,
    accumulated: 0,
    handsLeft: modifiers?.hands ?? BASE_HANDS,
    discardsLeft: modifiers?.discards ?? BASE_DISCARDS,
    handSize,
    hand,
    selected: [],
    drawPile,
  };

  const candles = modifiers?.startingCandles ?? BASE_CANDLES;
  const sanity = modifiers?.startingSanity ?? BASE_SANITY;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rulesetVersion: ruleset,
    seed,
    vessel,
    veil: 0,
    mode: 'carrera',
    rng,
    phase: 'combate',
    umbral: 1,
    sima: 1,
    candles,
    maxCandles: candles,
    sanity,
    maxSanity: sanity,
    gold: modifiers?.startingGold ?? BASE_GOLD,
    deck,
    relics: [],
    relicSlots: BASE_RELIC_SLOTS,
    consumables: [],
    consumableSlots: BASE_CONSUMABLE_SLOTS,
    handLevels: initialHandLevels(),
    vouchers: [],
    map: null,
    combat,
    log: [action],
  };
}

/** Estado vacio (sin run activo). Sirve de punto de partida para reproducir un log (replay). */
export function createBlankState(): GameState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rulesetVersion: 0,
    seed: '',
    vessel: 'heraldo',
    veil: 0,
    mode: 'carrera',
    rng: createRngStreams(''),
    phase: 'fin',
    umbral: 0,
    sima: 1,
    candles: 0,
    maxCandles: 0,
    sanity: 0,
    maxSanity: 0,
    gold: 0,
    deck: [],
    relics: [],
    relicSlots: 0,
    consumables: [],
    consumableSlots: 0,
    handLevels: {},
    vouchers: [],
    map: null,
    combat: null,
    log: [],
  };
}

// ---- Reductor ----

export function reduce(state: GameState, action: GameAction): ReduceResult {
  switch (action.type) {
    // TICK: solo timers cosmeticos. No cambia estado ni va al log (§5.2).
    case 'TICK':
      return { state, events: [] };

    // START_RUN reconstruye un run nuevo (ignora el estado previo: resetea).
    case 'START_RUN':
      return { state: startRun(action), events: [] };

    case 'SELECT_CARD': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (!c.hand.includes(action.cardId)) return illegal(state, 'la carta no esta en tu mano');
      if (c.selected.includes(action.cardId)) return illegal(state, 'carta ya seleccionada');
      if (c.selected.length >= MAX_SELECTED) return illegal(state, `maximo ${MAX_SELECTED} cartas`);
      const combat: CombatState = { ...c, selected: [...c.selected, action.cardId] };
      return commit({ ...state, combat }, action);
    }

    case 'DESELECT_CARD': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (!c.selected.includes(action.cardId))
        return illegal(state, 'la carta no esta seleccionada');
      const combat: CombatState = {
        ...c,
        selected: c.selected.filter((id) => id !== action.cardId),
      };
      return commit({ ...state, combat }, action);
    }

    case 'REORDER_HAND': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (!sameMultiset(action.order, c.hand)) {
        return illegal(state, 'el orden no es una permutacion de la mano');
      }
      const combat: CombatState = { ...c, hand: [...action.order] };
      return commit({ ...state, combat }, action);
    }

    case 'DISCARD': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (c.discardsLeft <= 0) return illegal(state, 'sin descartes');
      if (c.selected.length === 0) return illegal(state, 'no hay cartas seleccionadas');
      const kept = c.hand.filter((id) => !c.selected.includes(id));
      const { hand, drawPile } = refill(kept, c.drawPile, c.handSize);
      const combat: CombatState = {
        ...c,
        hand,
        drawPile,
        selected: [],
        discardsLeft: c.discardsLeft - 1,
      };
      return commit({ ...state, combat }, action);
    }

    case 'PLAY_HAND': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (c.handsLeft <= 0) return illegal(state, 'sin manos');
      if (c.selected.length < 1 || c.selected.length > MAX_SELECTED) {
        return illegal(state, `selecciona entre 1 y ${MAX_SELECTED} cartas`);
      }
      // Bloque 2: sin scoring. Se consume la mano y se repone; el calculo de puntos
      // (deteccion de tipo, pipeline, win/lose) entra en el Bloque 3/4.
      const kept = c.hand.filter((id) => !c.selected.includes(id));
      const { hand, drawPile } = refill(kept, c.drawPile, c.handSize);
      const combat: CombatState = {
        ...c,
        hand,
        drawPile,
        selected: [],
        handsLeft: c.handsLeft - 1,
      };
      return commit({ ...state, combat }, action);
    }

    case 'SCRY_BURY': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      const c = state.combat;
      if (!c.drawPile.includes(action.cardId)) return illegal(state, 'la carta no esta en el mazo');
      const drawPile = [...c.drawPile.filter((id) => id !== action.cardId), action.cardId];
      const combat: CombatState = { ...c, drawPile };
      return commit({ ...state, combat }, action);
    }

    case 'SCRY_KEEP': {
      if (state.phase !== 'combate' || !state.combat) return illegal(state, 'no estas en combate');
      if (!state.combat.drawPile.includes(action.cardId)) {
        return illegal(state, 'la carta no esta en el mazo');
      }
      // No-op deterministico: marca la carta como conservada (sin reordenar). Vidente lo usa en Bloque 8.
      return commit({ ...state }, action);
    }

    case 'REORDER_RELICS': {
      if (state.phase === 'fin') return illegal(state, 'el run ha terminado');
      const current = state.relics.map((r) => r.defId);
      if (!sameMultiset(action.order, current)) {
        return illegal(state, 'el orden no es una permutacion de tus reliquias');
      }
      const byId = new Map(state.relics.map((r) => [r.defId, r]));
      const relics = action.order
        .map((id) => byId.get(id))
        .filter((r): r is RelicInstance => r !== undefined);
      return commit({ ...state, relics }, action);
    }

    // Acciones de fases aun no implementadas en este bloque (mapa/tienda/evento/recompensa/
    // descanso/jefe -> Bloques 4, 9, 10, 12). Se validan como ilegales con motivo claro.
    case 'BUY':
    case 'SELL_RELIC':
    case 'REROLL_SHOP':
    case 'USE_CONSUMABLE':
    case 'CHOOSE_NODE':
    case 'RESOLVE_EVENT':
    case 'PICK_REWARD':
    case 'SKIP_REWARD':
    case 'REST_ACTION':
    case 'NEXT':
      return illegal(state, `accion '${action.type}' aun no implementada (bloque posterior)`);

    default:
      return illegal(state, 'accion desconocida');
  }
}

/**
 * Reproduce un action log desde cero (INV-4). El primer elemento DEBE ser START_RUN.
 * Reaplicar un log da un GameState identico (DoD del Bloque 2).
 */
export function replay(actions: readonly GameAction[]): GameState {
  let state = createBlankState();
  for (const action of actions) {
    state = reduce(state, action).state;
  }
  return state;
}
