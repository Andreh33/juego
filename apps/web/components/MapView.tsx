'use client';
import { type GameState, reachableNodes } from '@umbral/engine';
import { NODE_ICON, NODE_LABEL } from '../lib/display';
import { useGame } from '../lib/store';

export function MapView({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  if (!state.map) return null;
  const nodes = reachableNodes(state.map);
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-2xl font-bold tracking-widest text-umbral-ocre">
        Umbral {state.umbral} · El descenso
      </h2>
      <p className="text-sm text-umbral-ceniza">Elige tu camino</p>
      <div className="flex flex-wrap items-stretch justify-center gap-4">
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => dispatch({ type: 'CHOOSE_NODE', nodeId: n.id })}
            className="flex w-40 flex-col items-center gap-2 rounded-xl border border-umbral-ceniza/30 bg-gradient-to-b from-umbral-pergamino to-umbral-tinta p-5 transition-all hover:-translate-y-1 hover:border-umbral-ocre/70"
          >
            <span className="text-4xl">{NODE_ICON[n.type] ?? '◆'}</span>
            <span className="font-bold text-umbral-hueso">{NODE_LABEL[n.type] ?? n.type}</span>
            {n.objective ? (
              <span className="text-xs text-umbral-ceniza">
                Objetivo ~{n.objective.toLocaleString()}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
