// El motor como reductor puro y event-sourced (§5.2).
//   reduce(state, action) -> { state, events }
// Reglas duras: puro y sincrono; sin await, sin Date.now(), sin Math.random().
// El action log = acciones aplicadas (sin TICK). Cada accion valida su legalidad; una accion
// ilegal devuelve el estado SIN cambios + un FeelEvent de error (no se registra en el log).
//
// Bloque 4: estructura de run completa. START_RUN genera el mapa del Umbral 1 (§9.2). El flujo
// es mapa -> elegir nodo -> combate (con scoring, velas y Cordura) / nodos de servicio ->
// recompensa -> avance de Umbral -> victoria (Umbral 8) o muerte (0 velas). Tienda/eventos/
// santuarios son placeholders jugables (su contenido llega en Bloques 10/12).
import {
  type Card,
  cloneRngState,
  createRngStreams,
  type RngStreams,
  shuffle,
} from '@umbral/shared';
import type { GameAction, StartRunAction } from './actions';
import { type ContentRegistry, EMPTY_REGISTRY } from './content/dsl';
import {
  acquireEffect,
  applyScalersOnBossDefeated,
  applyScalersOnDestroyed,
  applyScalersOnDiscard,
  applyScalersOnEnhanced,
  applyScalersOnHandPlayed,
  combatEndDestroy,
  combatModifiers,
  combatStartEffects,
  countXMultRelics,
  scoringModifiers,
  toScoringRelics,
  umbralEndGoldFactor,
} from './content/interpret';
import { pickRelicRewards } from './content/pool';
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
} from './defaults';
import type { FeelEvent } from './events';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import { bonoMultCordura, bossObjectiveFactor } from './run/cordura';
import { combatGoldReward, interest, SKIP_REWARD_GOLD } from './run/economy';
import { generateUmbralMap } from './run/map';
import type { ObjectiveKind } from './run/objectives';
import type { ScoreContext } from './scoring/effects';
import { scoreHand } from './scoring/score';
import {
  type CombatState,
  type GameState,
  type HandLevel,
  type MapNode,
  type ReduceResult,
  type RelicInstance,
  type RewardOption,
  STANDARD_HAND_TYPES,
  type UmbralMap,
} from './types';

// ---- Helpers internos ----

function illegal(state: GameState, reason: string): ReduceResult {
  return { state, events: [{ t: 'error', reason }] };
}

