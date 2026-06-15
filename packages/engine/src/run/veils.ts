// Velos: escalera de dificultad 0-20 por Recipiente (§12.1). Cada Velo ANADE su modificador
// a todos los anteriores (acumulativo). Aqui se expresa la parte mecanica; los efectos
// puramente visuales/de fase (alucinaciones, fase extra de jefe) se marcan como flags para
// los bloques de feel (B18). Datos -> el engine los interpreta (§5.4).

export interface VeilMods {
  /** Factor multiplicativo sobre TODOS los objetivos (combate/elite/jefe). */
  objectiveFactor: number;
  /** Factor multiplicativo extra sobre el objetivo de jefes/elites. */
  bossObjectiveFactor: number;
  /** Factor multiplicativo sobre el coste de la tienda. */
  shopCostFactor: number;
  /** Sumando al coste de reroll de tienda. */
  rerollCostBonus: number;
  /** Velas iniciales (override del base 3). */
  startingCandles: number;
  /** Cordura inicial (override del base 100). */
  startingSanity: number;
  /** Sumando al hand size base. */
  handSizeBonus: number;
  /** Sumando a las manos base por combate. */
  handsBonus: number;
  /** Sumando al oro por combate ganado. */
  goldPerCombatBonus: number;
  /** Reliquias ofrecidas en el draft de recompensa (2 normal, 1 desde Velo 13). */
  draftSize: number;
  /** Sumando al numero de items de tienda (-1 desde Velo 17). */
  shopItemsBonus: number;
  /** Umbral de Cordura a partir del cual aparecen alucinaciones. */
  hallucinationSanity: number;
  /** Hay una reliquia Maldita garantizada en el pool temprano (Velo 8). */
  malditaGuaranteed: boolean;
  /** Los jefes de fase ganan una fase extra (Velo 18; lo lee el boss runtime). */
  bossExtraPhase: boolean;
  /** Flags no mecanizables aun (rest restringido, elites frecuentes, sello del abismo...). */
  flags: string[];
}

export const BASE_VEIL_MODS: VeilMods = {
  objectiveFactor: 1,
  bossObjectiveFactor: 1,
  shopCostFactor: 1,
  rerollCostBonus: 0,
  startingCandles: 3,
  startingSanity: 100,
  handSizeBonus: 0,
  handsBonus: 0,
  goldPerCombatBonus: 0,
  draftSize: 2,
  shopItemsBonus: 0,
  hallucinationSanity: 40,
  malditaGuaranteed: false,
  bossExtraPhase: false,
  flags: [],
};

/** Delta que aporta CADA Velo (se aplica si veil >= n). Indice = numero de Velo. */
type VeilDelta = Partial<VeilMods> & { flag?: string };
const DELTAS: Record<number, VeilDelta> = {
  1: { objectiveFactor: 1.05 },
  2: { shopCostFactor: 1.15 },
  3: { rerollCostBonus: 1, flag: 'infiniteSanityDrain' },
  4: { flag: 'eliteFrequent' },
  5: { startingCandles: 2 },
  6: { bossObjectiveFactor: 1.1 },
  7: { goldPerCombatBonus: -1 },
  8: { malditaGuaranteed: true },
  9: { handSizeBonus: -1 },
  10: { objectiveFactor: 1.1, flag: 'checkpoint10' },
  11: { flag: 'restRestricted' },
  12: { startingSanity: 80 },
  13: { draftSize: 1 },
  14: { flag: 'sellosExpensive' },
  15: { handsBonus: -1 },
  16: { hallucinationSanity: 60 },
  17: { shopItemsBonus: -1 },
  18: { bossExtraPhase: true },
  19: { objectiveFactor: 1.15 },
  20: { flag: 'selloAbismo' },
};

const MAX_VEIL = 20;

/** Modificadores acumulados del Velo 0..veil. objectiveFactor/shopCostFactor se MULTIPLICAN. */
export function veilMods(veil: number): VeilMods {
  const v = Math.max(0, Math.min(MAX_VEIL, Math.floor(veil)));
  const mods: VeilMods = { ...BASE_VEIL_MODS, flags: [] };
  for (let n = 1; n <= v; n++) {
    const d = DELTAS[n];
    if (!d) continue;
    if (d.objectiveFactor) mods.objectiveFactor *= d.objectiveFactor;
    if (d.bossObjectiveFactor) mods.bossObjectiveFactor *= d.bossObjectiveFactor;
    if (d.shopCostFactor) mods.shopCostFactor *= d.shopCostFactor;
    if (d.rerollCostBonus) mods.rerollCostBonus += d.rerollCostBonus;
    if (d.startingCandles !== undefined) mods.startingCandles = d.startingCandles;
    if (d.startingSanity !== undefined) mods.startingSanity = d.startingSanity;
    if (d.handSizeBonus) mods.handSizeBonus += d.handSizeBonus;
    if (d.handsBonus) mods.handsBonus += d.handsBonus;
    if (d.goldPerCombatBonus) mods.goldPerCombatBonus += d.goldPerCombatBonus;
    if (d.draftSize !== undefined) mods.draftSize = d.draftSize;
    if (d.shopItemsBonus) mods.shopItemsBonus += d.shopItemsBonus;
    if (d.hallucinationSanity !== undefined) mods.hallucinationSanity = d.hallucinationSanity;
    if (d.malditaGuaranteed) mods.malditaGuaranteed = true;
    if (d.bossExtraPhase) mods.bossExtraPhase = true;
    if (d.flag) mods.flags.push(d.flag);
  }
  return mods;
}
