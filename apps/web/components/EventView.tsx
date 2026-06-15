'use client';
import { REGISTRY } from '@umbral/content';
import type { GameState } from '@umbral/engine';
import { useGame } from '../lib/store';

export function EventView({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const ev = state.pendingEvent ? REGISTRY.events[state.pendingEvent.eventId] : undefined;
  if (!ev) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-umbral-ceniza">El eco se desvanece.</p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'NEXT' })}
          className="rounded bg-umbral-ocre px-6 py-2 font-bold text-umbral-vacio hover:bg-umbral-ocre-alto"
        >
          Continuar
        </button>
      </section>
    );
  }
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-2xl font-bold tracking-widest text-umbral-violeta">{ev.name}</h2>
      <p className="max-w-lg text-center italic text-umbral-ceniza">{ev.lore}</p>
      <div className="flex flex-col gap-3">
        {ev.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => dispatch({ type: 'RESOLVE_EVENT', choiceId: opt.id })}
            className="w-80 rounded-lg border border-umbral-ceniza/30 bg-umbral-pergamino px-4 py-3 text-left text-umbral-hueso transition-all hover:border-umbral-ocre/70"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
