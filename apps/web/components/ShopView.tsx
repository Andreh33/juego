'use client';
import { REGISTRY } from '@umbral/content';
import type { GameState } from '@umbral/engine';
import { useGame } from '../lib/store';

function itemName(kind: string, payloadId: string): string {
  if (kind === 'relic') return REGISTRY.relics[payloadId]?.name ?? payloadId;
  if (kind === 'arcano') return REGISTRY.consumables[payloadId]?.name ?? payloadId;
  return REGISTRY.vouchers[payloadId]?.name ?? payloadId;
}
function itemFlavor(kind: string, payloadId: string): string {
  if (kind === 'relic') return REGISTRY.relics[payloadId]?.flavor ?? '';
  if (kind === 'arcano') return REGISTRY.consumables[payloadId]?.flavor ?? '';
  return REGISTRY.vouchers[payloadId]?.flavor ?? '';
}

export function ShopView({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const shop = state.shop;
  if (!shop) return null;
  return (
    <section className="flex flex-1 flex-col items-center gap-6 p-6">
      <h2 className="text-2xl font-bold tracking-widest text-umbral-ocre">El Mercader</h2>
      <p className="text-sm text-umbral-ocre-alto">Oro: {state.gold}</p>
      <div className="flex flex-wrap justify-center gap-4">
        {shop.items.length === 0 ? (
          <p className="text-umbral-ceniza">No queda nada que comprar.</p>
        ) : (
          shop.items.map((item) => (
            <div
              key={item.id}
              className="flex w-48 flex-col gap-2 rounded-xl border border-umbral-ceniza/30 bg-umbral-pergamino p-4"
            >
              <span className="text-[10px] uppercase tracking-wider text-umbral-ceniza">
                {item.kind}
              </span>
              <span className="font-bold text-umbral-hueso">
                {itemName(item.kind, item.payloadId)}
              </span>
              <span className="flex-1 text-xs italic text-umbral-ceniza">
                {itemFlavor(item.kind, item.payloadId)}
              </span>
              <button
                type="button"
                disabled={state.gold < item.cost}
                onClick={() => dispatch({ type: 'BUY', shopItemId: item.id })}
                className="rounded bg-umbral-ocre px-3 py-1 text-sm font-bold text-umbral-vacio hover:bg-umbral-ocre-alto disabled:opacity-40"
              >
                Comprar · {item.cost}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={state.gold < shop.rerollCost}
          onClick={() => dispatch({ type: 'REROLL_SHOP' })}
          className="rounded border border-umbral-verdin/50 px-4 py-2 text-sm text-umbral-fosforo hover:bg-umbral-verdin/20 disabled:opacity-40"
        >
          Renovar · {shop.rerollCost}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'NEXT' })}
          className="rounded bg-umbral-ocre px-6 py-2 font-bold text-umbral-vacio hover:bg-umbral-ocre-alto"
        >
          Salir
        </button>
      </div>
    </section>
  );
}
