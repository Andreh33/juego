// Politicas heuristicas de juego para el balanceo (§13.1). Una politica decide la siguiente
// accion legal dado un estado. No pretende jugar optimo: representa a un "jugador medio"
// (y variantes por arquetipo) para medir win-rate por Velo y uso de reliquias.
import {
  type ContentRegistry,
  detectHand,
  EMPTY_REGISTRY,
  type GameAction,
  type GameState,
  type HandType,
  type MapNode,
  reachableNodes,
} from '@umbral/engine';
import type { Card } from '@umbral/shared';

const HAND_TIER: Record<HandType, number> = {
  carta_alta: 0,
  pareja: 1,
  doble_pareja: 2,
  trio: 3,
  escalera: 4,
  color: 5,
  full: 6,
  poker: 7,
  escalera_color: 8,
  escalera_real: 9,
  quinteto: 10,
  quinteto_color: 11,
  hilera_negra: 12,
};

/** Sesgo por arquetipo: tags de reliquia preferidos al elegir recompensa/tienda (§13.4). */
export interface Policy {
  name: string;
  /** Tags de reliquia que esta politica prioriza (vacio = cualquiera). */
  preferTags: string[];
}

export const MEDIUM: Policy = { name: 'medio', preferTags: [] };
export const ARCHETYPES: Policy[] = [
  MEDIUM,
  { name: 'fichas', preferTags: ['fichas'] },
  { name: 'mult', preferTags: ['mult'] },
  { name: 'xmult', preferTags: ['xmult'] },
  { name: 'retrigger', preferTags: ['retrigger', 'reactiva'] },
  { name: 'economia', preferTags: ['oro', 'economia'] },
  { name: 'escaladoras', preferTags: ['escaladora', 'scaler'] },
];

function combos<T>(arr: readonly T[], k: number): T[][] {
  if (k <= 0 || k > arr.length) return k === 0 ? [[]] : [];
  const [head, ...rest] = arr;
  if (head === undefined) return [];
  const withHead = combos(rest, k - 1).map((c) => [head, ...c]);
  const withoutHead = combos(rest, k);
  return [...withHead, ...withoutHead];
}

function rankVal(c: Card): number {
  return c.rank ?? 0;
}

/** Elige la mejor mano de 5 (o menos) cartas: mayor tier, desempate por suma de rangos. */
function bestSelection(hand: Card[]): Card[] {
  const ranked = hand.filter((c) => c.rank !== null && c.suit !== null);
  const pool = ranked.length > 0 ? ranked : hand;
  const k = Math.min(5, pool.length);
  if (k === 0) return [];
  const candidates = k >= 5 ? combos(pool, 5) : [pool];
  let best: Card[] = candidates[0] ?? [];
  let bestScore = -1;
  for (const combo of candidates) {
    const d = detectHand(combo);
    const tier = HAND_TIER[d.type];
    const sum = combo.filter((c) => d.scoring.has(c.id)).reduce((a, c) => a + rankVal(c), 0);
    const score = tier * 1000 + sum;
    if (score > bestScore) {
      bestScore = score;
      best = combo;
    }
  }
  return best;
}

/** Usa un consumible util en el mapa: sellos (suben nivel de mano) y augurios (mejoran cartas). */
function useConsumable(state: GameState, registry: ContentRegistry): GameAction | null {
  for (const inst of state.consumables) {
    const def = registry.consumables[inst.defId];
    if (!def) continue;
    if (def.levelUpHand) {
      return { type: 'USE_CONSUMABLE', consumableId: inst.defId, targets: [] };
    }
    if (def.applyEnhancement !== undefined || def.applySeal !== undefined) {
      const max = def.maxTargets ?? 3;
      const targets = [...state.deck]
        .filter((c) => c.rank !== null)
        .sort((a, b) => rankVal(b) - rankVal(a))
        .slice(0, max)
        .map((c) => c.id);
      if (targets.length > 0) {
        return { type: 'USE_CONSUMABLE', consumableId: inst.defId, targets };
      }
    }
  }
  return null;
}

/** Tipo de mano "caballo de batalla" con menor nivel, para mejorar en el Descanso. */
function workhorseToUpgrade(state: GameState): HandType {
  const candidates: HandType[] = ['pareja', 'doble_pareja', 'trio'];
  let best: HandType = 'pareja';
  let bestLvl = Number.POSITIVE_INFINITY;
  for (const h of candidates) {
    const lvl = state.handLevels[h]?.level ?? 1;
    if (lvl < bestLvl) {
      bestLvl = lvl;
      best = h;
    }
  }
  return best;
}

