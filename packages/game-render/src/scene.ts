// Escena de combate en PixiJS v8 (§17.11/§17.13): lee snapshots del engine y dibuja la mano,
// con reparto/selección/tilt animados a 60fps. CERO reglas de juego: emite onToggle(cardId) y el
// engine (via el store) decide. La capa de acciones (jugar/descartar) y el HUD viven en React.
import type { Card } from '@umbral/shared';
import { Application, Container } from 'pixi.js';
import { CARD_H, CARD_W, CardView } from './card';

export interface CombatSnapshot {
  hand: Card[];
  selectedIds: string[];
}
export interface CombatHandlers {
  onToggle: (id: string) => void;
}
export interface CombatController {
  sync: (snap: CombatSnapshot, handlers: CombatHandlers) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export async function mountCombatScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<CombatController> {
  const app = new Application();
  await app.init({
    canvas,
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
    autoDensity: true,
  });

  const hand = new Container();
  hand.sortableChildren = true;
  app.stage.addChild(hand);

  const views = new Map<string, CardView>();
  const targets = new Map<string, { x: number; y: number }>();
  let w = width;
  let h = height;
  let onToggle: (id: string) => void = () => {};

  function layout(): void {
    const ids = [...views.keys()];
    const n = ids.length;
    if (n === 0) return;
    const gap = Math.min(CARD_W + 14, (w - 40) / n);
    const totalW = gap * (n - 1);
    const startX = w / 2 - totalW / 2;
    const baseY = h - CARD_H / 2 - 24;
    ids.forEach((id, i) => {
      const v = views.get(id);
      if (!v) return;
      const raise = (v.selected ? 28 : 0) + (v.hovered ? 12 : 0);
      targets.set(id, { x: startX + gap * i, y: baseY - raise });
      v.zIndex = v.hovered ? 1000 : v.selected ? 500 : i;
    });
  }

  function attach(v: CardView): void {
    v.on('pointerover', () => {
      v.hovered = true;
      layout();
    });
    v.on('pointerout', () => {
      v.hovered = false;
      v.px = 0;
      v.py = 0;
      layout();
    });
    v.on('pointermove', (e) => {
      const p = v.toLocal(e.global);
      v.px = Math.max(-1, Math.min(1, (p.x / CARD_W) * 2 - 1));
      v.py = Math.max(-1, Math.min(1, (p.y / CARD_H) * 2 - 1));
    });
    v.on('pointertap', () => onToggle(v.card.id));
  }

  function sync(snap: CombatSnapshot, handlers: CombatHandlers): void {
    onToggle = handlers.onToggle;
    const want = new Map(snap.hand.map((c) => [c.id, c]));
    const sel = new Set(snap.selectedIds);
    // Quitar las que ya no están.
    for (const [id, v] of views) {
      if (!want.has(id)) {
        v.destroy();
        views.delete(id);
        targets.delete(id);
      }
    }
    // Añadir nuevas (entran desde la derecha = reparto).
    for (const c of snap.hand) {
      let v = views.get(c.id);
      if (!v) {
        v = new CardView(c);
        v.position.set(w + CARD_W, h - CARD_H / 2 - 24);
        attach(v);
        hand.addChild(v);
        views.set(c.id, v);
      }
      v.setSelected(sel.has(c.id));
    }
    layout();
  }

  app.ticker.add((tk) => {
    const dt = tk.deltaTime;
    for (const [id, v] of views) {
      const t = targets.get(id);
      if (t) {
        const k = Math.min(1, 0.2 * dt);
        v.x = lerp(v.x, t.x, k);
        v.y = lerp(v.y, t.y, k);
      }
      v.tick(dt);
    }
  });

  return {
    sync,
    resize: (nw, nh) => {
      w = nw;
      h = nh;
      app.renderer.resize(nw, nh);
      layout();
    },
    destroy: () => {
      app.destroy(true, { children: true });
      views.clear();
      targets.clear();
    },
  };
}
