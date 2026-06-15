'use client';
import type { GameState } from '@umbral/engine';
import { consumableName, relicFlavor, relicName, VESSEL_INFO } from '../lib/display';
import { useGame } from '../lib/store';

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center px-2">
      <span className="text-[10px] uppercase tracking-wider text-umbral-ceniza">{label}</span>
      <span className={`text-lg font-bold ${tone ?? 'text-umbral-hueso'}`}>{value}</span>
    </div>
  );
}

export function Hud({ state }: { state: GameState }) {
  const abandon = useGame((s) => s.abandon);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const candles = '🕯'.repeat(Math.max(0, state.candles));
  return (
    <header className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-umbral-ceniza/20 bg-umbral-tinta/80 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-widest text-umbral-ocre">UMBRAL</span>
          <span className="text-[10px] text-umbral-ceniza">{VESSEL_INFO[state.vessel].name}</span>
        </div>
        <Stat label="Umbral" value={`${state.umbral}`} tone="text-umbral-ocre-alto" />
        <Stat label="Sima" value={`${state.sima}`} />
        <Stat label="Velo" value={`${state.veil}`} />
      </div>
      <div className="flex items-center gap-1">
        <Stat label="Velas" value={candles || '—'} tone="text-umbral-ocre" />
        <Stat
          label="Cordura"
          value={`${state.sanity}`}
          tone={state.sanity < 40 ? 'text-umbral-violeta' : 'text-umbral-fosforo'}
        />
        <Stat label="Oro" value={`${state.gold}`} tone="text-umbral-ocre-alto" />
      </div>
      <div className="flex max-w-[40%] flex-wrap items-center justify-end gap-1">
        {state.relics.map((r, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: defId puede repetirse; orden estable
            key={`${r.defId}-${i}`}
            title={`${relicName(r.defId)} — ${relicFlavor(r.defId)}`}
            className="rounded border border-umbral-ocre/40 bg-umbral-pergamino px-1.5 py-0.5 text-[10px] text-umbral-hueso"
          >
            {relicName(r.defId)}
          </span>
        ))}
        {state.consumables.map((c, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: defId puede repetirse; orden estable
            key={`${c.defId}-${i}`}
            title={consumableName(c.defId)}
            className="rounded border border-umbral-verdin/40 bg-umbral-pergamino px-1.5 py-0.5 text-[10px] text-umbral-fosforo"
          >
            {consumableName(c.defId)}
          </span>
        ))}
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? 'Activar sonido' : 'Silenciar'}
          className="ml-2 rounded border border-umbral-ceniza/40 px-2 py-0.5 text-[10px] text-umbral-ceniza hover:text-umbral-hueso"
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          onClick={abandon}
          className="rounded border border-umbral-sangre/50 px-2 py-0.5 text-[10px] text-umbral-ceniza hover:text-umbral-hueso"
        >
          Abandonar
        </button>
      </div>
    </header>
  );
}
