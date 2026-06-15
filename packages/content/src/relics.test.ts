import {
  applyScalersOnHandPlayed,
  combatModifiers,
  type RelicInstance,
  reduce,
  type ScoreContext,
  scoreHand,
  scoringModifiers,
  startRun,
  toScoringRelics,
  umbralEndGoldFactor,
} from '@umbral/engine';
import type { Card, Enhancement, Rank, Seal, Suit } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import { GENERAL_RELICS, REGISTRY } from './index';

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

let counter = 0;
function mk(suit: Suit | null, rank: Rank | null, opts?: { enh?: Enhancement; seal?: Seal }): Card {
  return {
    id: `c${counter++}`,
    suit,
    rank,
    enhancement: opts?.enh ?? null,
    seal: opts?.seal ?? null,
  };
}

function scoreWith(played: Card[], relicIds: string[], ctx: Partial<ScoreContext> = {}) {
  const instances: RelicInstance[] = relicIds.map((defId) => ({ defId }));
  return scoreHand({
    played,
    handLevels: {},
    relics: toScoringRelics(instances, REGISTRY),
    context: { ...CTX, ...ctx },
  });
}

describe('registro de contenido', () => {
  it('todas las reliquias y consumibles tienen id unico', () => {
    const ids = Object.keys(REGISTRY.relics);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(REGISTRY.consumables).length).toBeGreaterThanOrEqual(4);
  });
});

describe('reliquias via DSL (sin if-por-id en el engine)', () => {
  it('Catalizador: +4 mult', () => {
    const pair = [mk('CALIZ', 13), mk('LLAVE', 13)];
    const base = scoreWith(pair, []);
    const cat = scoreWith(pair, ['relic.catalizador']);
    // base pareja mult 2 -> 4 ; con catalizador 2+4=6
    expect(base.score).toBe(60); // 30 × 2
    expect(cat.score).toBe(180); // 30 × 6
  });

  it('Letania: +1 mult por carta jugada', () => {
    const r = scoreWith([mk('CALIZ', 13), mk('LLAVE', 13)], ['relic.letania']);
    expect(r.score).toBe(120); // mult 2 + 2 = 4 ; 30 × 4
  });

  it('Osario Mayor: por cada HUESO jugado', () => {
    const r = scoreWith([mk('HUESO', 13), mk('HUESO', 13)], ['relic.osario_mayor']);
    // pareja: fichas 10+10+10=30 +20+20(osario)=70 ; mult 2 +1+1=4 ; 70×4=280
    expect(r.fichas).toBe(70n);
    expect(r.score).toBe(280);
  });

  it('Monarca: ×2 con manos grandes (full)', () => {
    const full = [mk('CALIZ', 8), mk('LLAVE', 8), mk('HUESO', 8), mk('OJO', 2), mk('CALIZ', 2)];
    const base = scoreWith(full, []);
    const mon = scoreWith(full, ['relic.monarca']);
    expect(mon.score).toBe(base.score * 2);
  });

  it('Sistole: ×3 solo en la primera mano', () => {
    const cards = [mk('CALIZ', 13)];
    const first = scoreWith(cards, ['relic.sistole'], { isFirstHand: true });
    const later = scoreWith(cards, ['relic.sistole'], { isFirstHand: false });
    expect(first.score).toBe(later.score * 3);
  });

  it('Reverberacion: re-dispara figuras', () => {
    const noRelic = scoreWith([mk('CALIZ', 13), mk('LLAVE', 13)], []);
    const withRelic = scoreWith([mk('CALIZ', 13), mk('LLAVE', 13)], ['relic.reverberacion']);
    // cada K (figura) puntua 2 veces: fichas extra
    expect(withRelic.fichas).toBeGreaterThan(noRelic.fichas);
  });

  it('Eclipse: ×0.5 mult y ×2 fichas', () => {
    const cards = [mk('CALIZ', 13), mk('LLAVE', 13)];
    const r = scoreWith(cards, ['relic.eclipse']);
    // fichas 30 ×2 = 60 ; mult 2 ×0.5 = 1 ; 60 × 1 = 60
    expect(r.fichas).toBe(60n);
    expect(r.score).toBe(60);
  });

  it('Convergencia: ×mult escala con el nº de reliquias ×mult', () => {
    const cards = [mk('CALIZ', 13), mk('LLAVE', 13)];
    const r = scoreWith(cards, ['relic.convergencia'], { xmultRelics: 4 });
    // factor 1 + 4×0.25 = 2 ; mult 2 ×2 = 4 ; 30×4 = 120
    expect(r.score).toBe(120);
  });
});

describe('escaladoras (estado persistente)', () => {
  it('Sanguijuela crece con cada Pareja', () => {
    let inst: RelicInstance[] = [{ defId: 'relic.sanguijuela' }];
    inst = applyScalersOnHandPlayed(inst, REGISTRY, 'pareja', 2);
    inst = applyScalersOnHandPlayed(inst, REGISTRY, 'pareja', 2);
    expect(inst[0]?.state?.acc).toBe(2);
    const r = scoreHand({
      played: [mk('CALIZ', 13), mk('LLAVE', 13)],
      handLevels: {},
      relics: toScoringRelics(inst, REGISTRY),
      context: CTX,
    });
    // mult base 2 + 2 (acumulado) = 4 ; 30×4 = 120
    expect(r.score).toBe(120);
  });
});

