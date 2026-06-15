'use client';
import { REGISTRY } from '@umbral/content';
import type { GameState } from '@umbral/engine';
import { useGame } from '../lib/store';

function optName(kind: string, id: string): string {
  if (kind === 'relic') return REGISTRY.relics[id]?.name ?? id;
  if (kind === 'arcano') return REGISTRY.consumables[id]?.name ?? id;
  return id;
}
function optFlavor(kind: string, id: string): string {
  if (kind === 'relic') return REGISTRY.relics[id]?.flavor ?? '';
  if (kind === 'arcano') return REGISTRY.consumables[id]?.flavor ?? '';
  return '';
}

export function RewardView({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const opts = (state.pendingReward?.options ?? []).filter((o) => o.kind !== 'skip');
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-2xl font-bold tracking-widest text-umbral-ocre">Recompensa</h2>
      <p className="text-sm text-umbral-ceniza">Elige un botin del abismo.</p>
      <div className="flex flex-wrap justify-center gap-4">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => dispatch({ type: 'PICK_REWARD', rewardId: o.id })}
            className="flex w-48 flex-col gap-2 rounded-xl border border-umbral-ocre/40 bg-umbral-pergamino p-4 text-left transition-all hover:-translate-y-1 hover:border-umbral-ocre-alto"
          >
            <span className="text-[10px] uppercase tracking-wider text-umbral-ceniza">
              {o.kind}
            </span>
            <span className="font-bold text-umbral-hueso">{optName(o.kind, o.id)}</span>
            <span className="text-xs italic text-umbral-ceniza">{optFlavor(o.kind, o.id)}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: 'SKIP_REWARD' })}
        className="rounded border border-umbral-ceniza/40 px-6 py-2 text-sm text-umbral-ceniza hover:text-umbral-hueso"
      >
        Saltar (+oro)
      </button>
    </section>
  );
}
