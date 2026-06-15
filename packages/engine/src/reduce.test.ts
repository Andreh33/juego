import { describe, expect, it } from 'vitest';
import type { StartRunAction } from './actions';
import { reachableNodes, reduce, replay, startRun } from './reduce';
import type { CombatState, GameState, UmbralMap } from './types';

const START: StartRunAction = {
  type: 'START_RUN',
  seed: 'test-seed',
  vessel: 'heraldo',
  ruleset: 1,
};

function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`indice ${i} fuera de rango`);
  return v;
}
function combatOf(s: GameState): CombatState {
  if (!s.combat) throw new Error('no hay combate');
  return s.combat;
}
function mapOf(s: GameState): UmbralMap {
  if (!s.map) throw new Error('no hay mapa');
  return s.map;
}

/** Inicia un run y entra en un nodo de combate de la fila 0. */
function enterCombat(seed: string): GameState {
  const s0 = startRun({ ...START, seed });
  const row0 = mapOf(s0).nodes.filter((n) => n.row === 0);
  const combatNode = row0.find((n) => n.type === 'combate' || n.type === 'elite');
  if (!combatNode) throw new Error(`la seed '${seed}' no tiene combate en la fila 0`);
  const s = reduce(s0, { type: 'CHOOSE_NODE', nodeId: combatNode.id }).state;
  if (s.phase !== 'combate') throw new Error('no se entro en combate');
  return s;
}

describe('startRun (mapa)', () => {
  it('es determinista', () => {
    expect(startRun(START)).toEqual(startRun(START));
  });

  it('arranca en el mapa, sin combate, con recursos base', () => {
    const s = startRun(START);
    expect(s.phase).toBe('mapa');
    expect(s.combat).toBeNull();
    expect(s.umbral).toBe(1);
    expect(s.sima).toBe(1);
    expect(s.candles).toBe(3);
    expect(s.sanity).toBe(100);
    expect(s.runScore).toBe(0);
    expect(s.baseCombat).toEqual({ hands: 4, discards: 3, handSize: 8 });
    expect(s.log).toEqual([START]);
  });

  it('genera un mapa con jefe en la fila final y nodos accesibles', () => {
    const map = mapOf(startRun(START));
    const boss = map.nodes.find((n) => n.type === 'jefe');
    expect(boss).toBeDefined();
    expect(reachableNodes(map).length).toBeGreaterThan(0);
    // todos los nodos de fila 0 son accesibles al inicio
    expect(reachableNodes(map).every((n) => n.row === 0)).toBe(true);
  });
});

describe('navegacion del mapa', () => {
  it('CHOOSE_NODE de un nodo no accesible es ilegal', () => {
    const s = startRun(START);
    const res = reduce(s, { type: 'CHOOSE_NODE', nodeId: 'no_existe' });
    expect(res.state).toEqual(s);
    expect(res.events[0]?.t).toBe('error');
  });

  it('acciones de combate son ilegales en el mapa', () => {
    const s = startRun(START);
    for (const a of [{ type: 'PLAY_HAND' }, { type: 'DISCARD' }] as const) {
      expect(reduce(s, a).events[0]?.t).toBe('error');
    }
  });
});

