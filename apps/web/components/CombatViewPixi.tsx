'use client';
// Combate con render PixiJS (B6): la mano la dibuja la isla Pixi; el objetivo, el tipo de mano,
// los consumibles y los botones siguen en React/Zustand. La selección viaja Pixi -> store -> Pixi.
import { REGISTRY } from '@umbral/content';
import { detectHand, type GameState } from '@umbral/engine';
import type { Card } from '@umbral/shared';
import dynamic from 'next/dynamic';
import { consumableName } from '../lib/display';
import { useGame } from '../lib/store';

const PixiCombat = dynamic(() => import('./PixiCombat').then((m) => m.PixiCombat), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-umbral-ceniza">
      Invocando la mesa…
    </div>
  ),
});

const HAND_NAME: Record<string, string> = {
  carta_alta: 'Carta Alta',
  pareja: 'Pareja',
  doble_pareja: 'Doble Pareja',
  trio: 'Trio',
  escalera: 'Escalera',
  color: 'Color',
  full: 'Full',
  poker: 'Poker',
  escalera_color: 'Escalera de Color',
  escalera_real: 'Escalera Real',
  quinteto: 'Quinteto',
  quinteto_color: 'Quinteto de Color',
  hilera_negra: 'Hilera Negra',
};

export function CombatViewPixi({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const c = state.combat;
  if (!c) return null;
  const byId = new Map(state.deck.map((card) => [card.id, card]));
  const hand = c.hand.map((id) => byId.get(id)).filter((x): x is Card => x !== undefined);
  const selectedCards = c.selected
    .map((id) => byId.get(id))
    .filter((x): x is Card => x !== undefined);
  const detected = selectedCards.length > 0 ? detectHand(selectedCards) : null;
  const pct = c.objective > 0 ? Math.min(100, (c.accumulated / c.objective) * 100) : 0;
  const boss = c.bossId ? REGISTRY.bosses[c.bossId] : undefined;

  const onToggle = (id: string) =>
    dispatch(
      c.selected.includes(id)
        ? { type: 'DESELECT_CARD', cardId: id }
        : { type: 'SELECT_CARD', cardId: id },
    );

  const activateConsumable = (defId: string) => {
    const def = REGISTRY.consumables[defId];
    const needsTargets =
      def?.applyEnhancement !== undefined ||
      def?.applySeal !== undefined ||
      def?.rankDelta !== undefined ||
      def?.destroyTargets ||
      def?.duplicateTargets ||
      def?.changeSuitToFirst ||
      def?.matchRankToFirst;
    dispatch({
      type: 'USE_CONSUMABLE',
      consumableId: defId,
      targets: needsTargets ? c.selected : [],
    });
  };

  return (
    <section className="flex flex-1 flex-col items-center justify-between gap-3 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-umbral-ceniza">Objetivo {boss ? `· ${boss.name}` : ''}</span>
          <span className="font-mono text-umbral-hueso">
            {Math.round(c.accumulated).toLocaleString()} / {c.objective.toLocaleString()}
          </span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full border border-umbral-ceniza/30 bg-umbral-vacio">
          <div
            className="h-full bg-gradient-to-r from-umbral-ocre to-umbral-ocre-alto transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {boss?.tell ? (
          <p className="mt-2 text-center text-xs italic text-umbral-sangre">{boss.tell}</p>
        ) : null}
      </div>

      <div className="flex h-7 items-center text-sm text-umbral-ocre-alto">
        {detected ? (
          <span>
            {HAND_NAME[detected.type] ?? detected.type} ·{' '}
            <span className="text-umbral-ceniza">
              nivel {state.handLevels[detected.type]?.level ?? 1}
            </span>
          </span>
        ) : (
          <span className="text-umbral-ceniza">Toca las cartas para seleccionar (hasta 5)</span>
        )}
      </div>

      <PixiCombat hand={hand} selectedIds={c.selected} onToggle={onToggle} />

      {state.consumables.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {state.consumables.map((cons, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: defId puede repetirse; lista estatica
              key={`${cons.defId}-${i}`}
              type="button"
              onClick={() => activateConsumable(cons.defId)}
              className="rounded border border-umbral-verdin/50 bg-umbral-pergamino px-2 py-1 text-xs text-umbral-fosforo hover:border-umbral-fosforo"
            >
              Usar {consumableName(cons.defId)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-xs text-umbral-ceniza">Manos</div>
          <div className="text-xl font-bold text-umbral-hueso">{c.handsLeft}</div>
        </div>
        <button
          type="button"
          disabled={c.selected.length === 0}
          onClick={() => dispatch({ type: 'PLAY_HAND' })}
          className="rounded-lg bg-umbral-ocre px-6 py-3 font-bold text-umbral-vacio shadow-lg transition-all hover:bg-umbral-ocre-alto disabled:cursor-not-allowed disabled:opacity-40"
        >
          Jugar mano
        </button>
        <button
          type="button"
          disabled={c.selected.length === 0 || c.discardsLeft <= 0}
          onClick={() => dispatch({ type: 'DISCARD' })}
          className="rounded-lg border border-umbral-sangre/60 px-6 py-3 font-bold text-umbral-hueso transition-all hover:bg-umbral-sangre/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Descartar
        </button>
        <div className="text-center">
          <div className="text-xs text-umbral-ceniza">Descartes</div>
          <div className="text-xl font-bold text-umbral-hueso">{c.discardsLeft}</div>
        </div>
      </div>
    </section>
  );
}
