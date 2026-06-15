'use client';
import type { RunMode, VesselId } from '@umbral/shared';
import { useState } from 'react';
import { VESSEL_INFO } from '../lib/display';
import { useGame } from '../lib/store';

const VESSELS: VesselId[] = ['heraldo', 'vidente', 'usurero', 'coleccionista', 'bestia', 'profano'];
const MODES: { id: RunMode; label: string }[] = [
  { id: 'carrera', label: 'Carrera' },
  { id: 'infinito', label: 'Infinito' },
];

export function MainMenu() {
  const newRun = useGame((s) => s.newRun);
  const [vessel, setVessel] = useState<VesselId>('heraldo');
  const [veil, setVeil] = useState(0);
  const [mode, setMode] = useState<RunMode>('carrera');
  const [seed, setSeed] = useState('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-7xl font-bold tracking-[0.3em] text-umbral-ocre">UMBRAL</h1>
        <p className="mt-2 text-umbral-ceniza">
          Roguelike deckbuilder de puntuacion. El descenso comienza.
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <h2 className="mb-3 text-center text-sm uppercase tracking-widest text-umbral-ceniza">
          Elige tu Recipiente
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VESSELS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVessel(v)}
              className={[
                'rounded-xl border p-4 text-left transition-all',
                vessel === v
                  ? 'border-umbral-ocre-alto bg-umbral-pergamino ring-1 ring-umbral-ocre-alto/60'
                  : 'border-umbral-ceniza/30 bg-umbral-tinta hover:border-umbral-ocre/60',
              ].join(' ')}
            >
              <div className="font-bold text-umbral-hueso">{VESSEL_INFO[v].name}</div>
              <div className="text-xs text-umbral-ceniza">{VESSEL_INFO[v].tag}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-center gap-6">
        <label className="flex flex-col gap-1 text-sm text-umbral-ceniza">
          Velo (0-20)
          <input
            type="number"
            min={0}
            max={20}
            value={veil}
            onChange={(e) => setVeil(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
            className="w-24 rounded border border-umbral-ceniza/30 bg-umbral-tinta px-2 py-1 text-umbral-hueso"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm text-umbral-ceniza">
          Modo
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={[
                  'rounded px-3 py-1 text-sm',
                  mode === m.id
                    ? 'bg-umbral-ocre text-umbral-vacio'
                    : 'border border-umbral-ceniza/30 text-umbral-hueso',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm text-umbral-ceniza">
          Semilla (opcional)
          <input
            type="text"
            value={seed}
            placeholder="aleatoria"
            onChange={(e) => setSeed(e.target.value)}
            className="w-44 rounded border border-umbral-ceniza/30 bg-umbral-tinta px-2 py-1 text-umbral-hueso"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => newRun({ vessel, veil, mode, seed })}
        className="rounded-lg bg-umbral-ocre px-10 py-4 text-lg font-bold tracking-widest text-umbral-vacio shadow-xl transition-all hover:bg-umbral-ocre-alto"
      >
        DESCENDER
      </button>
    </main>
  );
}
