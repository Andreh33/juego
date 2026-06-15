// Interprete del content registry: convierte reliquias del jugador en contribuciones de scoring
// y resuelve escaladoras y modificadores de combate. Cero `if`-por-id (§5.4, §24.8).
import type { ScoringRelic } from '../scoring/effects';
import type { HandType, RelicInstance } from '../types';
import type { ContentRegistry } from './dsl';

/** Contribuciones de puntuacion en orden de reliquia (resuelve escaladoras a efectos concretos). */
export function toScoringRelics(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): ScoringRelic[] {
  const out: ScoringRelic[] = [];
  for (const inst of relics) {
    const def = registry.relics[inst.defId];
    if (!def) continue;
    const onHandPlayed = [...(def.onHandPlayed ?? [])];
    const onCardScored = [...(def.onCardScored ?? [])];
    const xMult = [...(def.xMult ?? [])];
    if (def.scaler) {
      const acc = inst.state?.acc ?? 0;
      if (def.scaler.as === 'fichas') onHandPlayed.push({ kind: 'addFichas', n: acc });
      else if (def.scaler.as === 'mult') onHandPlayed.push({ kind: 'addMult', n: acc });
      else xMult.push({ kind: 'xMult', factor: 1 + acc });
    }
    out.push({
      defId: inst.defId,
      onCardScored,
      onHandPlayed,
      xMult,
      ...(def.retrigger ? { retrigger: def.retrigger } : {}),
    });
  }
  return out;
}

/** Nº de reliquias que aportan ×mult (para condicionales tipo Convergencia). */
export function countXMultRelics(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): number {
  let n = 0;
  for (const inst of relics) {
    const def = registry.relics[inst.defId];
    if (def && ((def.xMult?.length ?? 0) > 0 || def.scaler?.as === 'xmult')) n++;
  }
  return n;
}

/** Modificadores GLOBALES del scoring (Igualador, Sin Fondo, Eternidad, Caleidoscopio, Simbiosis). */
export function scoringModifiers(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): {
  flatCardChips: number | null;
  noRetriggerCap: boolean;
  extraRetrigger: number;
  wildSuit: boolean;
  spectralRelics: number;
} {
  let flatCardChips: number | null = null;
  let noRetriggerCap = false;
  let extraRetrigger = 0;
  let wildSuit = false;
  let spectralRelics = 0;
  for (const inst of relics) {
    const def = registry.relics[inst.defId];
    if (!def) continue;
    if (def.cardChipOverride !== undefined) flatCardChips = def.cardChipOverride;
    if (def.noRetriggerCap) noRetriggerCap = true;
    if (def.extraRetriggerPerSource) extraRetrigger += def.extraRetriggerPerSource;
    if (def.wildSuit) wildSuit = true;
    if (def.rarity === 'espectral') spectralRelics++;
  }
  return { flatCardChips, noRetriggerCap, extraRetrigger, wildSuit, spectralRelics };
}

/** Efecto de adquisicion de una reliquia (al cogerla del draft). */
export function acquireEffect(
  defId: string,
  registry: ContentRegistry,
): {
  maxCandlesDelta: number;
  sanityDelta: number;
  goldDelta: number;
} {
  const a = registry.relics[defId]?.onAcquire;
  return {
    maxCandlesDelta: a?.maxCandlesDelta ?? 0,
    sanityDelta: a?.sanityDelta ?? 0,
    goldDelta: a?.goldDelta ?? 0,
  };
}

/** Efectos agregados al iniciar combate. */
export function combatStartEffects(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): { sanityDelta: number; destroyRandomDeck: number } {
  let sanityDelta = 0;
  let destroyRandomDeck = 0;
  for (const inst of relics) {
    const e = registry.relics[inst.defId]?.onCombatStart;
    if (!e) continue;
    sanityDelta += e.sanityDelta ?? 0;
    destroyRandomDeck += e.destroyRandomDeck ?? 0;
  }
  return { sanityDelta, destroyRandomDeck };
}

/** Cartas a destruir al ganar un combate (Hambre). */
export function combatEndDestroy(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): number {
  let n = 0;
  for (const inst of relics) n += registry.relics[inst.defId]?.onCombatEnd?.destroyRandomDeck ?? 0;
  return n;
}

/** Factor de oro al terminar un Umbral (Diezmo). Producto de todos los factores. */
export function umbralEndGoldFactor(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): number {
  let factor = 1;
  for (const inst of relics) {
    const f = registry.relics[inst.defId]?.onUmbralEnd?.goldFactor;
    if (f !== undefined) factor *= f;
  }
  return factor;
}

/** Suma de modificadores de combate de todas las reliquias. */
export function combatModifiers(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): { hands: number; discards: number; handSize: number } {
  const mod = { hands: 0, discards: 0, handSize: 0 };
  for (const inst of relics) {
    const m = registry.relics[inst.defId]?.modifyCombat;
    if (!m) continue;
    mod.hands += m.hands ?? 0;
    mod.discards += m.discards ?? 0;
    mod.handSize += m.handSize ?? 0;
  }
  return mod;
}

function bump(inst: RelicInstance, inc: number): RelicInstance {
  if (inc === 0) return inst;
  return { ...inst, state: { ...(inst.state ?? {}), acc: (inst.state?.acc ?? 0) + inc } };
}

/** Actualiza escaladoras tras jugar una mano (triggers handPlayed / cardScored). */
export function applyScalersOnHandPlayed(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
  handType: HandType,
  scoringCardCount: number,
): RelicInstance[] {
  return relics.map((inst) => {
    const sc = registry.relics[inst.defId]?.scaler;
    if (!sc) return inst;
    if (
      sc.trigger.on === 'handPlayed' &&
      (!sc.trigger.handType || sc.trigger.handType === handType)
    ) {
      return bump(inst, sc.add);
    }
    if (sc.trigger.on === 'cardScored') return bump(inst, sc.add * scoringCardCount);
    return inst;
  });
}

/** Actualiza escaladoras al descartar (trigger discard). */
export function applyScalersOnDiscard(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): RelicInstance[] {
  return relics.map((inst) => {
    const sc = registry.relics[inst.defId]?.scaler;
    return sc?.trigger.on === 'discard' ? bump(inst, sc.add) : inst;
  });
}

/** Actualiza escaladoras al vencer un jefe (trigger bossDefeated). */
export function applyScalersOnBossDefeated(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
): RelicInstance[] {
  return relics.map((inst) => {
    const sc = registry.relics[inst.defId]?.scaler;
    return sc?.trigger.on === 'bossDefeated' ? bump(inst, sc.add) : inst;
  });
}

/** Actualiza escaladoras al mejorar cartas (trigger enhanced), `count` veces. */
export function applyScalersOnEnhanced(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
  count: number,
): RelicInstance[] {
  if (count <= 0) return [...relics];
  return relics.map((inst) => {
    const sc = registry.relics[inst.defId]?.scaler;
    return sc?.trigger.on === 'enhanced' ? bump(inst, sc.add * count) : inst;
  });
}

/** Actualiza escaladoras al destruir cartas (trigger cardDestroyed), `count` veces. */
export function applyScalersOnDestroyed(
  relics: readonly RelicInstance[],
  registry: ContentRegistry,
  count: number,
): RelicInstance[] {
  if (count <= 0) return [...relics];
  return relics.map((inst) => {
    const sc = registry.relics[inst.defId]?.scaler;
    return sc?.trigger.on === 'cardDestroyed' ? bump(inst, sc.add * count) : inst;
  });
}