describe('USE_CONSUMABLE (augurios/sellos)', () => {
  it('Augurio del Grabador aplica Grabado a una carta del mazo', () => {
    const s0 = startRun({ type: 'START_RUN', seed: 'aug', vessel: 'heraldo', ruleset: 1 });
    const target = s0.deck[0];
    if (!target) throw new Error('mazo vacio');
    const withConsumable = { ...s0, consumables: [{ defId: 'augurio.grabador' }] };
    const after = reduce(
      withConsumable,
      { type: 'USE_CONSUMABLE', consumableId: 'augurio.grabador', targets: [target.id] },
      REGISTRY,
    ).state;
    expect(after.deck.find((c) => c.id === target.id)?.enhancement).toBe('grabado');
    expect(after.consumables).toHaveLength(0);
  });

  it('Sello de la Pareja sube el nivel de Pareja', () => {
    const s0 = startRun({ type: 'START_RUN', seed: 'sel', vessel: 'heraldo', ruleset: 1 });
    const withConsumable = { ...s0, consumables: [{ defId: 'sello.pareja' }] };
    const after = reduce(
      withConsumable,
      { type: 'USE_CONSUMABLE', consumableId: 'sello.pareja', targets: [] },
      REGISTRY,
    ).state;
    expect(after.handLevels.pareja?.level).toBe(2);
  });
});

describe('integracion con reduce: modificador de combate', () => {
  it('Tercera Mano da +1 mano al combate', () => {
    const s0 = startRun({ type: 'START_RUN', seed: 'mod', vessel: 'heraldo', ruleset: 1 });
    const withRelic = { ...s0, relics: [{ defId: 'relic.tercera_mano' }] };
    const node = withRelic.map?.nodes
      .filter((n) => n.row === 0)
      .find((n) => n.type === 'combate' || n.type === 'elite');
    if (!node) return; // si la seed no tiene combate en fila 0, omitimos
    const after = reduce(withRelic, { type: 'CHOOSE_NODE', nodeId: node.id }, REGISTRY).state;
    expect(after.combat?.handsLeft).toBe(5); // 4 base + 1
  });
});

describe('catalogo completo (§11.1)', () => {
  it('hay 60 reliquias generales con id unico y campos validos', () => {
    expect(GENERAL_RELICS).toHaveLength(60);
    const ids = GENERAL_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(60);
    for (const r of GENERAL_RELICS) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.flavor.length).toBeGreaterThan(0);
      expect(r.cost).toBeGreaterThan(0);
      expect(r.tags.length).toBeGreaterThan(0);
    }
  });

  it('cada arquetipo (§13.4) tiene apoyos', () => {
    const tagCount = (t: string) => GENERAL_RELICS.filter((r) => r.tags.includes(t)).length;
    for (const tag of ['mult', 'fichas', 'xmult', 'retrigger', 'escaladora', 'palo', 'cordura']) {
      expect(tagCount(tag)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('verbos nuevos del DSL (Bloque 9)', () => {
  it('Igualador / Caleidoscopio / Eternidad / Sin Fondo via scoringModifiers', () => {
    const mod = (id: string) => scoringModifiers([{ defId: id }], REGISTRY);
    expect(mod('relic.igualador').flatCardChips).toBe(10);
    expect(mod('relic.caleidoscopio').wildSuit).toBe(true);
    expect(mod('relic.eternidad').extraRetrigger).toBe(1);
    expect(mod('relic.sin_fondo').noRetriggerCap).toBe(true);
    expect(mod('relic.simbiosis').spectralRelics).toBe(1);
  });

  it('Igualador: todas las cartas valen 10 fichas base', () => {
    // Pareja de Ases: normalmente 11+11; con Igualador 10+10.
    const r = scoreHand({
      played: [mk('CALIZ', 14), mk('LLAVE', 14)],
      handLevels: {},
      context: { ...CTX, flatCardChips: 10 },
    });
    expect(r.fichas).toBe(30n); // pareja base 10 + 10 + 10
  });

  it('El Coleccionista Supremo: +5 fichas por carta del mazo', () => {
    const r = scoreWith([mk('CALIZ', 13)], ['relic.el_coleccionista_supremo'], { deckCards: 52 });
    // carta_alta: 5 + 10(K) + 5×52 = 275
    expect(r.fichas).toBe(275n);
  });

  it('Corazon del Abismo: ×mult escala con la cordura perdida', () => {
    const r = scoreWith([mk('CALIZ', 13)], ['relic.corazon_del_abismo'], { corduraLost: 20 });
    // factor 1 + 20×0.05 = 2 ; carta_alta mult 1 ×2 = 2 ; fichas 15 ×2 = 30
    expect(r.score).toBe(30);
  });

  it('Reloj Detenido: ×3 en 1a mano, ×0.75 despues', () => {
    const first = scoreWith([mk('CALIZ', 13)], ['relic.reloj_detenido'], { isFirstHand: true });
    const later = scoreWith([mk('CALIZ', 13)], ['relic.reloj_detenido'], { isFirstHand: false });
    expect(first.score).toBe(45); // 15 ×3
    expect(later.score).toBe(11); // floor(15 × 0.75)
  });

  it('Eco Hueco: re-dispara solo la PRIMERA carta puntuada', () => {
    // Pareja: con Eco Hueco solo la 1a K se re-dispara (+10 fichas), no la 2a.
    const r = scoreWith([mk('CALIZ', 13), mk('LLAVE', 13)], ['relic.eco_hueco']);
    // base 10 + K(10)×2[eco] + K(10) = 10+20+10 = 40
    expect(r.fichas).toBe(40n);
  });

  it('Pacto de Plomo: modifica el combate (-1 mano)', () => {
    expect(combatModifiers([{ defId: 'relic.pacto_de_plomo' }], REGISTRY).hands).toBe(-1);
  });

  it('Diezmo: factor de oro de fin de Umbral 0.8', () => {
    expect(umbralEndGoldFactor([{ defId: 'relic.diezmo' }], REGISTRY)).toBeCloseTo(0.8);
  });
});