/** Aplica una accion: anade al log y devuelve el resultado. `next` ya trae los cambios de estado. */
function commit(next: GameState, action: GameAction, events: FeelEvent[] = []): ReduceResult {
  return { state: { ...next, log: [...next.log, action] }, events };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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

/** Repone la mano hasta handSize tomando del frente del drawPile (§7.2). */
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

function simaForUmbral(umbral: number): 1 | 2 | 3 | 4 {
  if (umbral <= 3) return 1;
  if (umbral <= 6) return 2;
  if (umbral <= 8) return 3;
  return 4;
}

function nodeById(map: UmbralMap, id: string | null): MapNode | undefined {
  if (id === null) return undefined;
  return map.nodes.find((n) => n.id === id);
}

/** Nodos accesibles desde la posicion actual (fila 0 si no se ha elegido nada). */
export function reachableNodes(map: UmbralMap): MapNode[] {
  if (map.currentNodeId === null) return map.nodes.filter((n) => n.row === 0);
  const cur = nodeById(map, map.currentNodeId);
  if (!cur) return [];
  return cur.next.map((id) => nodeById(map, id)).filter((n): n is MapNode => n !== undefined);
}

function objectiveKindOf(type: MapNode['type']): ObjectiveKind | null {
  return type === 'combate' || type === 'elite' || type === 'jefe' ? type : null;
}

/** Destruye n cartas aleatorias del mazo (clona el stream de reparto). Pureza. */
function destroyRandomFromDeck(
  rng: RngStreams,
  deck: Card[],
  n: number,
): { rng: RngStreams; deck: Card[] } {
  if (n <= 0 || deck.length === 0) return { rng, deck };
  const deal = cloneRngState(rng.deal);
  const order = shuffle(
    deal,
    deck.map((c) => c.id),
  );
  const destroyed = new Set(order.slice(0, Math.min(n, deck.length)));
  return { rng: { ...rng, deal }, deck: deck.filter((c) => !destroyed.has(c.id)) };
}

/** Reparte un combate clonando el stream de reparto (pureza). */
function dealHand(
  rng: RngStreams,
  deckIds: readonly string[],
  handSize: number,
): { rng: RngStreams; hand: string[]; drawPile: string[] } {
  const deal = cloneRngState(rng.deal);
  const shuffled = shuffle(deal, deckIds);
  return {
    rng: { ...rng, deal },
    hand: shuffled.slice(0, handSize),
    drawPile: shuffled.slice(handSize),
  };
}

/** Crea el CombatState para un nodo de combate/elite/jefe (objetivo + reparto + modificadores). */
function makeCombatFor(
  state: GameState,
  node: MapNode,
  registry: ContentRegistry,
): { rng: RngStreams; combat: CombatState } {
  const mod = combatModifiers(state.relics, registry);
  const handSize = Math.max(1, state.baseCombat.handSize + mod.handSize);
  const dealt = dealHand(
    state.rng,
    state.deck.map((c) => c.id),
    handSize,
  );
  let objective = node.objective ?? 0;
  if (node.type === 'jefe') objective = Math.round(objective * bossObjectiveFactor(state.sanity));
  const combat: CombatState = {
    objective,
    accumulated: 0,
    handsLeft: Math.max(1, state.baseCombat.hands + mod.hands),
    discardsLeft: Math.max(0, state.baseCombat.discards + mod.discards),
    handSize,
    hand: dealt.hand,
    selected: [],
    drawPile: dealt.drawPile,
    ...(node.type === 'jefe'
      ? { bossId: `boss.${node.id}` }
      : node.type === 'elite'
        ? { bossId: `elite.${node.id}` }
        : {}),
  };
  return { rng: dealt.rng, combat };
}

/** Construye un draft de recompensa con reliquias reales del pool (§9.7). Clona rng.reward. */
function buildRelicReward(
  state: GameState,
  registry: ContentRegistry,
  count: number,
): { rng: RngStreams; options: RewardOption[] } {
  const reward = cloneRngState(state.rng.reward);
  const owned = new Set(state.relics.map((r) => r.defId));
  const picks = pickRelicRewards(registry, reward, state.sima, count, owned);
  const options: RewardOption[] = [
    ...picks.map((p) => ({ id: p.id, kind: 'relic' as const })),
    { id: 'reward.skip', kind: 'skip' as const },
  ];
  return { rng: { ...state.rng, reward }, options };
}

/** Tras resolver una recompensa: avanzar de Umbral si el nodo era el Jefe, o volver al mapa. */
function afterReward(
  state: GameState,
  action: GameAction,
  registry: ContentRegistry,
  events: FeelEvent[] = [],
): ReduceResult {
  const node = state.map ? nodeById(state.map, state.map.currentNodeId) : undefined;
  if (node?.type === 'jefe') {
    const relics = applyScalersOnBossDefeated(state.relics, registry);
    const gold = Math.floor(state.gold * umbralEndGoldFactor(state.relics, registry));
    if (state.umbral >= 8) {
      const result = { status: 'won' as const, depth: state.umbral, score: state.runScore };
      return commit({ ...state, relics, gold, phase: 'fin', result }, action, events);
    }
    const mapRng = cloneRngState(state.rng.map);
    const nextUmbral = state.umbral + 1;
    const map = generateUmbralMap(nextUmbral, mapRng);
    return commit(
      {
        ...state,
        relics,
        gold,
        rng: { ...state.rng, map: mapRng },
        umbral: nextUmbral,
        sima: simaForUmbral(nextUmbral),
        phase: 'mapa',
        map,
      },
      action,
      events,
    );
  }
  return commit({ ...state, phase: 'mapa' }, action, events);
}

// ---- Constructor de run (START_RUN) ----

export function startRun(action: StartRunAction): GameState {
  const { seed, vessel, ruleset, modifiers } = action;
  const rng: RngStreams = createRngStreams(seed);
  const deck = buildStandardDeck();
  const candles = modifiers?.startingCandles ?? BASE_CANDLES;
  const sanity = modifiers?.startingSanity ?? BASE_SANITY;
  const baseCombat = {
    hands: modifiers?.hands ?? BASE_HANDS,
    discards: modifiers?.discards ?? BASE_DISCARDS,
    handSize: modifiers?.handSize ?? BASE_HAND_SIZE,
  };
  const map = generateUmbralMap(1, rng.map); // muta rng.map (fresco)

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rulesetVersion: ruleset,
    seed,
    vessel,
    veil: 0,
    mode: 'carrera',
    rng,
    phase: 'mapa',
    umbral: 1,
    sima: 1,
    candles,
    maxCandles: candles,
    sanity,
    maxSanity: sanity,
    gold: modifiers?.startingGold ?? BASE_GOLD,
    baseCombat,
    deck,
    relics: [],
    relicSlots: BASE_RELIC_SLOTS,
    consumables: [],
    consumableSlots: BASE_CONSUMABLE_SLOTS,
    handLevels: initialHandLevels(),
    vouchers: [],
    runScore: 0,
    map,
    combat: null,
    log: [action],
  };
}

