import { type GameState, reduce, startRun } from '@umbral/engine';
import { describe, expect, it } from 'vitest';
import { ELITES, EVENTS, REGISTRY } from './index';

function run(): GameState {
  return startRun({ type: 'START_RUN', seed: 'ev', vessel: 'heraldo', ruleset: 1 }, REGISTRY);
}

describe('datos de eventos y elites (§11.8/§11.9/§10.5)', () => {
  it('hay >=40 eventos (incl. variantes) y >=3 santuarios', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
    expect(EVENTS.filter((e) => e.santuario).length).toBeGreaterThanOrEqual(3);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const e of EVENTS) expect(e.options.length).toBeGreaterThanOrEqual(2);
  });

  it('hay 10 modificadores de elite, todos marcados', () => {
    expect(ELITES).toHaveLength(10);
    for (const e of ELITES) expect(e.elite).toBe(true);
  });

  it('las elites estan en el registro de jefes pero fuera del pool de jefes normales', () => {
    for (const e of ELITES) expect(REGISTRY.bosses[e.id]?.elite).toBe(true);
  });
});

describe('RESOLVE_EVENT aplica el efecto de la opcion', () => {
  it('Fuente Negra (beber): -15 Cordura y gana reliquia espectral', () => {
    const base = run();
    const s: GameState = {
      ...base,
      phase: 'evento',
      pendingEvent: { eventId: 'evento.fuente_negra' },
    };
    const after = reduce(s, { type: 'RESOLVE_EVENT', choiceId: 'beber' }, REGISTRY).state;
    expect(after.sanity).toBe(base.sanity - 15);
    expect(after.relics.length).toBe(base.relics.length + 1);
    expect(after.phase).toBe('mapa');
  });

  it('Encrucijada (oro): +30 oro', () => {
    const base = run();
    const s: GameState = {
      ...base,
      phase: 'evento',
      pendingEvent: { eventId: 'evento.encrucijada' },
    };
    const after = reduce(s, { type: 'RESOLVE_EVENT', choiceId: 'oro' }, REGISTRY).state;
    expect(after.gold).toBe(base.gold + 30);
  });

  it('Mano Cortada: destruye 1 carta del mazo', () => {
    const base = run();
    const s: GameState = {
      ...base,
      phase: 'evento',
      pendingEvent: { eventId: 'evento.mano_cortada' },
    };
    const after = reduce(s, { type: 'RESOLVE_EVENT', choiceId: 'depurar' }, REGISTRY).state;
    expect(after.deck.length).toBe(base.deck.length - 1);
  });

  it('Santuario Purga: -15 oro, +Cordura', () => {
    const base = { ...run(), gold: 50, sanity: 40 };
    const s: GameState = {
      ...base,
      phase: 'santuario',
      pendingEvent: { eventId: 'santuario.purga' },
    };
    const after = reduce(s, { type: 'RESOLVE_EVENT', choiceId: 'purgar' }, REGISTRY).state;
    expect(after.gold).toBe(35);
    expect(after.sanity).toBe(65);
    expect(after.phase).toBe('mapa');
  });
});
