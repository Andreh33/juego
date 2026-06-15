import { describe, expect, it } from 'vitest';
import { startRun } from '../reduce';
import { BASE_VEIL_MODS, veilMods } from './veils';

describe('Velos (§12.1)', () => {
  it('Velo 0 = base', () => {
    expect(veilMods(0)).toEqual(BASE_VEIL_MODS);
  });

  it('acumula objectiveFactor (Velos 1, 10, 19)', () => {
    expect(veilMods(1).objectiveFactor).toBeCloseTo(1.05, 5);
    expect(veilMods(10).objectiveFactor).toBeCloseTo(1.05 * 1.1, 5);
    expect(veilMods(20).objectiveFactor).toBeCloseTo(1.05 * 1.1 * 1.15, 5);
  });

  it('aplica overrides puntuales acumulativos', () => {
    expect(veilMods(5).startingCandles).toBe(2);
    expect(veilMods(9).handSizeBonus).toBe(-1);
    expect(veilMods(12).startingSanity).toBe(80);
    expect(veilMods(13).draftSize).toBe(1);
    expect(veilMods(15).handsBonus).toBe(-1);
    expect(veilMods(17).shopItemsBonus).toBe(-1);
    expect(veilMods(8).malditaGuaranteed).toBe(true);
    expect(veilMods(18).bossExtraPhase).toBe(true);
  });

  it('clampa fuera de rango', () => {
    expect(veilMods(-3)).toEqual(BASE_VEIL_MODS);
    expect(veilMods(99)).toEqual(veilMods(20));
  });

  it('startRun aplica el Velo al estado base', () => {
    const s0 = startRun({ type: 'START_RUN', seed: 's', vessel: 'heraldo', ruleset: 1, veil: 0 });
    const s9 = startRun({ type: 'START_RUN', seed: 's', vessel: 'heraldo', ruleset: 1, veil: 9 });
    const s12 = startRun({ type: 'START_RUN', seed: 's', vessel: 'heraldo', ruleset: 1, veil: 12 });
    expect(s0.veil).toBe(0);
    expect(s9.veil).toBe(9);
    // Velo 5 reduce velas, Velo 9 reduce hand size, Velo 12 baja Cordura inicial.
    expect(s9.candles).toBe(2);
    expect(s9.baseCombat.handSize).toBe(s0.baseCombat.handSize - 1);
    expect(s12.maxSanity).toBe(80);
  });
});
