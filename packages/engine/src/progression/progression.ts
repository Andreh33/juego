// Motor de progresion: resume runs, acumula el perfil y concede desbloqueos/logros
// evaluando condiciones declarativas (§12.2/§12.3). Funciones puras.

import type { ContentRegistry, RelicDef } from '../content/dsl';
import type { GameState } from '../types';
import type { AchievementDef, ProfileStats, ProgCond, RunSummary, UnlockDef } from './types';

export function emptyProfile(): ProfileStats {
  return {
    runsPlayed: 0,
    runsWon: 0,
    goldEarned: 0,
    bestHandScore: 0,
    maxDepth: 0,
    vesselsWon: [],
    veilCleared: {},
    relicsSeen: [],
    bossesDefeated: [],
    eventsResolved: [],
    maxMalditasHeld: 0,
    unlocked: [],
    achievements: [],
  };
}

function isXMultRelic(def: RelicDef): boolean {
  if (def.xMult && def.xMult.length > 0) return true;
  if (def.scaler?.as === 'xmult') return true;
  const all = [...(def.onCardScored ?? []), ...(def.onHandPlayed ?? [])];
  return all.some((e) => e.kind === 'xMult' || e.kind === 'xFichas');
}

function isFlatFichasRelic(def: RelicDef): boolean {
  if (def.scaler?.as === 'fichas') return true;
  const all = [...(def.onCardScored ?? []), ...(def.onHandPlayed ?? [])];
  return all.some((e) => e.kind === 'addFichas');
}

/** Deriva el resumen de una run terminada a partir del estado final. */
export function summarizeRun(state: GameState, registry: ContentRegistry): RunSummary {
  const stats = state.runStats;
  const heldDefs = state.relics.map((r) => registry.relics[r.defId]).filter(Boolean) as RelicDef[];
  const malditasHeld = heldDefs.filter(
    (d) => d.rarity === 'maldita' || d.tags.includes('maldita'),
  ).length;
  const suits = new Set(state.deck.map((c) => c.suit));
  return {
    won: state.result?.status === 'won',
    vessel: state.vessel,
    veil: state.veil,
    depth: state.umbral,
    mode: state.mode,
    bestHandScore: stats?.bestHandScore ?? 0,
    minSanity: stats?.minSanity ?? state.sanity,
    touchedSanity0: stats?.touchedSanity0 ?? false,
    candlesLost: Math.max(0, state.maxCandles - state.candles),
    goldPeak: stats?.peakGold ?? state.gold,
    goldEarned: stats?.goldEarned ?? 0,
    maxDiscardsUsed: stats?.maxDiscardsUsed ?? 0,
    malditasHeld,
    relicCount: state.relics.length,
    relicsHeld: state.relics.map((r) => r.defId),
    enhancedCards: state.deck.filter((c) => c.enhancement !== null).length,
    noXmultRelics: !heldDefs.some(isXMultRelic),
    noFlatRelics: !heldDefs.some(isFlatFichasRelic),
    singleSuitDeck: state.deck.length > 0 && suits.size === 1,
    bossesDefeated: stats?.bossesDefeated ?? [],
    eventsResolved: stats?.eventsResolved ?? [],
  };
}

function uniq<T extends string>(...arrs: T[][]): T[] {
  return [...new Set(arrs.flat())];
}

/** Acumula una run en el perfil (no destructivo: solo sube contadores y une conjuntos). */
export function applyRunToProfile(profile: ProfileStats, run: RunSummary): ProfileStats {
  const vesselsWon = run.won ? uniq(profile.vesselsWon, [run.vessel]) : profile.vesselsWon;
  const prevVeil = profile.veilCleared[run.vessel] ?? -1;
  const veilCleared = { ...profile.veilCleared };
  // Superar un Velo solo cuenta si ganas la run en ese Velo.
  if (run.won && run.veil > prevVeil) veilCleared[run.vessel] = run.veil;
  return {
    runsPlayed: profile.runsPlayed + 1,
    runsWon: profile.runsWon + (run.won ? 1 : 0),
    goldEarned: profile.goldEarned + run.goldEarned,
    bestHandScore: Math.max(profile.bestHandScore, run.bestHandScore),
    maxDepth: Math.max(profile.maxDepth, run.depth),
    vesselsWon,
    veilCleared,
    relicsSeen: uniq(profile.relicsSeen, run.relicsHeld),
    bossesDefeated: uniq(profile.bossesDefeated, run.bossesDefeated),
    eventsResolved: uniq(profile.eventsResolved, run.eventsResolved),
    maxMalditasHeld: Math.max(profile.maxMalditasHeld, run.malditasHeld),
    unlocked: profile.unlocked,
    achievements: profile.achievements,
  };
}