describe('combate', () => {
  it('entrar en un combate reparte 8 cartas y fija objetivo', () => {
    const c = combatOf(enterCombat('combat-seed'));
    expect(c.hand).toHaveLength(8);
    expect(c.drawPile).toHaveLength(44);
    expect(c.objective).toBeGreaterThan(0);
    expect(c.handsLeft).toBe(4);
  });

  it('SELECT/DESELECT en orden', () => {
    const s0 = enterCombat('combat-seed');
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 1) }).state;
    s = reduce(s, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    expect(combatOf(s).selected).toEqual([at(h, 1), at(h, 0)]);
    s = reduce(s, { type: 'DESELECT_CARD', cardId: at(h, 1) }).state;
    expect(combatOf(s).selected).toEqual([at(h, 0)]);
  });

  it('DISCARD repone y gasta un descarte', () => {
    const s0 = enterCombat('combat-seed');
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    s = reduce(s, { type: 'DISCARD' }).state;
    expect(combatOf(s).hand).toHaveLength(8);
    expect(combatOf(s).discardsLeft).toBe(2);
  });

  it('PLAY_HAND acumula puntuacion', () => {
    const s0 = enterCombat('combat-seed');
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    s = reduce(s, { type: 'PLAY_HAND' }).state;
    // o sigue en combate con accumulated > 0, o ya gano (poco probable con 1 carta)
    if (s.combat) expect(s.combat.accumulated).toBeGreaterThan(0);
  });

  it('agotar manos sin objetivo apaga una vela', () => {
    let s = enterCombat('combat-seed');
    // jugar 1 carta floja repetidamente hasta agotar manos
    for (let i = 0; i < 4 && s.phase === 'combate'; i++) {
      const c = combatOf(s);
      // elegir la carta de menor valor para no ganar por accidente
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c.hand, 0) }).state;
      s = reduce(s, { type: 'PLAY_HAND' }).state;
    }
    // tras 4 manos flojas o se perdio (vela -1) o, improbablemente, se gano
    expect(['mapa', 'recompensa', 'fin'].includes(s.phase)).toBe(true);
    if (s.phase === 'mapa') expect(s.candles).toBe(2);
  });
});

describe('Cordura afecta el scoring (§10.3)', () => {
  it('Cordura baja da mas puntuacion (bono de mult)', () => {
    const base = enterCombat('cordura-seed');
    const sel = combatOf(base).hand.slice(0, 2);
    const play = (sanity: number): number => {
      let s: GameState = { ...base, sanity };
      for (const id of sel) s = reduce(s, { type: 'SELECT_CARD', cardId: id }).state;
      s = reduce(s, { type: 'PLAY_HAND' }).state;
      return s.combat ? s.combat.accumulated : s.runScore;
    };
    expect(play(0)).toBeGreaterThan(play(100));
  });
});

describe('recompensa', () => {
  it('ganar lleva a recompensa; coger reliquia la anade', () => {
    // forzamos victoria con muchas manos para superar el objetivo
    const s0 = (() => {
      const start = startRun({ ...START, seed: 'win-seed', modifiers: { hands: 60 } });
      const row0 = mapOf(start).nodes.filter((n) => n.row === 0);
      const node = row0.find((n) => n.type === 'combate' || n.type === 'elite');
      if (!node) throw new Error('sin combate en fila 0 para win-seed');
      return reduce(start, { type: 'CHOOSE_NODE', nodeId: node.id }).state;
    })();
    let s = s0;
    let guard = 0;
    while (s.phase === 'combate' && guard++ < 200) {
      const c = combatOf(s);
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c.hand, 0) }).state;
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c.hand, 1) }).state;
      s = reduce(s, { type: 'PLAY_HAND' }).state;
    }
    expect(s.phase).toBe('recompensa');
    expect(s.pendingReward).toBeDefined();
    const relic = s.pendingReward?.options.find((o) => o.kind === 'relic');
    if (relic) {
      const after = reduce(s, { type: 'PICK_REWARD', rewardId: relic.id }).state;
      expect(after.relics.length).toBe(1);
      expect(after.phase).toBe('mapa');
    }
  });

  it('SKIP_REWARD da oro y vuelve al mapa', () => {
    const s0 = (() => {
      const start = startRun({ ...START, seed: 'win-seed', modifiers: { hands: 60 } });
      const node = mapOf(start)
        .nodes.filter((n) => n.row === 0)
        .find((n) => n.type === 'combate' || n.type === 'elite');
      if (!node) throw new Error('sin combate');
      return reduce(start, { type: 'CHOOSE_NODE', nodeId: node.id }).state;
    })();
    let s = s0;
    let guard = 0;
    while (s.phase === 'combate' && guard++ < 200) {
      const c = combatOf(s);
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c.hand, 0) }).state;
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c.hand, 1) }).state;
      s = reduce(s, { type: 'PLAY_HAND' }).state;
    }
    const goldBefore = s.gold;
    const after = reduce(s, { type: 'SKIP_REWARD' }).state;
    expect(after.gold).toBe(goldBefore + 6);
    expect(after.phase).toBe('mapa');
  });
});

