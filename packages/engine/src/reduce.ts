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
  nextInt,
  type Rank,
  type RngStreams,
  shuffle,
} from '@umbral/shared';
import type { GameAction, StartRunAction } from './actions';
import { type ContentRegistry, EMPTY_REGISTRY } from './content/dsl';
import type { EventOptionEffect } from './content/event';
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
  voucherStatEffect,
} from './content/interpret';
import { pickRelicRewards } from './content/pool';
import { generateShop, voucherShopMods } from './content/shop';
import type { VesselDef } from './content/vessel';
import { buildStandardDeck, buildVesselDeck } from './deck';
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
import type { Effect, ScoreContext, ScoringRelic } from './scoring/effects';
import { detectHand } from './scoring/handtype';
import { scoreHand } from './scoring/score';
import {
  type CombatState,
  type GameState,
  type HandLevel,
  type HandType,
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

const HAND_CODES: HandType[] = [
  ...STANDARD_HAND_TYPES,
  'quinteto',
  'quinteto_color',
  'hilera_negra',
];

/** Codigo numerico de un tipo de mano (para guardar el "ultimo tipo" del Eco en combatRelicState). */
function handCode(type: HandType): number {
  return HAND_CODES.indexOf(type) + 1;
}

/** Catalogo (Coleccionista, §8.4): +fichas por cada palo con >= umbral cartas mejoradas. */
function catalogoBonus(vessel: VesselDef, deck: GameState['deck']): number {
  const threshold = vessel.mechanicParams?.threshold ?? 5;
  const per = vessel.mechanicParams?.fichasPerSuit ?? 20;
  const counts = new Map<string, number>();
  for (const c of deck) {
    if (c.enhancement !== null && c.suit) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
  }
  let suits = 0;
  for (const v of counts.values()) if (v >= threshold) suits++;
  return suits * per;
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
  bossDefId?: string,
): { rng: RngStreams; combat: CombatState } {
  const mod = combatModifiers(state.relics, registry);
  const bossDef = bossDefId ? registry.bosses[bossDefId] : undefined;
  const handSize = Math.max(1, state.baseCombat.handSize + mod.handSize);
  const dealt = dealHand(
    state.rng,
    state.deck.map((c) => c.id),
    handSize,
  );
  let objective = node.objective ?? 0;
  const vessel = registry.vessels[state.vessel];
  if (vessel) objective = Math.round(objective * vessel.objectiveFactor);
  if (node.type === 'jefe') objective = Math.round(objective * bossObjectiveFactor(state.sanity));
  if (bossDef?.modifier.objectiveFactor) {
    objective = Math.round(objective * bossDef.modifier.objectiveFactor);
  }
  const bossId = bossDefId ?? (node.type === 'jefe' ? `boss.${node.id}` : `elite.${node.id}`);
  const combat: CombatState = {
    objective,
    accumulated: 0,
    handsLeft: Math.max(
      1,
      state.baseCombat.hands + mod.hands + (bossDef?.modifier.handsDelta ?? 0),
    ),
    discardsLeft: Math.max(
      0,
      state.baseCombat.discards + mod.discards + (bossDef?.modifier.discardsDelta ?? 0),
    ),
    handSize,
    hand: dealt.hand,
    selected: [],
    drawPile: dealt.drawPile,
    ...(node.type === 'jefe' || node.type === 'elite' ? { bossId } : {}),
  };
  return { rng: dealt.rng, combat };
}

/** Aplica el efecto de una opcion de evento/santuario (§11.9, §10.5). */
function applyEventEffect(
  state: GameState,
  effect: EventOptionEffect,
  registry: ContentRegistry,
): GameState {
  let next = { ...state };
  if (effect.goldDelta) next = { ...next, gold: Math.max(0, next.gold + effect.goldDelta) };
  if (effect.maxSanityDelta) {
    next = { ...next, maxSanity: Math.max(1, next.maxSanity + effect.maxSanityDelta) };
  }
  if (effect.sanityDelta) {
    next = { ...next, sanity: clamp(next.sanity + effect.sanityDelta, 0, next.maxSanity) };
  }
  if (effect.maxCandleDelta) {
    const mc = Math.max(1, next.maxCandles + effect.maxCandleDelta);
    next = { ...next, maxCandles: mc, candles: Math.min(next.candles, mc) };
  }
  if (effect.candleDelta) {
    next = { ...next, candles: clamp(next.candles + effect.candleDelta, 0, next.maxCandles) };
  }
  if (effect.destroyRandomDeck) {
    const d = destroyRandomFromDeck(next.rng, next.deck, effect.destroyRandomDeck);
    next = { ...next, rng: d.rng, deck: d.deck };
  }
  if (effect.gainRelicRarity && next.relics.length < next.relicSlots) {
    const owned = new Set(next.relics.map((r) => r.defId));
    const cand = Object.values(registry.relics).filter(
      (r) => r.rarity === effect.gainRelicRarity && !r.vessel && !owned.has(r.id),
    );
    if (cand.length > 0) {
      const reward = cloneRngState(next.rng.reward);
      const pick = cand[nextInt(reward, 0, cand.length - 1)];
      next = { ...next, rng: { ...next.rng, reward } };
      if (pick) next = { ...next, relics: [...next.relics, { defId: pick.id }] };
    }
  }
  if (effect.gainConsumableKind && next.consumables.length < next.consumableSlots) {
    const cand = Object.values(registry.consumables).filter(
      (c) => c.kind === effect.gainConsumableKind,
    );
    if (cand.length > 0) {
      const reward = cloneRngState(next.rng.reward);
      const pick = cand[nextInt(reward, 0, cand.length - 1)];
      next = { ...next, rng: { ...next.rng, reward } };
      if (pick) next = { ...next, consumables: [...next.consumables, { defId: pick.id }] };
    }
  }
  return next;
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
    // Umbral 8 vencido: victoria, salvo en Modo Infinito que sigue descendiendo (§9.6).
    if (state.umbral >= 8 && state.mode !== 'infinito') {
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

export function startRun(
  action: StartRunAction,
  registry: ContentRegistry = EMPTY_REGISTRY,
): GameState {
  const { seed, vessel, ruleset, modifiers } = action;
  const def = registry.vessels[vessel];
  const rng: RngStreams = createRngStreams(seed);
  let deck = def ? buildVesselDeck(def) : buildStandardDeck();
  // Modo custom/desafio: recorte de mazo (Mazo Minimo, etc.).
  if (modifiers?.deckSize && modifiers.deckSize < deck.length) {
    const toRemove = deck.length - modifiers.deckSize;
    const removeIds = new Set(
      [...deck]
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .slice(0, toRemove)
        .map((c) => c.id),
    );
    deck = deck.filter((c) => !removeIds.has(c.id));
  }
  const candles = modifiers?.startingCandles ?? BASE_CANDLES;
  const sanity = modifiers?.startingSanity ?? BASE_SANITY;
  const baseCombat = {
    hands: modifiers?.hands ?? def?.baseCombat.hands ?? BASE_HANDS,
    discards: modifiers?.discards ?? def?.baseCombat.discards ?? BASE_DISCARDS,
    handSize: modifiers?.handSize ?? def?.baseCombat.handSize ?? BASE_HAND_SIZE,
  };
  const map = generateUmbralMap(1, rng.map); // muta rng.map (fresco)

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rulesetVersion: ruleset,
    seed,
    vessel,
    veil: 0,
    mode: action.mode ?? 'carrera',
    ...(action.dailyDate ? { dailyDate: action.dailyDate } : {}),
    ...(action.weeklyId ? { weeklyId: action.weeklyId } : {}),
    ...(action.challengeId ? { challengeId: action.challengeId } : {}),
    rng,
    phase: 'mapa',
    umbral: 1,
    sima: 1,
    candles,
    maxCandles: candles,
    sanity,
    maxSanity: sanity,
    gold: modifiers?.startingGold ?? def?.startingGold ?? BASE_GOLD,
    baseCombat,
    deck,
    relics: def ? [{ defId: def.startingRelicId }] : [],
    relicSlots: BASE_RELIC_SLOTS,
    consumables: [],
    consumableSlots: BASE_CONSUMABLE_SLOTS,
    handLevels: initialHandLevels(),
    vouchers: [],
    runScore: 0,
    usedBosses: [],
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
    usedBosses: [],
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
      return { state: startRun(action, registry), events: [] };

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
        let base: GameState = { ...state, map };
        // Seleccion de jefe (pool por Sima, sin repetir, §11.7) o de modificador de elite (§11.8).
        let bossDefId: string | undefined;
        if (node.type === 'jefe') {
          const poolSima = Math.min(3, state.sima);
          const all = Object.values(registry.bosses).filter(
            (b) => b.sima === poolSima && !b.secret && !b.elite,
          );
          const fresh = all.filter((b) => !state.usedBosses.includes(b.id));
          const choices = fresh.length > 0 ? fresh : all;
          if (choices.length > 0) {
            const bossRng = cloneRngState(state.rng.boss);
            const pick = choices[nextInt(bossRng, 0, choices.length - 1)];
            base = { ...base, rng: { ...base.rng, boss: bossRng } };
            if (pick) {
              bossDefId = pick.id;
              base = { ...base, usedBosses: [...state.usedBosses, pick.id] };
            }
          }
        } else if (node.type === 'elite') {
          const elites = Object.values(registry.bosses).filter((b) => b.elite);
          if (elites.length > 0) {
            const bossRng = cloneRngState(state.rng.boss);
            const pick = elites[nextInt(bossRng, 0, elites.length - 1)];
            base = { ...base, rng: { ...base.rng, boss: bossRng } };
            if (pick) bossDefId = pick.id;
          }
        }
        const cs = combatStartEffects(state.relics, registry);
        const bossMod = bossDefId ? registry.bosses[bossDefId]?.modifier : undefined;
        if (cs.sanityDelta !== 0) {
          base = { ...base, sanity: clamp(base.sanity + cs.sanityDelta, 0, base.maxSanity) };
        }
        const destroyN = cs.destroyRandomDeck + (bossMod?.destroyDeckAtStart ?? 0);
        if (destroyN > 0) {
          const before = base.deck.length;
          const d = destroyRandomFromDeck(base.rng, base.deck, destroyN);
          base = {
            ...base,
            rng: d.rng,
            deck: d.deck,
            relics: applyScalersOnDestroyed(base.relics, registry, before - d.deck.length),
          };
        }
        const { rng, combat } = makeCombatFor(base, node, registry, bossDefId);
        return commit({ ...base, rng, phase: 'combate', combat }, action);
      }
      switch (node.type) {
        case 'tienda': {
          const sm = voucherShopMods(state.vouchers, registry);
          const shopRng = cloneRngState(state.rng.shop);
          const shop = generateShop(registry, shopRng, {
            sima: state.sima,
            ownedRelicIds: new Set(state.relics.map((r) => r.defId)),
            ownedVoucherIds: new Set(state.vouchers),
            shopDiscount: sm.shopDiscount,
            rerollDiscount: sm.rerollDiscount,
            extraItems: sm.extraItems,
          });
          return commit(
            { ...state, map, rng: { ...state.rng, shop: shopRng }, phase: 'tienda', shop },
            action,
          );
        }
        case 'evento': {
          const eventRng = cloneRngState(state.rng.event);
          const pool = Object.values(registry.events).filter((e) => !e.santuario);
          const ev = pool.length > 0 ? pool[nextInt(eventRng, 0, pool.length - 1)] : undefined;
          return commit(
            {
              ...state,
              map,
              rng: { ...state.rng, event: eventRng },
              phase: 'evento',
              pendingEvent: { eventId: ev?.id ?? 'evento.placeholder' },
            },
            action,
          );
        }
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
        case 'santuario': {
          const eventRng = cloneRngState(state.rng.event);
          const pool = Object.values(registry.events).filter((e) => e.santuario);
          const ev = pool.length > 0 ? pool[nextInt(eventRng, 0, pool.length - 1)] : undefined;
          return commit(
            {
              ...state,
              map,
              rng: { ...state.rng, event: eventRng },
              phase: 'santuario',
              pendingEvent: { eventId: ev?.id ?? 'santuario.placeholder' },
            },
            action,
          );
        }
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
      // Frenesi (Bestia, §8.5): cada descarte acumula +1.
      const dVessel = registry.vessels[state.vessel];
      const combatRelicState =
        dVessel?.mechanic === 'frenesi'
          ? { ...(c.combatRelicState ?? {}), frenesi: (c.combatRelicState?.frenesi ?? 0) + 1 }
          : c.combatRelicState;
      const combat: CombatState = {
        ...c,
        hand,
        drawPile,
        selected: [],
        discardsLeft: c.discardsLeft - 1,
        ...(combatRelicState ? { combatRelicState } : {}),
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
      const bossMod = c.bossId ? registry.bosses[c.bossId]?.modifier : undefined;
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
        silencedSuits: bossMod?.silenceSuits ?? [],
        figuresHalf: bossMod?.figuresHalf ?? false,
        relicXMultPenalty: bossMod?.relicXMultPenalty ?? 0,
      };
      // --- Mecanica de Recipiente (§8) ---
      const vessel = registry.vessels[state.vessel];
      const crs = c.combatRelicState ?? {};
      let newCrs = crs;
      const vesselEffects: Effect[] = [...(vessel?.innate ?? [])];
      if (vessel?.mechanic === 'catalogo') {
        const bonus = catalogoBonus(vessel, state.deck);
        if (bonus > 0) vesselEffects.push({ kind: 'addFichas', n: bonus });
      }
      if (vessel?.mechanic === 'eco') {
        const detected = detectHand(played, context.wildSuit).type;
        const per = vessel.mechanicParams?.perRepeat ?? 1;
        const code = handCode(detected);
        const key = `eco_${detected}`;
        let bonus = crs[key] ?? 0;
        if (code === (crs.ecoLast ?? 0)) bonus += per; // repetiste el mismo tipo de mano
        newCrs = { ...newCrs, [key]: bonus, ecoLast: code };
        if (bonus > 0) vesselEffects.push({ kind: 'addMult', n: bonus });
      }
      if (vessel?.mechanic === 'frenesi') {
        const fre = crs.frenesi ?? 0;
        const mpf = vessel.mechanicParams?.multPerFrenesi ?? 1;
        if (fre > 0) vesselEffects.push({ kind: 'addMult', n: fre * mpf });
        newCrs = { ...newCrs, frenesi: 0 }; // se consume al jugar
      }
      const vesselRelic: ScoringRelic = {
        defId: `vessel.${state.vessel}`,
        onHandPlayed: vesselEffects,
      };
      const corduraMultBonus = bonoMultCordura(state.sanity) * (vessel?.corduraBonusMult ?? 1);
      const result = scoreHand({
        played,
        handLevels: state.handLevels,
        relics: [vesselRelic, ...toScoringRelics(state.relics, registry)],
        corduraMultBonus,
        context,
      });
      const accumulated = c.accumulated + result.score;
      // Coste por mano del jefe (§11.7: El Vaho cordura, El Hambriento monedas).
      const gold = Math.max(0, state.gold + result.coinsGained - (bossMod?.coinsPerHand ?? 0));
      const sanity = clamp(
        state.sanity + result.sanityDelta - (bossMod?.sanityPerHand ?? 0),
        0,
        state.maxSanity,
      );
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
        const reward = combatGoldReward(kind) + interest(gold, 5, vessel?.interestDivisor ?? 5);
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
          combatRelicState: newCrs,
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
          gold: Math.max(0, next.gold + acq.goldDelta),
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
      if ((state.phase !== 'evento' && state.phase !== 'santuario') || !state.pendingEvent) {
        return illegal(state, 'no hay evento');
      }
      const ev = registry.events[state.pendingEvent.eventId];
      const opt = ev?.options.find((o) => o.id === action.choiceId);
      const { pendingEvent: _pendingEvent, ...rest } = state;
      const next: GameState = opt
        ? applyEventEffect({ ...rest, phase: 'mapa' }, opt.effect, registry)
        : { ...rest, phase: 'mapa' };
      return commit(next, action);
    }

    case 'NEXT': {
      switch (state.phase) {
        case 'descanso':
          return commit({ ...state, phase: 'mapa' }, action);
        case 'tienda': {
          const { shop: _shop, ...rest } = state;
          return commit({ ...rest, phase: 'mapa' }, action);
        }
        case 'evento':
        case 'santuario': {
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
      let sanity = state.sanity;
      let rng = state.rng;
      let relics = state.relics;
      let enhancedCount = 0;
      const max = def.maxTargets ?? 3;
      const targets = new Set(action.targets.slice(0, max));
      const firstTargetId = action.targets[0];
      const cardOf = (id: string | undefined) =>
        id ? state.deck.find((c) => c.id === id) : undefined;

      const needsTargets =
        def.applyEnhancement !== undefined ||
        def.applySeal !== undefined ||
        def.rankDelta !== undefined ||
        def.destroyTargets ||
        def.duplicateTargets ||
        def.changeSuitToFirst ||
        def.matchRankToFirst;
      if (needsTargets && targets.size === 0)
        return illegal(state, 'el augurio necesita objetivos');

      const refSuit = def.changeSuitToFirst ? cardOf(firstTargetId)?.suit : undefined;
      const refRank = def.matchRankToFirst ? cardOf(firstTargetId)?.rank : undefined;
      if (def.applyEnhancement !== undefined) enhancedCount = targets.size;

      deck = state.deck.map((card) => {
        if (!targets.has(card.id)) return card;
        let c = card;
        if (def.applyEnhancement !== undefined) c = { ...c, enhancement: def.applyEnhancement };
        if (def.applySeal !== undefined) c = { ...c, seal: def.applySeal };
        if (def.rankDelta !== undefined && c.rank !== null) {
          c = { ...c, rank: Math.max(2, Math.min(14, c.rank + def.rankDelta)) as Rank };
        }
        if (refSuit !== undefined) c = { ...c, suit: refSuit };
        if (refRank !== undefined && refRank !== null) c = { ...c, rank: refRank };
        return c;
      });
      if (def.duplicateTargets) {
        const dups = deck
          .filter((card) => targets.has(card.id))
          .map((card, i) => ({ ...card, id: `${card.id}__dup${state.deck.length + i}` }));
        deck = [...deck, ...dups];
      }
      if (def.destroyTargets) deck = deck.filter((card) => !targets.has(card.id));

      if (def.levelUpHand === 'all') {
        const all: Record<string, { level: number }> = {};
        for (const [k, v] of Object.entries(state.handLevels)) all[k] = { level: v.level + 1 };
        handLevels = all;
      } else if (def.levelUpHand) {
        const cur = state.handLevels[def.levelUpHand] ?? { level: 1 };
        handLevels = { ...state.handLevels, [def.levelUpHand]: { level: cur.level + 1 } };
      }

      // Conjuros
      if (def.sanityToZero) sanity = 0;
      else if (def.sanityDelta) sanity = clamp(sanity + def.sanityDelta, 0, state.maxSanity);
      if (def.destroyRandomDeck) {
        const d = destroyRandomFromDeck(rng, deck, def.destroyRandomDeck);
        deck = d.deck;
        rng = d.rng;
      }
      if (def.gainRandomRelicRarity && relics.length < state.relicSlots) {
        const owned = new Set(relics.map((r) => r.defId));
        const candidates = Object.values(registry.relics).filter(
          (r) => r.rarity === def.gainRandomRelicRarity && !r.vessel && !owned.has(r.id),
        );
        if (candidates.length > 0) {
          const reward = cloneRngState(rng.reward);
          const pick = candidates[nextInt(reward, 0, candidates.length - 1)];
          rng = { ...rng, reward };
          if (pick) relics = [...relics, { defId: pick.id }];
        }
      }

      const consumables = state.consumables.filter((_, i) => i !== idx);
      relics = applyScalersOnEnhanced(relics, registry, enhancedCount);
      return commit({ ...state, deck, handLevels, sanity, rng, consumables, relics }, action);
    }

    case 'BUY': {
      if (state.phase !== 'tienda' || !state.shop) return illegal(state, 'no estas en la tienda');
      const item = state.shop.items.find((i) => i.id === action.shopItemId);
      if (!item) return illegal(state, 'articulo no disponible');
      if (state.gold < item.cost) return illegal(state, 'oro insuficiente');
      let next: GameState = { ...state, gold: state.gold - item.cost };
      if (item.kind === 'relic') {
        if (next.relics.length >= next.relicSlots) return illegal(state, 'sin slots de reliquia');
        const acq = acquireEffect(item.payloadId, registry);
        const maxCandles = Math.max(1, next.maxCandles + acq.maxCandlesDelta);
        next = {
          ...next,
          relics: [...next.relics, { defId: item.payloadId }],
          maxCandles,
          candles: Math.min(next.candles, maxCandles),
          sanity: clamp(next.sanity + acq.sanityDelta, 0, next.maxSanity),
          gold: Math.max(0, next.gold + acq.goldDelta),
        };
      } else if (item.kind === 'arcano') {
        if (next.consumables.length >= next.consumableSlots) {
          return illegal(state, 'sin slots de arcano');
        }
        next = { ...next, consumables: [...next.consumables, { defId: item.payloadId }] };
      } else {
        if (next.vouchers.includes(item.payloadId)) return illegal(state, 'ya tienes ese vale');
        const v = voucherStatEffect(item.payloadId, registry);
        const maxCandles = next.maxCandles + v.maxCandles;
        const maxSanity = next.maxSanity + v.maxSanity;
        next = {
          ...next,
          vouchers: [...next.vouchers, item.payloadId],
          relicSlots: next.relicSlots + v.relicSlots,
          consumableSlots: next.consumableSlots + v.consumableSlots,
          maxCandles,
          candles: next.candles + v.maxCandles,
          maxSanity,
          sanity: Math.min(maxSanity, next.sanity + v.maxSanity),
          baseCombat: {
            hands: next.baseCombat.hands + v.hands,
            discards: next.baseCombat.discards + v.discards,
            handSize: next.baseCombat.handSize + v.handSize,
          },
        };
      }
      const shop = { ...state.shop, items: state.shop.items.filter((i) => i.id !== item.id) };
      return commit({ ...next, shop }, action);
    }

    case 'SELL_RELIC': {
      const blocked = state.relics.some(
        (r) => r.defId === 'relic.cadena' || r.defId === 'relic.usurero.avaricia',
      );
      if (blocked) return illegal(state, 'no puedes vender reliquias (Cadena/Avaricia)');
      const idx = state.relics.findIndex((r) => r.defId === action.relicId);
      if (idx === -1) return illegal(state, 'no tienes esa reliquia');
      const def = registry.relics[action.relicId];
      const refund = def ? Math.floor(def.cost * 0.5) : 0;
      const relics = state.relics.filter((_, i) => i !== idx);
      return commit({ ...state, relics, gold: state.gold + refund }, action);
    }

    case 'REROLL_SHOP': {
      if (state.phase !== 'tienda' || !state.shop) return illegal(state, 'no estas en la tienda');
      if (state.gold < state.shop.rerollCost) return illegal(state, 'oro insuficiente para reroll');
      const sm = voucherShopMods(state.vouchers, registry);
      const shopRng = cloneRngState(state.rng.shop);
      const fresh = generateShop(registry, shopRng, {
        sima: state.sima,
        ownedRelicIds: new Set(state.relics.map((r) => r.defId)),
        ownedVoucherIds: new Set(state.vouchers),
        shopDiscount: sm.shopDiscount,
        rerollDiscount: sm.rerollDiscount,
        extraItems: sm.extraItems,
      });
      const shop = {
        ...fresh,
        rerollCost: state.shop.rerollCost + 1,
        rerollsThisVisit: state.shop.rerollsThisVisit + 1,
      };
      return commit(
        {
          ...state,
          gold: state.gold - state.shop.rerollCost,
          rng: { ...state.rng, shop: shopRng },
          shop,
        },
        action,
      );
    }

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
