import { REGISTRY } from '@umbral/content';
import { describe, expect, it } from 'vitest';
import { MEDIUM } from './policy';
import { runSweep, winRateTarget } from './report';
import { simulateRun } from './run';

describe('simulador de runs (§13.1)', () => {
  it('una run es determinista por seed', () => {
    const a = simulateRun(REGISTRY, { seed: 'det', vessel: 'heraldo', veil: 0, policy: MEDIUM });
    const b = simulateRun(REGISTRY, { seed: 'det', vessel: 'heraldo', veil: 0, policy: MEDIUM });
    expect(a.won).toBe(b.won);
    expect(a.depth).toBe(b.depth);
    expect(a.score).toBe(b.score);
    expect(a.steps).toBe(b.steps);
  });

  it('la politica no se atasca y la run termina', () => {
    const r = simulateRun(REGISTRY, { seed: 'fin', vessel: 'heraldo', veil: 0, policy: MEDIUM });
    expect(r.stalled).toBe(false);
    expect(r.depth).toBeGreaterThanOrEqual(1);
    // El estado final es 'fin' (ganada o perdida): profundidad valida.
    expect(r.summary.depth).toBe(r.depth);
  });

  it('Velos mas altos no son mas faciles que el Velo 0 (monotonia debil)', () => {
    const sweep = runSweep({
      registry: REGISTRY,
      runsPerCell: 3,
      veils: [0, 10],
      vessels: ['heraldo', 'vidente'],
    });
    const v0 = sweep.byVeil.find((b) => b.veil === 0);
    const v10 = sweep.byVeil.find((b) => b.veil === 10);
    expect(v0 && v10).toBeTruthy();
    if (v0 && v10) expect(v10.winRate).toBeLessThanOrEqual(v0.winRate + 0.001);
    // Casi ninguna run debe quedarse atascada (tolerancia: <5% por casos limite de ruta).
    expect(sweep.stalledRuns / sweep.totalRuns).toBeLessThan(0.05);
  });

  it('los objetivos de win-rate decrecen con el Velo (§13.2)', () => {
    expect(winRateTarget(0)[0]).toBeGreaterThan(winRateTarget(20)[0]);
    expect(winRateTarget(20)[1]).toBeLessThanOrEqual(0.08);
  });
});
