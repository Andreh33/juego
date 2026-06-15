'use client';
import type { GameState } from '@umbral/engine';
import { useGame } from '../lib/store';

export function EndView({ state }: { state: GameState }) {
  const abandon = useGame((s) => s.abandon);
  const won = state.result?.status === 'won';
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h2
        className={`text-5xl font-bold tracking-widest ${won ? 'text-umbral-ocre-alto' : 'text-umbral-sangre'}`}
      >
        {won ? 'EL FONDO' : 'LAS VELAS SE APAGAN'}
      </h2>
      <p className="max-w-md text-umbral-ceniza">
        {won
          ? 'Has tocado el fondo del Umbral y has vuelto. Por ahora.'
          : 'La oscuridad reclama otro descenso.'}
      </p>
      <div className="flex gap-8 text-center">
        <div>
          <div className="text-xs uppercase text-umbral-ceniza">Profundidad</div>
          <div className="text-2xl font-bold text-umbral-hueso">Umbral {state.umbral}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-umbral-ceniza">Puntuacion</div>
          <div className="text-2xl font-bold text-umbral-hueso">
            {state.runScore.toLocaleString()}
          </div>
        </div>
        {state.runStats ? (
          <div>
            <div className="text-xs uppercase text-umbral-ceniza">Mejor mano</div>
            <div className="text-2xl font-bold text-umbral-hueso">
              {state.runStats.bestHandScore.toLocaleString()}
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={abandon}
        className="rounded-lg bg-umbral-ocre px-8 py-3 font-bold text-umbral-vacio hover:bg-umbral-ocre-alto"
      >
        Volver al umbral
      </button>
    </section>
  );
}
