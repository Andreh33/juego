import { reachableNodes, reduce, type ScoreContext, scoreHand, startRun } from '@umbral/engine';
import type { Card, Rank, Suit } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import { BOSSES, REGISTRY } from './index';

const CTX: ScoreContext = {
  gold: 0,
  sanity: 100,
  isFirstHand: false,
  bossesDefeated: 0,
  cardsInHandNotPlayed: 0,
  xmultRelics: 0,
  deckCards: 52,
  corduraLost: 0,
  spectralRelics: 0,
  enhancedCardsInHand: 0,
  flatCardChips: null,
  noRetriggerCap: false,
  extraRetrigger: 0,
  wildSuit: false,
  silencedSuits: [],
  figuresHalf: false,
  relicXMultPenalty: 0,
};

let n = 0;
function mk(suit: Suit, rank: Rank): Card {
  return { id: `c${n++}`, suit, rank, enhancement: null, seal: null };
}

describe('datos de jefes (§11.7)', () => {
  it('hay 24 jefes (8 por Sima) + 2 secretos, ids unicos', () => {
    expect(BOSSES).toHaveLength(26);
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(26);
    const normal = BOSSES.filter((b) => !b.secret);
    expect(normal).toHaveLength(24);
    for (const sima of [1, 2, 3] as const) {
      expect(normal.filter((b) => b.sima === sima)).toHaveLength(8);
    }
    expect(BOSSES.filter((b) => b.secret)).toHaveLength(2);
    for (const b of BOSSES) {
      expect(b.tell.length).toBeGreaterThan(0);
      expect(b.orla.length).toBeGreaterThan(0);
    }
  });
});

describe('modificadores de jefe en el scoring', () => {
  it('palo silenciado da 0 fichas', () => {
    const pair = [mk('CALIZ', 13), mk('CALIZ', 13)];
    const normal = scoreHand({ played: pair, handLevels: {}, context: CTX });
    const silenced = scoreHand({
      played: pair,
      handLevels: {},
      context: { ...CTX, silencedSuits: ['CALIZ'] },
    });
    expect(normal.fichas).toBe(30n); // 10 + 10 + 10
    expect(silenced.fichas).toBe(10n); // solo la base; las CALIZ no dan fichas
  });

  it('figuras a mitad', () => {
    const pair = [mk('CALIZ', 13), mk('LLAVE', 13)];
    const half = scoreHand({
      played: pair,
      handLevels: {},
      context: { ...CTX, figuresHalf: true },
    });
    expect(half.fichas).toBe(20n); // 10 + 5 + 5
  });

  it('penalizacion de ×mult de reliquia', () => {
    const relic = [{ defId: 'x', xMult: [{ kind: 'xMult' as const, factor: 2 }] }];
    const pair = [mk('CALIZ', 13), mk('LLAVE', 13)];
    const full = scoreHand({ played: pair, handLevels: {}, relics: relic, context: CTX });
    const pen = scoreHand({
      played: pair,
      handLevels: {},
      relics: relic,
      context: { ...CTX, relicXMultPenalty: 0.5 },
    });
    // mult 2 (pareja) ×2 = 4 (full) vs ×1.5 = 3 (penalizado)
    expect(full.score).toBe(120);
    expect(pen.score).toBe(90);
  });
});

describe('seleccion de jefe en el run', () => {
  it('al entrar al jefe se asigna un jefe real del pool y se registra', () => {
    let s = startRun(
      { type: 'START_RUN', seed: 'boss-run', vessel: 'heraldo', ruleset: 1 },
      REGISTRY,
    );
    let enteredBoss = false;
    let steps = 0;
    while (s.phase !== 'fin' && steps < 20000 && !enteredBoss) {
      steps++;
      switch (s.phase) {
        case 'mapa': {
          const opts = reachableNodes(s.map ?? { umbral: 0, nodes: [], currentNodeId: null });
          const pick = opts.find((o) => o.type !== 'combate' && o.type !== 'elite') ?? opts[0];
          if (!pick) {
            s = { ...s, phase: 'fin' };
            break;
          }
          s = reduce(s, { type: 'CHOOSE_NODE', nodeId: pick.id }, REGISTRY).state;
          break;
        }
        case 'combate': {
          const c = s.combat;
          if (c?.bossId && REGISTRY.bosses[c.bossId]) {
            enteredBoss = true;
            break;
          }
          const sel = c ? c.hand.slice(0, 5) : [];
          let st = s;
          for (const id of sel)
            st = reduce(st, { type: 'SELECT_CARD', cardId: id }, REGISTRY).state;
          s = reduce(st, { type: 'PLAY_HAND' }, REGISTRY).state;
          break;
        }
        case 'recompensa':
          s = reduce(s, { type: 'SKIP_REWARD' }, REGISTRY).state;
          break;
        case 'descanso':
          s = reduce(s, { type: 'REST_ACTION', kind: 'heal' }, REGISTRY).state;
          break;
        default:
          s = reduce(s, { type: 'NEXT' }, REGISTRY).state;
      }
    }
    expect(enteredBoss).toBe(true);
    const bossId = s.combat?.bossId;
    expect(bossId && REGISTRY.bosses[bossId]).toBeDefined();
    expect(s.usedBosses.length).toBeGreaterThan(0);
  });
});
