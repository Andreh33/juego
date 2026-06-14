import { describe, expect, it } from 'vitest';
import type { GameAction, StartRunAction } from './actions';
import { createBlankState, reduce, replay, startRun } from './reduce';
import type { CombatState, GameState } from './types';

const START: StartRunAction = {
  type: 'START_RUN',
  seed: 'test-seed',
  vessel: 'heraldo',
  ruleset: 1,
};

/** Acceso a array con chequeo (evita non-null assertions). */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`indice ${i} fuera de rango`);
  return v;
}

function combatOf(s: GameState): CombatState {
  if (!s.combat) throw new Error('no hay combate');
  return s.combat;
}

describe('startRun', () => {
  it('es determinista: misma seed -> estado identico', () => {
    expect(startRun(START)).toEqual(startRun(START));
  });

  it('inicializa el run y abre un combate', () => {
    const s = startRun(START);
    expect(s.schemaVersion).toBe(1);
    expect(s.rulesetVersion).toBe(1);
    expect(s.seed).toBe('test-seed');
    expect(s.vessel).toBe('heraldo');
    expect(s.phase).toBe('combate');
    expect(s.candles).toBe(3);
    expect(s.sanity).toBe(100);
    expect(s.relicSlots).toBe(5);
    expect(s.log).toEqual([START]);
  });

  it('construye un mazo de 52 cartas unicas', () => {
    const s = startRun(START);
    expect(s.deck).toHaveLength(52);
    expect(new Set(s.deck.map((c) => c.id)).size).toBe(52);
  });

  it('reparte 8 cartas en mano y 44 en el mazo', () => {
    const c = combatOf(startRun(START));
    expect(c.hand).toHaveLength(8);
    expect(c.drawPile).toHaveLength(44);
    expect(c.selected).toHaveLength(0);
    expect(c.handsLeft).toBe(4);
    expect(c.discardsLeft).toBe(3);
    expect(c.objective).toBe(300);
  });

  it('seeds distintas reparten manos distintas', () => {
    const a = combatOf(startRun(START));
    const b = combatOf(startRun({ ...START, seed: 'otra' }));
    expect(a.hand).not.toEqual(b.hand);
  });

  it('respeta los modificadores de inicio', () => {
    const s = startRun({ ...START, modifiers: { startingCandles: 1, handSize: 6, hands: 1 } });
    expect(s.candles).toBe(1);
    expect(combatOf(s).handSize).toBe(6);
    expect(combatOf(s).hand).toHaveLength(6);
    expect(combatOf(s).handsLeft).toBe(1);
  });
});

describe('seleccion de cartas', () => {
  it('SELECT anade en orden; DESELECT quita', () => {
    const s0 = startRun(START);
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 2) }).state;
    s = reduce(s, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    expect(combatOf(s).selected).toEqual([at(h, 2), at(h, 0)]);
    s = reduce(s, { type: 'DESELECT_CARD', cardId: at(h, 2) }).state;
    expect(combatOf(s).selected).toEqual([at(h, 0)]);
  });

  it('rechaza seleccionar una carta que no esta en mano', () => {
    const s0 = startRun(START);
    const res = reduce(s0, { type: 'SELECT_CARD', cardId: 'NO_EXISTE' });
    expect(res.state).toEqual(s0); // estado sin cambios
    expect(res.events).toEqual([{ t: 'error', reason: 'la carta no esta en tu mano' }]);
    expect(res.state.log).toEqual(s0.log); // no se registra
  });

  it('rechaza reseleccionar y supera el maximo de 5', () => {
    const s0 = startRun(START);
    const h = combatOf(s0).hand;
    let s = s0;
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'SELECT_CARD', cardId: at(h, i) }).state;
    expect(combatOf(s).selected).toHaveLength(5);
    const sixth = reduce(s, { type: 'SELECT_CARD', cardId: at(h, 5) });
    expect(sixth.events).toEqual([{ t: 'error', reason: 'maximo 5 cartas' }]);
    const dup = reduce(s, { type: 'SELECT_CARD', cardId: at(h, 0) });
    expect(dup.events[0]).toEqual({ t: 'error', reason: 'carta ya seleccionada' });
  });
});

describe('REORDER_HAND', () => {
  it('acepta una permutacion y rechaza lo que no lo es', () => {
    const s0 = startRun(START);
    const h = combatOf(s0).hand;
    const reversed = [...h].reverse();
    const ok = reduce(s0, { type: 'REORDER_HAND', order: reversed });
    expect(combatOf(ok.state).hand).toEqual(reversed);
    const bad = reduce(s0, { type: 'REORDER_HAND', order: h.slice(0, 7) });
    expect(bad.state).toEqual(s0);
    expect(bad.events[0]?.t).toBe('error');
  });
});

