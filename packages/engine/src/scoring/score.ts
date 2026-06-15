// Pipeline de puntuacion (§7.3), orden ESTRICTO y determinista en punto fijo (§7.3.1).
//   puntuacion = floor(FICHAS_TOTAL × MULT_TOTAL)
// Orden: base -> (por carta: valor, mejoras ADITIVAS, sellos, onCardScored; con retriggers) ->
//        onHandPlayed (aditivos) + bono Cordura -> TODOS los ×mult (mejoras de carta y luego
//        reliquias, izquierda->derecha; incl. ×fichas) -> floor.
import type { Card } from '@umbral/shared';
import type { FeelEvent } from '../events';
import type { HandType } from '../types';
import { cardChipValue } from './cardvalue';
import type { Condition, CountRef, Effect, ScoreContext, ScoringRelic } from './effects';
import { finalScore, MULT_SCALE, multToFixed, xMultFixed } from './fixed';
import { baseForLevel } from './handbase';
import { detectHand } from './handtype';

/** Tope de disparos por carta (§7.6): evita bucles infinitos por sinergia rota. */
export const MAX_TRIGGERS = 20;

export interface ScoreInput {
  /** Cartas seleccionadas, EN ORDEN de juego (1..5). */
  played: readonly Card[];
  handLevels: Record<string, { level: number }>;
  /** Reliquias en orden (su posicion importa, §7.3). */
  relics?: readonly ScoringRelic[];
  /** Bono plano de mult por Cordura baja (§10.3); lo inyecta el Bloque 4/10. */
  corduraMultBonus?: number;
  /** Contexto global (economia, cordura, etc.). */
  context?: ScoreContext;
}

export interface ScoreResult {
  handType: HandType;
  scoringIds: string[];
  fichas: bigint;
  multScaled: bigint;
  score: number;
  coinsGained: number;
  sanityDelta: number;
  events: FeelEvent[];
}

interface Acc {
  fichas: bigint;
  mult: bigint;
}

interface HandInfo {
  playedCount: number;
  handType: HandType;
  allFourSuits: boolean;
  handHasFigure: boolean;
  figuresPlayed: number;
  acesPlayed: number;
}

const DEFAULT_CONTEXT: ScoreContext = {
  gold: 0,
  sanity: 100,
  isFirstHand: false,
  bossesDefeated: 0,
  cardsInHandNotPlayed: 0,
  xmultRelics: 0,
};

function isFigure(card: Card): boolean {
  return card.rank !== null && card.rank >= 11 && card.rank <= 13;
}

function evalCondition(
  cond: Condition,
  card: Card | undefined,
  acc: Acc,
  ctx: ScoreContext,
  info: HandInfo,
): boolean {
  switch (cond.type) {
    case 'always':
      return true;
    case 'suit':
      return card?.suit === cond.suit;
    case 'rank':
      return card?.rank === cond.rank;
    case 'isFace':
      return card !== undefined && isFigure(card);
    case 'isAce':
      return card?.rank === 14;
    case 'hasEnhancement':
      return card !== undefined && card.enhancement !== null;
    case 'multAtLeast':
      return acc.mult >= multToFixed(cond.value);
    case 'handType':
      return cond.any.includes(info.handType);
    case 'exactlyCards':
      return info.playedCount === cond.count;
    case 'atLeastCards':
      return info.playedCount >= cond.count;
    case 'goldAtLeast':
      return ctx.gold >= cond.value;
    case 'sanityBelow':
      return ctx.sanity < cond.value;
    case 'firstHand':
      return ctx.isFirstHand;
    case 'allFourSuits':
      return info.allFourSuits;
    case 'handHasFigure':
      return info.handHasFigure;
    case 'not':
      return !evalCondition(cond.cond, card, acc, ctx, info);
  }
}

function countOf(ref: CountRef, ctx: ScoreContext, info: HandInfo): number {
  switch (ref) {
    case 'playedCards':
      return info.playedCount;
    case 'cardsInHandNotPlayed':
      return ctx.cardsInHandNotPlayed;
    case 'figuresPlayed':
      return info.figuresPlayed;
    case 'acesPlayed':
      return info.acesPlayed;
    case 'gold':
      return ctx.gold;
    case 'xmultRelics':
      return ctx.xmultRelics;
    case 'bossesDefeated':
      return ctx.bossesDefeated;
  }
}