function pickNode(nodes: MapNode[], state: GameState): MapNode | undefined {
  if (nodes.length === 0) return undefined;
  const needRest = state.candles < Math.ceil(state.maxCandles / 2) || state.sanity < 30;
  const pref = (n: MapNode): number => {
    switch (n.type) {
      case 'jefe':
        return 100; // hay que vencerlo para descender
      case 'descanso':
      case 'santuario':
        return needRest ? 90 : 20;
      case 'tesoro':
        return 70;
      case 'combate':
        return 60;
      case 'evento':
        return 50;
      case 'tienda':
        return state.gold >= 6 ? 55 : 30;
      case 'elite':
        return 40;
      default:
        return 10;
    }
  };
  return [...nodes].sort((a, b) => pref(b) - pref(a))[0];
}

/** Decide la siguiente accion legal, o null si no hay nada que hacer. */
export function decide(
  state: GameState,
  registry: ContentRegistry = EMPTY_REGISTRY,
  policy: Policy = MEDIUM,
): GameAction | null {
  switch (state.phase) {
    case 'mapa': {
      if (!state.map) return null;
      const cons = useConsumable(state, registry);
      if (cons) return cons;
      const node = pickNode(reachableNodes(state.map), state);
      return node ? { type: 'CHOOSE_NODE', nodeId: node.id } : null;
    }
    case 'combate': {
      const c = state.combat;
      if (!c) return null;
      const byId = new Map(state.deck.map((card) => [card.id, card]));
      const hand = c.hand.map((id) => byId.get(id)).filter((x): x is Card => x !== undefined);
      const sel = bestSelection(hand);
      const weak = HAND_TIER[detectHand(sel).type] < HAND_TIER.trio;
      // Intencion estable durante la seleccion: jugar la mejor mano, o cavar si es floja.
      const dig = weak && c.discardsLeft > 0 && c.handsLeft > 1;
      const desiredIds = dig
        ? [...hand]
            .sort((a, b) => rankVal(a) - rankVal(b))
            .slice(0, 5)
            .map((x) => x.id)
        : sel.map((x) => x.id);
      const desired = new Set(desiredIds);
      const selected = new Set(c.selected);
      // 1) deselecciona lo que sobre. 2) selecciona lo que falte. 3) ejecuta.
      const extra = c.selected.find((id) => !desired.has(id));
      if (extra) return { type: 'DESELECT_CARD', cardId: extra };
      const missing = desiredIds.find((id) => !selected.has(id));
      if (missing) return { type: 'SELECT_CARD', cardId: missing };
      if (desiredIds.length === 0) return null;
      return dig ? { type: 'DISCARD' } : { type: 'PLAY_HAND' };
    }
    case 'recompensa': {
      const opts = state.pendingReward?.options ?? [];
      const relicOpts = opts.filter((o) => o.kind === 'relic');
      const firstRelic = relicOpts[0];
      if (firstRelic && state.relics.length < state.relicSlots) {
        const preferred =
          policy.preferTags.length > 0
            ? relicOpts.find((o) =>
                (registry.relics[o.id]?.tags ?? []).some((t) => policy.preferTags.includes(t)),
              )
            : undefined;
        return { type: 'PICK_REWARD', rewardId: (preferred ?? firstRelic).id };
      }
      return { type: 'SKIP_REWARD' };
    }
    case 'tienda': {
      const shop = state.shop;
      if (shop) {
        const affordable = shop.items.find(
          (i) =>
            i.cost <= state.gold &&
            ((i.kind === 'relic' && state.relics.length < state.relicSlots) ||
              (i.kind === 'arcano' && state.consumables.length < state.consumableSlots) ||
              i.kind === 'vale'),
        );
        if (affordable) return { type: 'BUY', shopItemId: affordable.id };
      }
      return { type: 'NEXT' };
    }
    case 'evento':
    case 'santuario': {
      const ev = state.pendingEvent;
      if (ev) {
        const def = registry.events[ev.eventId];
        const choiceId = def?.options[0]?.id;
        if (choiceId) return { type: 'RESOLVE_EVENT', choiceId };
      }
      return { type: 'NEXT' };
    }
    case 'descanso': {
      // Si la salud aprieta, cura; si no, mejora una mano caballo de batalla (crecer poder).
      const hurt = state.candles < state.maxCandles || state.sanity < 50;
      if (hurt) return { type: 'REST_ACTION', kind: 'heal' };
      return { type: 'REST_ACTION', kind: 'upgrade', target: workhorseToUpgrade(state) };
    }
    default:
      return null;
  }
}
