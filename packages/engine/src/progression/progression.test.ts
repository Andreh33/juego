import { describe, expect, it } from 'vitest';
import { EMPTY_REGISTRY } from '../content/dsl';
import { createBlankState } from '../reduce';
import type { GameState } from '../types';
import {
  applyRunToProfile,
  buildStatBag,
  condMet,
  emptyProfile,
  grantAchievements,
  grantUnlocks,
  summarizeRun,
} from './progression';
import type { AchievementDef, RunSummary, UnlockDef } from './types';

function wonRun(over: Partial<RunSummary> = {}): RunSummary {
  return {
    won: true,
    vessel: 'heraldo',
    veil: 0,
    depth: 8,
    mode: 'carrera',
    bestHandScore: 1200,
    minSanity: 100,
    touchedSanity0: false,
    candlesLost: 0,
    goldPeak: 50,
    goldEarned: 120,
    maxDiscardsUsed: 2,
    malditasHeld: 0,
    relicCount: 4,
    relicsHeld: ['relic.brasa'],
    enhancedCards: 0,
    noXmultRelics: true,
    noFlatRelics: false,
    singleSuitDeck: false,
    bossesDefeated: ['boss.a', 'elite.b'],
    eventsResolved: ['evento.x'],
    ...over,
  };
}

describe('condMet (DSL de condiciones)', () => {
  const bag = { a: 5, b: 0 };
  it('gte/lte/eq', () => {
    expect(condMet({ key: 'a', gte: 5 }, bag)).toBe(true);
    expect(condMet({ key: 'a', gte: 6 }, bag)).toBe(false);
    expect(condMet({ key: 'a', lte: 5 }, bag)).toBe(true);
    expect(condMet({ key: 'missing', eq: 0 }, bag)).toBe(true);
  });
  it('all/any', () => {
    expect(
      condMet(
        {
          all: [
            { key: 'a', gte: 1 },
            { key: 'b', eq: 0 },
          ],
        },
        bag,
      ),
    ).toBe(true);
    expect(
      condMet(
        {
          all: [
            { key: 'a', gte: 1 },
            { key: 'b', eq: 1 },
          ],
        },
        bag,
      ),
    ).toBe(false);
    expect(
      condMet(
        {
          any: [
            { key: 'a', gte: 99 },
            { key: 'b', eq: 0 },
          ],
        },
        bag,
      ),
    ).toBe(true);
  });
});

describe('perfil: acumulacion no destructiva', () => {
  it('suma contadores y une conjuntos', () => {
    let p = emptyProfile();
    p = applyRunToProfile(p, wonRun({ goldEarned: 600, vessel: 'heraldo' }));
    p = applyRunToProfile(
      p,
      wonRun({ goldEarned: 600, vessel: 'vidente', relicsHeld: ['relic.tridente'] }),
    );
    expect(p.runsWon).toBe(2);
    expect(p.goldEarned).toBe(1200);
    expect(p.vesselsWon.sort()).toEqual(['heraldo', 'vidente']);
    expect(p.relicsSeen.sort()).toEqual(['relic.brasa', 'relic.tridente']);
  });

  it('veilCleared solo sube si ganas en ese Velo', () => {
    let p = emptyProfile();
    p = applyRunToProfile(p, wonRun({ veil: 5 }));
    p = applyRunToProfile(p, wonRun({ won: false, veil: 9 })); // perdida en Velo 9: no cuenta
    expect(p.veilCleared.heraldo).toBe(5);
  });
});

describe('concesion de logros/desbloqueos', () => {
  const achs: AchievementDef[] = [
    {
      id: 'a.win',
      name: '',
      desc: '',
      category: 'progreso',
      cond: { key: 'lifetime.runsWon', gte: 1 },
    },
    {
      id: 'a.deep',
      name: '',
      desc: '',
      category: 'profundidad',
      cond: { key: 'lifetime.maxDepth', gte: 99 },
    },
  ];
  const unlocks: UnlockDef[] = [
    {
      id: 'u.vidente',
      name: '',
      desc: '',
      kind: 'recipiente',
      cond: { key: 'wonWith.heraldo', gte: 1 },
    },
  ];

  it('concede los cumplidos y no los demas; sin duplicar', () => {
    let p = emptyProfile();
    const run = wonRun();
    p = applyRunToProfile(p, run);
    const a = grantAchievements(achs, p, run);
    expect(a.granted.map((x) => x.id)).toEqual(['a.win']);
    p = a.profile;
    const u = grantUnlocks(unlocks, p, run);
    expect(u.granted.map((x) => x.id)).toEqual(['u.vidente']);
    p = u.profile;
    // Segunda pasada: nada nuevo.
    expect(grantAchievements(achs, p, run).granted).toHaveLength(0);
    expect(grantUnlocks(unlocks, p, run).granted).toHaveLength(0);
  });

  it('buildStatBag expone claves de run y lifetime', () => {
    const p = applyRunToProfile(emptyProfile(), wonRun());
    const bag = buildStatBag(p, wonRun({ veil: 3 }));
    expect(bag['lifetime.runsWon']).toBe(1);
    expect(bag['run.veil']).toBe(3);
    expect(bag['wonWith.heraldo']).toBe(1);
  });
});

describe('summarizeRun (estado final)', () => {
  it('deriva won/candlesLost desde el GameState', () => {
    const base = createBlankState();
    const s: GameState = {
      ...base,
      vessel: 'heraldo',
      maxCandles: 3,
      candles: 1,
      result: { status: 'won', depth: 8, score: 1000 },
      runStats: {
        bestHandScore: 999,
        minSanity: 40,
        peakGold: 80,
        goldEarned: 200,
        touchedSanity0: false,
        maxDiscardsUsed: 3,
        bossesDefeated: ['boss.a'],
        eventsResolved: [],
      },
    };
    const sum = summarizeRun(s, EMPTY_REGISTRY);
    expect(sum.won).toBe(true);
    expect(sum.candlesLost).toBe(2);
    expect(sum.bestHandScore).toBe(999);
    expect(sum.bossesDefeated).toEqual(['boss.a']);
  });
});