describe('DISCARD y PLAY_HAND (sin scoring en Bloque 2)', () => {
  it('DISCARD repone hasta 8 y gasta un descarte', () => {
    const s0 = startRun(START);
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    s = reduce(s, { type: 'SELECT_CARD', cardId: at(h, 1) }).state;
    s = reduce(s, { type: 'DISCARD' }).state;
    const c = combatOf(s);
    expect(c.hand).toHaveLength(8);
    expect(c.drawPile).toHaveLength(42);
    expect(c.discardsLeft).toBe(2);
    expect(c.selected).toHaveLength(0);
    expect(c.hand).not.toContain(at(h, 0));
  });

  it('DISCARD ilegal sin seleccion', () => {
    const s0 = startRun(START);
    const res = reduce(s0, { type: 'DISCARD' });
    expect(res.events[0]).toEqual({ t: 'error', reason: 'no hay cartas seleccionadas' });
  });

  it('PLAY_HAND consume una mano y repone, sin tocar la puntuacion', () => {
    const s0 = startRun(START);
    const h = combatOf(s0).hand;
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(h, 0) }).state;
    s = reduce(s, { type: 'PLAY_HAND' }).state;
    const c = combatOf(s);
    expect(c.handsLeft).toBe(3);
    expect(c.accumulated).toBe(0); // sin scoring todavia
    expect(c.hand).toHaveLength(8);
    expect(c.selected).toHaveLength(0);
  });

  it('PLAY_HAND ilegal sin seleccion', () => {
    const res = reduce(startRun(START), { type: 'PLAY_HAND' });
    expect(res.events[0]?.t).toBe('error');
  });
});

describe('SCRY_BURY', () => {
  it('manda una carta del mazo al fondo', () => {
    const s0 = startRun(START);
    const top = at(combatOf(s0).drawPile, 0);
    const s = reduce(s0, { type: 'SCRY_BURY', cardId: top }).state;
    const pile = combatOf(s).drawPile;
    expect(pile).toHaveLength(44);
    expect(at(pile, pile.length - 1)).toBe(top);
    expect(at(pile, 0)).not.toBe(top);
  });
});

describe('TICK y acciones de fases posteriores', () => {
  it('TICK no cambia el estado ni se registra', () => {
    const s0 = startRun(START);
    const res = reduce(s0, { type: 'TICK', ms: 16 });
    expect(res.state).toBe(s0);
    expect(res.events).toEqual([]);
  });

  it('las acciones de mapa/tienda son ilegales en este bloque', () => {
    const s0 = startRun(START);
    for (const a of [
      { type: 'CHOOSE_NODE', nodeId: 'x' },
      { type: 'BUY', shopItemId: 'x' },
      { type: 'NEXT' },
    ] as const) {
      const res = reduce(s0, a);
      expect(res.state).toEqual(s0);
      expect(res.events[0]?.t).toBe('error');
    }
  });
});

describe('event-sourcing: log y replay (DoD)', () => {
  it('el log contiene solo acciones aplicadas y reaplicarlo reconstruye el estado', () => {
    let s = reduce(createBlankState(), START).state;
    const acts: GameAction[] = [START];
    const apply = (a: GameAction) => {
      acts.push(a);
      s = reduce(s, a).state;
    };
    apply({ type: 'SELECT_CARD', cardId: at(combatOf(s).hand, 0) });
    apply({ type: 'SELECT_CARD', cardId: at(combatOf(s).hand, 1) });
    apply({ type: 'PLAY_HAND' });
    apply({ type: 'SELECT_CARD', cardId: at(combatOf(s).hand, 0) });
    apply({ type: 'DISCARD' });

    // Una accion ilegal NO se registra ni cambia el estado.
    const illegalRes = reduce(s, { type: 'SELECT_CARD', cardId: 'NO_EXISTE' });
    expect(illegalRes.state.log).toEqual(s.log);

    // Un TICK no se registra.
    s = reduce(s, { type: 'TICK', ms: 8 }).state;

    expect(s.log).toEqual(acts);
    expect(replay(s.log)).toEqual(s);
  });

  it('mismo log -> mismo estado (determinismo)', () => {
    const log: GameAction[] = [START, { type: 'PLAY_HAND' }];
    // PLAY_HAND aqui es ilegal (sin seleccion) -> no cambia nada; aun asi determinista.
    expect(replay(log)).toEqual(replay(log));
  });

  it('REORDER_RELICS con cero reliquias es un no-op legal', () => {
    const s0 = startRun(START);
    const res = reduce(s0, { type: 'REORDER_RELICS', order: [] });
    expect(res.events).toEqual([]);
    expect(res.state.relics).toEqual([]);
    expect(res.state.log.at(-1)).toEqual({ type: 'REORDER_RELICS', order: [] });
  });
});
