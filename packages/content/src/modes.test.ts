import { type GameState, reduce, startRun } from '@umbral/engine';
import { describe, expect, it } from 'vitest';
import { CHALLENGES, dailySeed, dailyVessel, REGISTRY, weeklyId, weeklyMutator } from './index';

describe('semillas diaria/semanal (§12.5)', () => {
  it('son deterministas', () => {
    expect(dailySeed('2026-06-14')).toBe(dailySeed('2026-06-14'));
    expect(dailySeed('2026-06-14')).not.toBe(dailySeed('2026-06-15'));
    const w = weeklyId('2026-06-14');
    expect(weeklyId('2026-06-14')).toBe(w);
    expect(weeklyMutator(w)).toBe(weeklyMutator(w));
  });

  it('el Recipiente del dia es valido', () => {
    expect(REGISTRY.vessels[dailyVessel('2026-06-14')]).toBeDefined();
  });
});

describe('desafios (§12.7)', () => {
  it('hay 20 desafios con id unico', () => {
    expect(CHALLENGES).toHaveLength(20);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(20);
  });

  it('Mazo Minimo recorta el mazo a 20', () => {
    const ch = CHALLENGES.find((c) => c.id === 'desafio.mazo_minimo');
    if (!ch) throw new Error('sin desafio');
    const s = startRun(
      {
        type: 'START_RUN',
        seed: 'c',
        vessel: ch.vessel,
        ruleset: 1,
        mode: 'desafio',
        challengeId: ch.id,
        modifiers: ch.modifiers,
      },
      REGISTRY,
    );
    expect(s.deck).toHaveLength(20);
    expect(s.mode).toBe('desafio');
    expect(s.challengeId).toBe('desafio.mazo_minimo');
  });

  it('El Avaro empieza con 200 oro', () => {
    const ch = CHALLENGES.find((c) => c.id === 'desafio.el_avaro');
    if (!ch) throw new Error('sin desafio');
    const s = startRun(
      {
        type: 'START_RUN',
        seed: 'c',
        vessel: ch.vessel,
        ruleset: 1,
        mode: 'desafio',
        modifiers: ch.modifiers,
      },
      REGISTRY,
    );
    expect(s.gold).toBe(200);
  });
});

describe('Modo Infinito (§9.6)', () => {
  function bossWinState(mode: GameState['mode']): GameState {
    const base = startRun(
      { type: 'START_RUN', seed: 'inf', vessel: 'heraldo', ruleset: 1, mode },
      REGISTRY,
    );
    const map = base.map;
    if (!map) throw new Error('sin mapa');
    const boss = map.nodes.find((n) => n.type === 'jefe');
    if (!boss) throw new Error('sin jefe');
    return {
      ...base,
      umbral: 8,
      sima: 3,
      map: { ...map, currentNodeId: boss.id },
      phase: 'recompensa',
      pendingReward: { options: [] },
    };
  }

  it('en Infinito, vencer el Umbral 8 continua el descenso', () => {
    const after = reduce(bossWinState('infinito'), { type: 'SKIP_REWARD' }, REGISTRY).state;
    expect(after.phase).toBe('mapa');
    expect(after.umbral).toBe(9);
  });

  it('en Carrera, vencer el Umbral 8 es victoria', () => {
    const after = reduce(bossWinState('carrera'), { type: 'SKIP_REWARD' }, REGISTRY).state;
    expect(after.phase).toBe('fin');
    expect(after.result?.status).toBe('won');
  });
});
