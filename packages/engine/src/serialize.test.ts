import { describe, expect, it } from 'vitest';
import type { StartRunAction } from './actions';
import { reduce, startRun } from './reduce';
import { deserialize, serialize } from './serialize';

const START: StartRunAction = { type: 'START_RUN', seed: 'serial', vessel: 'profano', ruleset: 1 };

describe('serializacion (INV-4)', () => {
  it('round-trip JSON de un run recien iniciado', () => {
    const s = startRun(START);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('round-trip tras varias acciones', () => {
    let s = startRun(START);
    const first = s.combat?.hand[0];
    if (first) s = reduce(s, { type: 'SELECT_CARD', cardId: first }).state;
    s = reduce(s, { type: 'PLAY_HAND' }).state;
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });
});
