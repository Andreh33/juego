'use client';
import type { FeelEvent } from '@umbral/engine';
// Isla cliente del render de combate (B6): monta la escena PixiJS de @umbral/game-render y le
// pasa snapshots (mano + selección) del engine. Se carga con ssr:false (Pixi necesita el DOM).
import { type CombatController, mountCombatScene } from '@umbral/game-render';
import type { Card } from '@umbral/shared';
import { useEffect, useRef } from 'react';

const HEIGHT = 280;

export function PixiCombat({
  hand,
  selectedIds,
  onToggle,
  events,
}: {
  hand: Card[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  events: readonly FeelEvent[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<CombatController | null>(null);
  const latest = useRef({ hand, selectedIds, onToggle });
  latest.current = { hand, selectedIds, onToggle };

  // Monta la escena una vez (init de Pixi es async; protegido contra desmontaje en StrictMode).
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth || 800;
    mountCombatScene(canvas, w, HEIGHT)
      .then((ctrl) => {
        if (cancelled) {
          ctrl.destroy();
          return;
        }
        ctrlRef.current = ctrl;
        ctrl.sync(
          { hand: latest.current.hand, selectedIds: latest.current.selectedIds },
          { onToggle: (id) => latest.current.onToggle(id) },
        );
      })
      .catch((err) => {
        // Si Pixi/WebGL falla, no tumbamos la run: la consola lo registra y el canvas queda vacio.
        console.error('[PixiCombat] no se pudo montar la escena:', err);
      });
    const onResize = () => ctrlRef.current?.resize(wrap.clientWidth || 800, HEIGHT);
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      ctrlRef.current?.destroy();
      ctrlRef.current = null;
    };
  }, []);

  // Re-sincroniza cada vez que cambian mano o selección.
  useEffect(() => {
    ctrlRef.current?.sync({ hand, selectedIds }, { onToggle: (id) => latest.current.onToggle(id) });
  }, [hand, selectedIds]);

  // Reproduce el juice (score pop, shake) de los FeelEvent del último paso.
  useEffect(() => {
    if (events.length > 0) ctrlRef.current?.feel(events);
  }, [events]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="mx-auto block" style={{ height: HEIGHT }} />
    </div>
  );
}
