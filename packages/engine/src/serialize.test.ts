import { describe, expect, it } from 'vitest';
import type { StartRunAction } from './actions';
import { reachableNodes, reduce, startRun } from './reduce';
import { deserialize, serialize } from './serialize';

const START: StartRunAction = { type: 'START_RUN', seed: 'serial', vessel: 'profano', ruleset: 1 };

describe('serializacion (INV-4)', () => {
  it('round-trip JSON de un run recien iniciado (en el mapa)', () => {
    const s = startRun(START);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('round-trip tras entrar en un nodo', () => {
    const s0 = startRun(START);
    if (!s0.map) throw new Error('sin mapa');
    const node = reachableNodes(s0.map)[0];
    if (!node) throw new Error('sin nodos accesibles');
    const s = reduce(s0, { type: 'CHOOSE_NODE', nodeId: node.id }).state;
    expect(deserialize(serialize(s))).toEqual(s);
  });
});
