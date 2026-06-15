import { type GameState, pickRelicRewards, reduce, startRun } from '@umbral/engine';
import { createRngState, type VesselId } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import { REGISTRY, VESSEL_RELICS, VESSELS } from './index';

function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`indice ${i}`);
  return v;
}

/** Inicia un run de un Recipiente y entra en un combate de la fila 0 (busca seed valida). */
function enterCombat(vessel: VesselId): GameState {
  for (const seed of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9']) {
    const s0 = startRun({ type: 'START_RUN', seed, vessel, ruleset: 1 }, REGISTRY);
    const node = s0.map?.nodes
      .filter((n) => n.row === 0)
      .find((n) => n.type === 'combate' || n.type === 'elite');
    if (!node) continue;
    const s = reduce(s0, { type: 'CHOOSE_NODE', nodeId: node.id }, REGISTRY).state;
    if (s.phase === 'combate' && s.combat) return s;
  }
  throw new Error(`sin seed de combate para ${vessel}`);
}

describe('datos de Recipientes (§8)', () => {
  it('hay 6 Recipientes y 36 reliquias de Recipiente con id unico', () => {
    expect(VESSELS).toHaveLength(6);
    expect(VESSEL_RELICS).toHaveLength(36);
    const ids = VESSEL_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(36);
    for (const r of VESSEL_RELICS) expect(r.vessel).toBeDefined();
  });

  it('cada Recipiente tiene su reliquia inicial en el registro', () => {
    for (const v of VESSELS) expect(REGISTRY.relics[v.startingRelicId]).toBeDefined();
  });
});

describe('setup inicial por Recipiente', () => {
  const start = (vessel: VesselId) =>
    startRun({ type: 'START_RUN', seed: 'setup', vessel, ruleset: 1 }, REGISTRY);

  it('Heraldo: mazo 52, Estandarte, 4 manos', () => {
    const s = start('heraldo');
    expect(s.deck).toHaveLength(52);
    expect(s.relics[0]?.defId).toBe('relic.heraldo.estandarte');
    expect(s.baseCombat.hands).toBe(4);
  });

  it('Vidente: mazo fino de 44', () => {
    expect(start('vidente').deck).toHaveLength(44);
  });

  it('Usurero: empieza con 20 monedas', () => {
    expect(start('usurero').gold).toBe(20);
  });

  it('Coleccionista: 4 cartas con Grabado (una por palo)', () => {
    const s = start('coleccionista');
    expect(s.deck.filter((c) => c.enhancement === 'grabado')).toHaveLength(4);
  });

  it('Bestia: -1 mano (3) y +3 descartes (6)', () => {
    const s = start('bestia');
    expect(s.baseCombat.hands).toBe(3);
    expect(s.baseCombat.discards).toBe(6);
  });

  it('Profano: mazo 48 con 2 sellos Violeta', () => {
    const s = start('profano');
    expect(s.deck).toHaveLength(48);
    expect(s.deck.filter((c) => c.seal === 'violeta')).toHaveLength(2);
  });
});

describe('mecanicas con estado de combate', () => {
  it('Frenesi (Bestia): descartar acumula y jugar lo consume', () => {
    const s0 = enterCombat('bestia');
    const c0 = s0.combat;
    if (!c0) throw new Error('no combat');
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(c0.hand, 0) }, REGISTRY).state;
    s = reduce(s, { type: 'DISCARD' }, REGISTRY).state;
    expect(s.combat?.combatRelicState?.frenesi).toBe(1);
    const c1 = s.combat;
    if (c1) {
      s = reduce(s, { type: 'SELECT_CARD', cardId: at(c1.hand, 0) }, REGISTRY).state;
      s = reduce(s, { type: 'PLAY_HAND' }, REGISTRY).state;
      if (s.combat) expect(s.combat.combatRelicState?.frenesi).toBe(0);
    }
  });

  it('Eco (Heraldo): jugar una mano registra el ultimo tipo', () => {
    const s0 = enterCombat('heraldo');
    const c0 = s0.combat;
    if (!c0) throw new Error('no combat');
    let s = reduce(s0, { type: 'SELECT_CARD', cardId: at(c0.hand, 0) }, REGISTRY).state;
    s = reduce(s, { type: 'PLAY_HAND' }, REGISTRY).state;
    if (s.combat) expect(s.combat.combatRelicState?.ecoLast ?? 0).toBeGreaterThan(0);
  });
});

describe('pool de recompensa', () => {
  it('nunca ofrece reliquias exclusivas de Recipiente', () => {
    const picks = pickRelicRewards(REGISTRY, createRngState('pool'), 3, 20, new Set());
    for (const p of picks) {
      expect(REGISTRY.relics[p.id]?.vessel).toBeUndefined();
    }
  });
});
