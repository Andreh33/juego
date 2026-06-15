// Escena de combate en PixiJS v8 (§17.11/§17.13): lee snapshots del engine y dibuja la mano,
// con reparto/selección/tilt animados a 60fps. CERO reglas de juego: emite onToggle(cardId) y el
// engine (via el store) decide. La capa de acciones (jugar/descartar) y el HUD viven en React.
import type { FeelEvent } from '@umbral/engine';
import type { Card } from '@umbral/shared';
import { Application, Container, Text, TextStyle } from 'pixi.js';
import { CARD_H, CARD_W, CardView } from './card';
import { COLORS } from './materials';

export interface CombatSnapshot {
  hand: Card[];
  selectedIds: string[];
}
export interface CombatHandlers {
  onToggle: (id: string) => void;
}
export interface CombatController {
  sync: (snap: CombatSnapshot, handlers: CombatHandlers) => void;
  /** Reproduce el juice de los FeelEvent del engine (scorePop, shake...). */
  feel: (events: readonly FeelEvent[]) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
}

interface Pop {
  text: Text;
  life: number;
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

  const fxLayer = new Container();
  app.stage.addChild(fxLayer);

  const views = new Map<string, CardView>();
  const targets = new Map<string, { x: number; y: number }>();
  const pops: Pop[] = [];
  let shake = 0;
  let w = width;
  let h = height;
  let onToggle: (id: string) => void = () => {};

  function feel(events: readonly FeelEvent[]): void {
    for (const e of events) {
      if (e.t === 'scorePop') {
        const text = new Text({
          text: `+${Math.round(e.total).toLocaleString()}`,
          style: new TextStyle({ fill: COLORS.ocreAlto, fontSize: 40, fontWeight: '800' }),
        });
        text.anchor.set(0.5);
        text.position.set(w / 2, h * 0.42);
        fxLayer.addChild(text);
        pops.push({ text, life: 1 });
        shake = Math.max(shake, 6);
      } else if (e.t === 'shake') {
        shake = Math.max(shake, Math.min(16, e.intensity * 4));
      }
    }
  }

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
    // Shake de pantalla (decae).
    if (shake > 0.1) {
      hand.x = (Math.random() - 0.5) * shake;
      hand.y = (Math.random() - 0.5) * shake;
      shake *= 0.85 ** dt;
    } else {
      hand.x = 0;
      hand.y = 0;
      shake = 0;
    }
    // Score pops: suben y se desvanecen.
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      if (!p) continue;
      p.life -= 0.02 * dt;
      p.text.y -= 0.8 * dt;
      p.text.alpha = Math.max(0, p.life);
      p.text.scale.set(1 + (1 - p.life) * 0.3);
      if (p.life <= 0) {
        p.text.destroy();
        pops.splice(i, 1);
      }
    }
  });

  return {
    sync,
    feel,
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