/** Aplana perfil + run a un mapa de claves numericas (booleanos como 0/1). */
export function buildStatBag(profile: ProfileStats, run: RunSummary): Record<string, number> {
  const maxVeil = Object.values(profile.veilCleared).reduce<number>(
    (m, v) => Math.max(m, v ?? 0),
    0,
  );
  const veilAll6 = Object.values(profile.veilCleared).filter((v) => (v ?? -1) >= 0).length;
  const bag: Record<string, number> = {
    // ---- Lifetime ----
    'lifetime.runsPlayed': profile.runsPlayed,
    'lifetime.runsWon': profile.runsWon,
    'lifetime.goldEarned': profile.goldEarned,
    'lifetime.bestHandScore': profile.bestHandScore,
    'lifetime.maxDepth': profile.maxDepth,
    'lifetime.vesselsWon': profile.vesselsWon.length,
    'lifetime.relicsSeen': profile.relicsSeen.length,
    'lifetime.bossesDefeated': profile.bossesDefeated.length,
    'lifetime.eventsResolved': profile.eventsResolved.length,
    'lifetime.maxMalditasHeld': profile.maxMalditasHeld,
    'lifetime.maxVeil': maxVeil,
    'lifetime.veil20Count': Object.values(profile.veilCleared).filter((v) => (v ?? 0) >= 20).length,
    'lifetime.vesselsCleared': veilAll6,
    // ---- Run actual ----
    'run.won': run.won ? 1 : 0,
    'run.veil': run.veil,
    'run.depth': run.depth,
    'run.bestHandScore': run.bestHandScore,
    'run.minSanity': run.minSanity,
    'run.touchedSanity0': run.touchedSanity0 ? 1 : 0,
    'run.candlesLost': run.candlesLost,
    'run.goldPeak': run.goldPeak,
    'run.maxDiscardsUsed': run.maxDiscardsUsed,
    'run.malditasHeld': run.malditasHeld,
    'run.relicCount': run.relicCount,
    'run.enhancedCards': run.enhancedCards,
    'run.noXmultRelics': run.noXmultRelics ? 1 : 0,
    'run.noFlatRelics': run.noFlatRelics ? 1 : 0,
    'run.singleSuitDeck': run.singleSuitDeck ? 1 : 0,
    'run.bossesDefeated': run.bossesDefeated.length,
  };
  // Velo superado por cada Recipiente (clave dinamica).
  for (const [v, lvl] of Object.entries(profile.veilCleared)) {
    bag[`veilCleared.${v}`] = lvl ?? -1;
  }
  // Recipientes con los que ya se ha ganado (clave dinamica).
  for (const v of profile.vesselsWon) bag[`wonWith.${v}`] = 1;
  // El Recipiente de la run actual (para condiciones tematicas por clase).
  bag[`runVessel.${run.vessel}`] = 1;
  return bag;
}

/** Evalua una condicion declarativa contra el stat bag. */
export function condMet(cond: ProgCond, bag: Record<string, number>): boolean {
  if ('all' in cond) return cond.all.every((c) => condMet(c, bag));
  if ('any' in cond) return cond.any.some((c) => condMet(c, bag));
  const v = bag[cond.key] ?? 0;
  if ('gte' in cond) return v >= cond.gte;
  if ('lte' in cond) return v <= cond.lte;
  return v === cond.eq;
}

export interface GrantResult<T> {
  profile: ProfileStats;
  granted: T[];
}

/** Concede los desbloqueos cuya condicion se cumple y aun no estaban. */
export function grantUnlocks(
  defs: readonly UnlockDef[],
  profile: ProfileStats,
  run: RunSummary,
): GrantResult<UnlockDef> {
  const bag = buildStatBag(profile, run);
  const already = new Set(profile.unlocked);
  const granted = defs.filter((d) => !already.has(d.id) && condMet(d.cond, bag));
  if (granted.length === 0) return { profile, granted };
  return {
    profile: { ...profile, unlocked: [...profile.unlocked, ...granted.map((d) => d.id)] },
    granted,
  };
}

/** Concede los logros cuya condicion se cumple y aun no estaban. */
export function grantAchievements(
  defs: readonly AchievementDef[],
  profile: ProfileStats,
  run: RunSummary,
): GrantResult<AchievementDef> {
  const bag = buildStatBag(profile, run);
  const already = new Set(profile.achievements);
  const granted = defs.filter((d) => !already.has(d.id) && condMet(d.cond, bag));
  if (granted.length === 0) return { profile, granted };
  return {
    profile: { ...profile, achievements: [...profile.achievements, ...granted.map((d) => d.id)] },
    granted,
  };
}

/** Flujo completo al terminar una run: resume -> acumula -> concede unlocks y logros. */
export function processRunEnd(
  state: GameState,
  registry: ContentRegistry,
  profile: ProfileStats,
  unlockDefs: readonly UnlockDef[],
  achievementDefs: readonly AchievementDef[],
): {
  profile: ProfileStats;
  summary: RunSummary;
  newUnlocks: UnlockDef[];
  newAchievements: AchievementDef[];
} {
  const summary = summarizeRun(state, registry);
  const accumulated = applyRunToProfile(profile, summary);
  const u = grantUnlocks(unlockDefs, accumulated, summary);
  const a = grantAchievements(achievementDefs, u.profile, summary);
  return {
    profile: a.profile,
    summary,
    newUnlocks: u.granted,
    newAchievements: a.granted,
  };
}