// ---- Simulacion end-to-end (DoD) ----

interface SimResult {
  state: GameState;
  enteredBoss: boolean;
  maxUmbral: number;
  steps: number;
}

/** Heuristica: prefiere nodos no-combate (preserva velas) y juega las manos. */
function step(s: GameState): GameState {
  switch (s.phase) {
    case 'mapa': {
      const opts = reachableNodes(mapOf(s));
      const pick = opts.find((n) => n.type !== 'combate' && n.type !== 'elite') ?? opts[0];
      if (!pick)
        return {
          ...s,
          phase: 'fin',
          result: { status: 'abandoned', depth: s.umbral, score: s.runScore },
        };
      return reduce(s, { type: 'CHOOSE_NODE', nodeId: pick.id }).state;
    }
    case 'combate': {
      const c = combatOf(s);
      const sel = c.hand.slice(0, Math.min(5, c.hand.length));
      let st = s;
      for (const id of sel) st = reduce(st, { type: 'SELECT_CARD', cardId: id }).state;
      return reduce(st, { type: 'PLAY_HAND' }).state;
    }
    case 'recompensa':
      return reduce(s, { type: 'SKIP_REWARD' }).state;
    case 'descanso':
      return reduce(s, { type: 'REST_ACTION', kind: 'heal' }).state;
    case 'tienda':
    case 'evento':
    case 'santuario':
      return reduce(s, { type: 'NEXT' }).state;
    default:
      return s;
  }
}

function simulate(seed: string, modifiers?: StartRunAction['modifiers']): SimResult {
  let s = startRun({ ...START, seed, ...(modifiers ? { modifiers } : {}) });
  let enteredBoss = false;
  let maxUmbral = s.umbral;
  let steps = 0;
  while (s.phase !== 'fin' && steps < 20000) {
    s = step(s);
    steps++;
    if (s.combat?.bossId?.startsWith('boss.')) enteredBoss = true;
    if (s.umbral > maxUmbral) maxUmbral = s.umbral;
  }
  return { state: s, enteredBoss, maxUmbral, steps };
}

describe('simulacion end-to-end (sin render)', () => {
  it('un run debil termina en muerte, determinista y sin colgarse', () => {
    const a = simulate('sim-weak');
    expect(a.state.phase).toBe('fin');
    expect(a.state.result?.status).toBeDefined();
    expect(a.steps).toBeLessThan(20000);
    // determinismo: re-simular da el mismo resultado y replay reconstruye el estado
    const b = simulate('sim-weak');
    expect(b.state).toEqual(a.state);
    expect(replay(a.state.log)).toEqual(a.state);
  });

  it('el run llega al jefe (entra en el combate de jefe) y termina', () => {
    const r = simulate('sim-weak');
    expect(r.state.phase).toBe('fin');
    expect(r.enteredBoss).toBe(true); // enruta por nodos de servicio y pelea al jefe
    expect(r.state.result?.status).toBe('lost');
  });
});

describe('event-sourcing: replay (INV-4)', () => {
  it('reaplicar el log de un run completo reconstruye el estado', () => {
    const { state } = simulate('replay-seed');
    expect(replay(state.log)).toEqual(state);
  });

  it('TICK no se registra ni cambia el estado', () => {
    const s = startRun(START);
    const res = reduce(s, { type: 'TICK', ms: 16 });
    expect(res.state).toBe(s);
    expect(res.events).toEqual([]);
  });
});