function applyEffect(
  acc: Acc,
  eff: Effect,
  card: Card | undefined,
  ctx: ScoreContext,
  info: HandInfo,
): void {
  if (eff.when && !evalCondition(eff.when, card, acc, ctx, info)) return;
  switch (eff.kind) {
    case 'addFichas': {
      let amount = eff.per ? eff.n * countOf(eff.per, ctx, info) : eff.n;
      if (eff.max !== undefined) amount = Math.min(amount, eff.max);
      acc.fichas += BigInt(Math.trunc(amount));
      break;
    }
    case 'addMult': {
      let amount = eff.per ? eff.n * countOf(eff.per, ctx, info) : eff.n;
      if (eff.max !== undefined) amount = Math.min(amount, eff.max);
      acc.mult += multToFixed(amount);
      break;
    }
    case 'xFichas':
      acc.fichas = (acc.fichas * multToFixed(eff.factor)) / MULT_SCALE;
      break;
    case 'xMult': {
      const factor = eff.perStep
        ? 1 + countOf(eff.perStep.per, ctx, info) * eff.perStep.step
        : eff.factor;
      acc.mult = xMultFixed(acc.mult, factor);
      break;
    }
  }
}

/** Mejoras ADITIVAS de carta (§7.7), paso 3b. Los ×mult de mejora (Untado) van al paso 5. */
function applyAdditiveEnhancement(acc: Acc, card: Card): void {
  switch (card.enhancement) {
    case 'grabado':
      acc.fichas += 30n;
      break;
    case 'marca':
      acc.mult += multToFixed(4);
      break;
    case 'cristal':
      acc.fichas += 50n;
      break;
    case 'piedra':
      acc.fichas += 50n;
      break;
    default:
      break;
  }
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { played, handLevels } = input;
  const relics = input.relics ?? [];
  const corduraMultBonus = input.corduraMultBonus ?? 0;
  const ctx = input.context ?? DEFAULT_CONTEXT;

  const detected = detectHand(played);
  const level = handLevels[detected.type]?.level ?? 1;
  const base = baseForLevel(detected.type, level);

  const info: HandInfo = {
    playedCount: played.length,
    handType: detected.type,
    allFourSuits: new Set(played.map((c) => c.suit).filter((s) => s !== null)).size === 4,
    handHasFigure: played.some(isFigure),
    figuresPlayed: played.filter(isFigure).length,
    acesPlayed: played.filter((c) => c.rank === 14).length,
  };

  const acc: Acc = { fichas: BigInt(base.fichas), mult: BigInt(base.mult) * MULT_SCALE };
  let coinsGained = 0;
  let sanityDelta = 0;
  const events: FeelEvent[] = [];
  const cardXMults: number[] = [];

  const isScoring = (card: Card): boolean =>
    detected.scoring.has(card.id) || card.enhancement === 'piedra';

  // Paso 3: por cada carta puntuada, izquierda->derecha, con retriggers (§7.6).
  played.forEach((card, idx) => {
    if (!isScoring(card)) return;

    let extra = card.seal === 'sangre' ? 1 : 0;
    for (const r of relics) {
      if (r.retrigger && evalCondition(r.retrigger.when, card, acc, ctx, info)) {
        extra += r.retrigger.times;
      }
    }
    const triggers = Math.min(1 + extra, MAX_TRIGGERS);

    const valueCard = card.enhancement === 'espejo' ? (played[idx - 1] ?? card) : card;
    const chip = cardChipValue(valueCard);

    for (let t = 0; t < triggers; t++) {
      acc.fichas += BigInt(chip); // 3a
      applyAdditiveEnhancement(acc, card); // 3b
      if (card.enhancement === 'untado') cardXMults.push(1.5);
      if (card.seal === 'ocre') coinsGained += 1; // 3c
      if (card.seal === 'violeta') {
        sanityDelta -= 2;
        acc.mult += multToFixed(6);
      }
      for (const r of relics) {
        for (const eff of r.onCardScored ?? []) applyEffect(acc, eff, card, ctx, info); // 3d
      }
      events.push({
        t: 'cardScored',
        cardId: card.id,
        chips: chip,
        mult: 0,
        ...(t > 0 ? { retrigger: true } : {}),
      });
    }
  });

  // Paso 4: bono de Cordura (§10.3) + onHandPlayed de reliquias (aditivos), en orden.
  if (corduraMultBonus > 0) acc.mult += multToFixed(corduraMultBonus);
  for (const r of relics) {
    for (const eff of r.onHandPlayed ?? []) applyEffect(acc, eff, undefined, ctx, info);
  }

  // Paso 5: TODOS los ×mult/×fichas, izquierda->derecha: mejoras de carta y luego reliquias.
  for (const factor of cardXMults) acc.mult = xMultFixed(acc.mult, factor);
  for (const r of relics) {
    for (const eff of r.xMult ?? []) applyEffect(acc, eff, undefined, ctx, info);
  }

  const score = Number(finalScore(acc.fichas, acc.mult));
  events.push({ t: 'scorePop', total: score });

  return {
    handType: detected.type,
    scoringIds: played.filter(isScoring).map((c) => c.id),
    fichas: acc.fichas,
    multScaled: acc.mult,
    score,
    coinsGained,
    sanityDelta,
    events,
  };
}
