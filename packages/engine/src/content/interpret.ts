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
