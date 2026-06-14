// Pipeline de puntuacion (§7.3), orden ESTRICTO y determinista en punto fijo (§7.3.1).
//   puntuacion = floor(FICHAS_TOTAL × MULT_TOTAL)
// Orden: base -> (por carta: valor, mejora, sellos, onCardScored; con retriggers) ->
//        onHandPlayed (aditivos) + bono Cordura -> ×mult de reliquias -> floor.
import type { Card } from '@umbral/shared';
import type { FeelEvent } from '../events';
import type { HandType } from '../types';
import { cardChipValue } from './cardvalue';
import type { Condition, Effect, RelicScoreDef } from './effects';
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
  relics?: readonly RelicScoreDef[];
  /** Bono plano de mult por Cordura baja (§10.3); lo inyecta el Bloque 4/10. */
  corduraMultBonus?: number;
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

function evalCondition(cond: Condition, card: Card | undefined, acc: Acc): boolean {
  switch (cond.type) {
    case 'always':
      return true;
    case 'suit':
      return card?.suit === cond.suit;
    case 'rank':
      return card?.rank === cond.rank;
    case 'isFace':
      return card?.rank != null && card.rank >= 11 && card.rank <= 13;
    case 'isAce':
      return card?.rank === 14;
    case 'hasEnhancement':
      return card != null && card.enhancement !== null;
    case 'multAtLeast':
      return acc.mult >= multToFixed(cond.value);
  }
}

function applyEffect(acc: Acc, eff: Effect, card: Card | undefined): void {
  if (eff.when && !evalCondition(eff.when, card, acc)) return;
  switch (eff.kind) {
    case 'addFichas':
      acc.fichas += BigInt(Math.trunc(eff.n));
      break;
    case 'addMult':
      acc.mult += multToFixed(eff.n);
      break;
    case 'xMult':
      acc.mult = xMultFixed(acc.mult, eff.factor);
      break;
  }
}

/** Mejora de carta (§7.7), aplicada en el paso 3b. Untado ×mult se aplica aqui (§7.3 paso 3b). */
function applyEnhancement(acc: Acc, card: Card): void {
  switch (card.enhancement) {
    case 'grabado':
      acc.fichas += 30n;
      break;
    case 'marca':
      acc.mult += multToFixed(4);
      break;
    case 'untado':
      acc.mult = xMultFixed(acc.mult, 1.5);
      break;
    case 'cristal':
      acc.fichas += 50n;
      break;
    case 'piedra':
      acc.fichas += 50n;
      break;
    // 'dorado' (monedas al fin de ronda) y 'espejo' (copia rango, en 3a) no suman fichas aqui.
    default:
      break;
  }
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { played, handLevels } = input;
  const relics = input.relics ?? [];
  const corduraMultBonus = input.corduraMultBonus ?? 0;

  const detected = detectHand(played);
  const level = handLevels[detected.type]?.level ?? 1;
  const base = baseForLevel(detected.type, level);

  const acc: Acc = { fichas: BigInt(base.fichas), mult: BigInt(base.mult) * MULT_SCALE };
  let coinsGained = 0;
  let sanityDelta = 0;
  const events: FeelEvent[] = [];

  // Una carta puntua si forma parte del tipo, o si es Piedra (siempre puntua, §7.7).
  const isScoring = (card: Card): boolean =>
    detected.scoring.has(card.id) || card.enhancement === 'piedra';

  // Paso 3: por cada carta puntuada, izquierda->derecha en la zona jugada, con retriggers (§7.6).
  played.forEach((card, idx) => {
    if (!isScoring(card)) return;

    let extra = card.seal === 'sangre' ? 1 : 0;
    for (const r of relics) {
      if (r.retrigger && evalCondition(r.retrigger.when, card, acc)) extra += r.retrigger.times;
    }
    const triggers = Math.min(1 + extra, MAX_TRIGGERS);

    // Espejo copia el rango de la carta a su izquierda (§7.7).
    const valueCard = card.enhancement === 'espejo' ? (played[idx - 1] ?? card) : card;
    const chip = cardChipValue(valueCard);

    for (let t = 0; t < triggers; t++) {
      acc.fichas += BigInt(chip); // 3a
      applyEnhancement(acc, card); // 3b
      if (card.seal === 'ocre') coinsGained += 1; // 3c
      if (card.seal === 'violeta') {
        sanityDelta -= 2;
        acc.mult += multToFixed(6);
      }
      for (const r of relics) for (const eff of r.onCardScored ?? []) applyEffect(acc, eff, card); // 3d
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
  for (const r of relics) for (const eff of r.onHandPlayed ?? []) applyEffect(acc, eff, undefined);

  // Paso 5: ×mult de reliquias, en orden de reliquia (el orden importa con condicionales).
  for (const r of relics) for (const eff of r.xMult ?? []) applyEffect(acc, eff, undefined);

  // Paso 7: floor.
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