/** Estado vacio (sin run activo). Punto de partida para reproducir un log (replay). */
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
    baseCombat: { hands: BASE_HANDS, discards: BASE_DISCARDS, handSize: BASE_HAND_SIZE },
    deck: [],
    relics: [],
    relicSlots: 0,
    consumables: [],
    consumableSlots: 0,
    handLevels: {},
    vouchers: [],
    runScore: 0,
    map: null,
    combat: null,
    log: [],
  };
}

// ---- Reductor ----

function combatGuard(state: GameState): CombatState | null {
  return state.phase === 'combate' && state.combat ? state.combat : null;
}

export function reduce(
  state: GameState,
  action: GameAction,
  registry: ContentRegistry = EMPTY_REGISTRY,
): ReduceResult {
  switch (action.type) {
    case 'TICK':
      return { state, events: [] };

    case 'START_RUN':
      return { state: startRun(action), events: [] };

    case 'CHOOSE_NODE': {
      if (state.phase !== 'mapa' || !state.map) return illegal(state, 'no estas en el mapa');
      const node = reachableNodes(state.map).find((n) => n.id === action.nodeId);
      if (!node) return illegal(state, 'nodo no accesible');
      const map: UmbralMap = {
        ...state.map,
        currentNodeId: node.id,
        nodes: state.map.nodes.map((n) => (n.id === node.id ? { ...n, visited: true } : n)),
      };

      if (objectiveKindOf(node.type)) {
        const cs = combatStartEffects(state.relics, registry);
        let base: GameState = { ...state, map };
        if (cs.sanityDelta !== 0) {
          base = { ...base, sanity: clamp(base.sanity + cs.sanityDelta, 0, base.maxSanity) };
        }
        if (cs.destroyRandomDeck > 0) {
          const d = destroyRandomFromDeck(base.rng, base.deck, cs.destroyRandomDeck);
          const destroyed = base.deck.length - d.deck.length;
          base = {
            ...base,
            rng: d.rng,
            deck: d.deck,
            relics: applyScalersOnDestroyed(base.relics, registry, destroyed),
          };
        }
        const { rng, combat } = makeCombatFor(base, node, registry);
        return commit({ ...base, rng, phase: 'combate', combat }, action);
      }
      switch (node.type) {
        case 'tienda':
          return commit(
            {
              ...state,
              map,
              phase: 'tienda',
              shop: { items: [], rerollCost: 5, rerollsThisVisit: 0 },
            },
            action,
          );
        case 'evento':
          return commit(
            { ...state, map, phase: 'evento', pendingEvent: { eventId: 'evento.placeholder' } },
            action,
          );
        case 'tesoro': {
          const rew = buildRelicReward({ ...state, map }, registry, 2);
          return commit(
            {
              ...state,
              map,
              rng: rew.rng,
              phase: 'recompensa',
              pendingReward: { options: rew.options },
            },
            action,
          );
        }
        case 'descanso':
          return commit({ ...state, map, phase: 'descanso' }, action);
        case 'santuario':
          return commit({ ...state, map, phase: 'santuario' }, action);
        default:
          return illegal(state, 'tipo de nodo desconocido');
      }
    }

    case 'SELECT_CARD': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (!c.hand.includes(action.cardId)) return illegal(state, 'la carta no esta en tu mano');
      if (c.selected.includes(action.cardId)) return illegal(state, 'carta ya seleccionada');
      if (c.selected.length >= MAX_SELECTED) return illegal(state, `maximo ${MAX_SELECTED} cartas`);
      return commit(
        { ...state, combat: { ...c, selected: [...c.selected, action.cardId] } },
        action,
      );
    }

    case 'DESELECT_CARD': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (!c.selected.includes(action.cardId))
        return illegal(state, 'la carta no esta seleccionada');
      const combat: CombatState = {
        ...c,
        selected: c.selected.filter((id) => id !== action.cardId),
      };
      return commit({ ...state, combat }, action);
    }

    case 'REORDER_HAND': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (!sameMultiset(action.order, c.hand)) {
        return illegal(state, 'el orden no es una permutacion de la mano');
      }
      return commit({ ...state, combat: { ...c, hand: [...action.order] } }, action);
    }

    case 'DISCARD': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
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
      const relics = applyScalersOnDiscard(state.relics, registry);
      return commit({ ...state, combat, relics }, action);
    }

    case 'PLAY_HAND': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (c.handsLeft <= 0) return illegal(state, 'sin manos');
      if (c.selected.length < 1 || c.selected.length > MAX_SELECTED) {
        return illegal(state, `selecciona entre 1 y ${MAX_SELECTED} cartas`);
      }
      const byId = new Map<string, Card>(state.deck.map((card) => [card.id, card]));
      const played = c.selected
        .map((id) => byId.get(id))
        .filter((card): card is Card => card !== undefined);
      const startingHands = state.baseCombat.hands + combatModifiers(state.relics, registry).hands;
      const mods = scoringModifiers(state.relics, registry);
      const context: ScoreContext = {
        gold: state.gold,
        sanity: state.sanity,
        isFirstHand: c.handsLeft === startingHands,
        bossesDefeated: Math.max(0, state.umbral - 1),
        cardsInHandNotPlayed: c.hand.length - c.selected.length,
        xmultRelics: countXMultRelics(state.relics, registry),
        deckCards: state.deck.length,
        corduraLost: state.maxSanity - state.sanity,
        spectralRelics: mods.spectralRelics,
        enhancedCardsInHand: c.hand.filter((id) => byId.get(id)?.enhancement != null).length,
        flatCardChips: mods.flatCardChips,
        noRetriggerCap: mods.noRetriggerCap,
        extraRetrigger: mods.extraRetrigger,
        wildSuit: mods.wildSuit,
      };
      const result = scoreHand({
        played,
        handLevels: state.handLevels,
        relics: toScoringRelics(state.relics, registry),
        corduraMultBonus: bonoMultCordura(state.sanity),
        context,
      });
      const accumulated = c.accumulated + result.score;
      const gold = state.gold + result.coinsGained;
      const sanity = clamp(state.sanity + result.sanityDelta, 0, state.maxSanity);
      const relics = applyScalersOnHandPlayed(
        state.relics,
        registry,
        result.handType,
        result.scoringIds.length,
      );
      const node = state.map ? nodeById(state.map, state.map.currentNodeId) : undefined;
      const kind: ObjectiveKind = (node && objectiveKindOf(node.type)) || 'combate';

      // WIN: objetivo alcanzado.
      if (accumulated >= c.objective) {
        const reward = combatGoldReward(kind) + interest(gold);
        const endDestroy = combatEndDestroy(state.relics, registry);
        const d =
          endDestroy > 0
            ? destroyRandomFromDeck(state.rng, state.deck, endDestroy)
            : { rng: state.rng, deck: state.deck };
        const relicsAfter = applyScalersOnDestroyed(
          relics,
          registry,
          state.deck.length - d.deck.length,
        );
        const rew = buildRelicReward({ ...state, rng: d.rng }, registry, 2);
        return commit(
          {
            ...state,
            relics: relicsAfter,
            rng: rew.rng,
            deck: d.deck,
            gold: gold + reward,
            sanity,
            runScore: state.runScore + accumulated,
            combat: null,
            phase: 'recompensa',
            pendingReward: { options: rew.options },
          },
          action,
          result.events,
        );
      }

      // Sigue habiendo manos: continuar.
      const handsLeft = c.handsLeft - 1;
      if (handsLeft > 0) {
        const kept = c.hand.filter((id) => !c.selected.includes(id));
        const refilled = refill(kept, c.drawPile, c.handSize);
        const combat: CombatState = {
          ...c,
          hand: refilled.hand,
          drawPile: refilled.drawPile,
          selected: [],
          handsLeft,
          accumulated,
        };
        return commit({ ...state, relics, gold, sanity, combat }, action, result.events);
      }

      // LOSE: sin manos y sin alcanzar el objetivo -> apaga 1 vela (§9.5).
      const candles = state.candles - 1;
      if (candles <= 0) {
        const lost = { status: 'lost' as const, depth: state.umbral, score: state.runScore };
        return commit(
          { ...state, relics, gold, sanity, candles: 0, combat: null, phase: 'fin', result: lost },
          action,
          result.events,
        );
      }
      // Jefe no vencido: hay que ganarlo, se re-reparte (reintento). Otros nodos: superado, al mapa.
      if (node?.type === 'jefe') {
        const remade = makeCombatFor({ ...state, relics, gold, sanity, candles }, node, registry);
        return commit(
          { ...state, relics, gold, sanity, candles, rng: remade.rng, combat: remade.combat },
          action,
          result.events,
        );
      }
      return commit(
        { ...state, relics, gold, sanity, candles, combat: null, phase: 'mapa' },
        action,
        result.events,
      );
    }

    case 'SCRY_BURY': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (!c.drawPile.includes(action.cardId)) return illegal(state, 'la carta no esta en el mazo');
      const drawPile = [...c.drawPile.filter((id) => id !== action.cardId), action.cardId];
      return commit({ ...state, combat: { ...c, drawPile } }, action);
    }

    case 'SCRY_KEEP': {
      const c = combatGuard(state);
      if (!c) return illegal(state, 'no estas en combate');
      if (!c.drawPile.includes(action.cardId)) return illegal(state, 'la carta no esta en el mazo');
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

    case 'PICK_REWARD': {
      if (state.phase !== 'recompensa' || !state.pendingReward) {
        return illegal(state, 'no hay recompensa');
      }
      const opt = state.pendingReward.options.find((o) => o.id === action.rewardId);
      if (!opt) return illegal(state, 'opcion de recompensa no valida');
      const { pendingReward: _pendingReward, ...rest } = state;
      let next: GameState = rest;
      if (opt.kind === 'skip') {
        next = { ...next, gold: next.gold + SKIP_REWARD_GOLD };
      } else if (opt.kind === 'relic' && next.relics.length < next.relicSlots) {
        const acq = acquireEffect(opt.id, registry);
        const maxCandles = Math.max(1, next.maxCandles + acq.maxCandlesDelta);
        next = {
          ...next,
          relics: [...next.relics, { defId: opt.id }],
          maxCandles,
          candles: Math.min(next.candles, maxCandles),
          sanity: clamp(next.sanity + acq.sanityDelta, 0, next.maxSanity),
        };
      } else if (opt.kind === 'arcano' && next.consumables.length < next.consumableSlots) {
        next = { ...next, consumables: [...next.consumables, { defId: opt.id }] };
      }
      return afterReward(next, action, registry);
    }

    case 'SKIP_REWARD': {
      if (state.phase !== 'recompensa' || !state.pendingReward) {
        return illegal(state, 'no hay recompensa');
      }
      const { pendingReward: _pendingReward, ...rest } = state;
      return afterReward({ ...rest, gold: rest.gold + SKIP_REWARD_GOLD }, action, registry);
    }

    case 'REST_ACTION': {
      if (state.phase !== 'descanso') return illegal(state, 'no estas en un descanso');
      if (action.kind === 'heal') {
        return commit(
          {
            ...state,
            candles: Math.min(state.maxCandles, state.candles + 1),
            sanity: Math.min(state.maxSanity, state.sanity + 10),
            phase: 'mapa',
          },
          action,
        );
      }
      if (action.kind === 'upgrade') {
        const target = action.target ?? 'carta_alta';
        const cur = state.handLevels[target] ?? { level: 1 };
        const handLevels = { ...state.handLevels, [target]: { level: cur.level + 1 } };
        return commit({ ...state, handLevels, phase: 'mapa' }, action);
      }
      if (action.kind === 'remove' && action.target) {
        const deck = state.deck.filter((c) => c.id !== action.target);
        return commit({ ...state, deck, phase: 'mapa' }, action);
      }
      return illegal(state, 'accion de descanso invalida');
    }

    case 'RESOLVE_EVENT': {
      if (state.phase !== 'evento' || !state.pendingEvent) return illegal(state, 'no hay evento');
      // Contenido real de eventos en el Bloque 12; por ahora resolver = volver al mapa.
      const { pendingEvent: _pendingEvent, ...rest } = state;
      return commit({ ...rest, phase: 'mapa' }, action);
    }

    case 'NEXT': {
      switch (state.phase) {
        case 'descanso':
        case 'santuario':
          return commit({ ...state, phase: 'mapa' }, action);
        case 'tienda': {
          const { shop: _shop, ...rest } = state;
          return commit({ ...rest, phase: 'mapa' }, action);
        }
        case 'evento': {
          const { pendingEvent: _pendingEvent, ...rest } = state;
          return commit({ ...rest, phase: 'mapa' }, action);
        }
        case 'recompensa': {
          // NEXT en recompensa = saltar.
          const { pendingReward: _pendingReward, ...rest } = state;
          return afterReward({ ...rest, gold: rest.gold + SKIP_REWARD_GOLD }, action, registry);
        }
        default:
          return illegal(state, 'nada que avanzar aqui');
      }
    }

    case 'USE_CONSUMABLE': {
      if (state.phase === 'fin') return illegal(state, 'el run ha terminado');
      const idx = state.consumables.findIndex((c) => c.defId === action.consumableId);
      if (idx === -1) return illegal(state, 'no tienes ese consumible');
      const def = registry.consumables[action.consumableId];
      if (!def) return illegal(state, 'consumible desconocido');

      let deck = state.deck;
      let handLevels = state.handLevels;
      let enhancedCount = 0;
      if (def.applyEnhancement !== undefined || def.applySeal !== undefined) {
        // Augurio: aplica mejora/sello a las cartas objetivo (en el mazo).
        const max = def.maxTargets ?? 1;
        const targets = new Set(action.targets.slice(0, max));
        if (targets.size === 0) return illegal(state, 'el augurio necesita cartas objetivo');
        if (def.applyEnhancement !== undefined) enhancedCount = targets.size;
        deck = state.deck.map((card) =>
          targets.has(card.id)
            ? {
                ...card,
                ...(def.applyEnhancement !== undefined
                  ? { enhancement: def.applyEnhancement }
                  : {}),
                ...(def.applySeal !== undefined ? { seal: def.applySeal } : {}),
              }
            : card,
        );
      } else if (def.levelUpHand) {
        // Sello: sube +1 el nivel de un tipo de mano (o de todas).
        if (def.levelUpHand === 'all') {
          const all: Record<string, { level: number }> = {};
          for (const [k, v] of Object.entries(state.handLevels)) all[k] = { level: v.level + 1 };
          handLevels = all;
        } else {
          const cur = state.handLevels[def.levelUpHand] ?? { level: 1 };
          handLevels = { ...state.handLevels, [def.levelUpHand]: { level: cur.level + 1 } };
        }
      }
      const consumables = state.consumables.filter((_, i) => i !== idx);
      const relics = applyScalersOnEnhanced(state.relics, registry, enhancedCount);
      return commit({ ...state, deck, handLevels, consumables, relics }, action);
    }

    // Tienda (compra/venta/reroll): contenido en el Bloque 10.
    case 'BUY':
    case 'SELL_RELIC':
    case 'REROLL_SHOP':
      return illegal(state, `accion '${action.type}' aun no implementada (Bloque 10)`);

    default:
      return illegal(state, 'accion desconocida');
  }
}

/**
 * Reproduce un action log desde cero (INV-4). El primer elemento DEBE ser START_RUN.
 * Reaplicar un log da un GameState identico (DoD del Bloque 2).
 */
export function replay(
  actions: readonly GameAction[],
  registry: ContentRegistry = EMPTY_REGISTRY,
): GameState {
  let state = createBlankState();
  for (const action of actions) {
    state = reduce(state, action, registry).state;
  }
  return state;
}
