'use client';
import type { GameState } from '@umbral/engine';
import { cardLabel } from '../lib/display';
import { useGame } from '../lib/store';

const UPGRADABLE = ['pareja', 'doble_pareja', 'trio', 'escalera', 'color', 'full'] as const;

export function RestView({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-2xl font-bold tracking-widest text-umbral-fosforo">Descanso</h2>
      <p className="text-sm text-umbral-ceniza">El fuego ofrece un respiro. Elige una accion.</p>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => dispatch({ type: 'REST_ACTION', kind: 'heal' })}
          className="w-44 rounded-xl border border-umbral-verdin/40 bg-umbral-pergamino p-5 text-umbral-hueso hover:border-umbral-fosforo"
        >
          <div className="text-3xl">☽</div>
          <div className="mt-2 font-bold">Curar</div>
          <div className="text-xs text-umbral-ceniza">+1 vela, +10 Cordura</div>
        </button>
        <div className="flex w-60 flex-col gap-1 rounded-xl border border-umbral-ocre/30 bg-umbral-pergamino p-4">
          <div className="text-center font-bold text-umbral-hueso">Mejorar una mano</div>
          <div className="flex flex-wrap justify-center gap-1">
            {UPGRADABLE.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => dispatch({ type: 'REST_ACTION', kind: 'upgrade', target: h })}
                className="rounded bg-umbral-ocre/20 px-2 py-1 text-xs text-umbral-ocre-alto hover:bg-umbral-ocre/40"
              >
                {h} (nv {state.handLevels[h]?.level ?? 1})
              </button>
            ))}
          </div>
        </div>
      </div>
      <details className="w-full max-w-md">
        <summary className="cursor-pointer text-sm text-umbral-ceniza">
          Depurar el mazo (quitar una carta)
        </summary>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {state.deck.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => dispatch({ type: 'REST_ACTION', kind: 'remove', target: card.id })}
              className="rounded border border-umbral-sangre/40 px-1.5 py-0.5 text-xs text-umbral-hueso hover:bg-umbral-sangre/30"
            >
              {cardLabel(card)}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
