import { emptyProfile, processRunEnd, reduce, startRun } from '@umbral/engine';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ALL_UNLOCKS, REGISTRY, UNLOCKS } from './index';

describe('catalogos de progresion (§12.2/§12.3)', () => {
  it('hay ~100 logros con id unico', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(95);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('los desbloqueos tienen id unico y cubren las categorias', () => {
    expect(new Set(ALL_UNLOCKS.map((u) => u.id)).size).toBe(ALL_UNLOCKS.length);
    const kinds = new Set(UNLOCKS.map((u) => u.kind));
    for (const k of ['recipiente', 'reliquia', 'mazo', 'mano', 'jefe']) {
      expect(kinds.has(k as never)).toBe(true);
    }
    // Los 5 recipientes desbloqueables.
    expect(UNLOCKS.filter((u) => u.kind === 'recipiente')).toHaveLength(5);
  });
});

describe('processRunEnd con contenido real', () => {
  // Construye un estado final ganado en Velo 0 con el Heraldo.
  function finishedWin() {
    const base = startRun(
      { type: 'START_RUN', seed: 'win', vessel: 'heraldo', ruleset: 1, mode: 'carrera' },
      REGISTRY,
    );
    const map = base.map;
    if (!map) throw new Error('sin mapa');
    const boss = map.nodes.find((n) => n.type === 'jefe');
    if (!boss) throw new Error('sin jefe');
    return reduce(
      {
        ...base,
        umbral: 8,
        sima: 3,
        map: { ...map, currentNodeId: boss.id },
        phase: 'recompensa',
        pendingReward: { options: [] },
      },
      { type: 'SKIP_REWARD' },
      REGISTRY,
    ).state;
  }

  it('una victoria concede "Primer Descenso" y desbloquea al Vidente', () => {
    const state = finishedWin();
    expect(state.result?.status).toBe('won');
    const r = processRunEnd(state, REGISTRY, emptyProfile(), ALL_UNLOCKS, ACHIEVEMENTS);
    const achIds = r.newAchievements.map((a) => a.id);
    expect(achIds).toContain('ach.primer_descenso');
    const unlockIds = r.newUnlocks.map((u) => u.id);
    expect(unlockIds).toContain('unlock.vessel.vidente'); // gana 1 run con Heraldo
    expect(r.profile.runsWon).toBe(1);
  });

  it('no concede dos veces el mismo logro', () => {
    const state = finishedWin();
    const first = processRunEnd(state, REGISTRY, emptyProfile(), ALL_UNLOCKS, ACHIEVEMENTS);
    const second = processRunEnd(state, REGISTRY, first.profile, ALL_UNLOCKS, ACHIEVEMENTS);
    expect(second.newAchievements).toHaveLength(0);
    expect(second.newUnlocks).toHaveLength(0);
  });
});
