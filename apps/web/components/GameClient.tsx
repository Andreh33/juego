'use client';
import { useGame } from '../lib/store';
import { CombatView } from './CombatView';
import { EndView } from './EndView';
import { EventView } from './EventView';
import { Hud } from './Hud';
import { MainMenu } from './MainMenu';
import { MapView } from './MapView';
import { RestView } from './RestView';
import { RewardView } from './RewardView';
import { ShopView } from './ShopView';

export function GameClient() {
  const state = useGame((s) => s.state);
  const lastError = useGame((s) => s.lastError);

  if (!state) return <MainMenu />;

  return (
    <div className="flex min-h-screen flex-col">
      <Hud state={state} />
      {lastError ? (
        <div className="bg-umbral-sangre/20 py-1 text-center text-xs text-umbral-sangre">
          {lastError}
        </div>
      ) : null}
      {state.phase === 'mapa' && <MapView state={state} />}
      {(state.phase === 'combate' || state.phase === 'jefe') && <CombatView state={state} />}
      {state.phase === 'tienda' && <ShopView state={state} />}
      {(state.phase === 'evento' || state.phase === 'santuario') && <EventView state={state} />}
      {state.phase === 'descanso' && <RestView state={state} />}
      {state.phase === 'recompensa' && <RewardView state={state} />}
      {state.phase === 'fin' && <EndView state={state} />}
    </div>
  );
}
