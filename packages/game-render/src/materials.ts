// Kit de materiales base (§17.13 placeholders premium): paletas y un material "panel" con bisel
// y veta, reutilizable por cartas/fichas/marcos. Dibujado con Pixi Graphics (sin assets externos):
// el albedo es color + bisel; la "luz sobre el normal" se simula con un sheen que se mueve con el
// tilt (ver card.ts). El shader GLSL de normal map real (§17.11) entra cuando lleguen los mapas.
import { Container, Graphics } from 'pixi.js';

export const COLORS = {
  vacio: 0x0a0b0f,
  tinta: 0x14161d,
  pergamino: 0x1b1d26,
  hueso: 0xe8e2d0,
  ceniza: 0x8b8775,
  ocre: 0xc8923a,
  ocreAlto: 0xe6b45a,
  sangre: 0x7a1420,
  verdin: 0x3e6b5a,
  fosforo: 0xa9f0d1,
  violeta: 0x6b5a9b,
} as const;

export type MaterialKind = 'pergamino' | 'foil' | 'oro';

export interface Material {
  base: number;
  baseHi: number; // bisel claro (luz)
  baseLo: number; // bisel sombra
  edge: number; // borde/marco
  /** Intensidad del foil/iridiscencia (0 = mate, 1 = holo). */
  foil: number;
}

export const MATERIALS: Record<MaterialKind, Material> = {
  pergamino: { base: 0x222530, baseHi: 0x33384a, baseLo: 0x14161d, edge: 0x8b8775, foil: 0.12 },
  foil: { base: 0x2a2740, baseHi: 0x4a3f6b, baseLo: 0x16131f, edge: 0xb9a6e0, foil: 0.85 },
  oro: { base: 0x3a2c14, baseHi: 0x6b5320, baseLo: 0x1d1608, edge: 0xe6b45a, foil: 0.55 },
};

/** Dibuja un panel con material: cuerpo, bisel (luz arriba-izq, sombra abajo-der) y veta sutil. */
export function drawPanel(g: Graphics, w: number, h: number, radius: number, mat: Material): void {
  g.clear();
  // Cuerpo.
  g.roundRect(0, 0, w, h, radius).fill({ color: mat.base });
  // Bisel claro (borde superior/izquierdo).
  g.roundRect(1.5, 1.5, w - 3, h - 3, radius - 1).stroke({
    color: mat.baseHi,
    width: 1.5,
    alpha: 0.6,
    alignment: 1,
  });
  // Veta: lineas finas diagonales muy tenues (textura de material).
  for (let i = -h; i < w; i += 7) {
    g.moveTo(i, 0)
      .lineTo(i + h, h)
      .stroke({ color: mat.baseHi, width: 0.5, alpha: 0.04 });
  }
  // Sombra interior abajo-derecha (volumen).
  g.roundRect(0, h * 0.55, w, h * 0.45, radius).fill({ color: mat.baseLo, alpha: 0.25 });
  // Marco.
  g.roundRect(0.75, 0.75, w - 1.5, h - 1.5, radius).stroke({
    color: mat.edge,
    width: 1,
    alpha: 0.7,
  });
}

/** Sombra de contacto: elipse oscura difusa para apoyar la pieza en la mesa. */
export function makeContactShadow(w: number): Graphics {
  const s = new Graphics();
  s.ellipse(0, 0, w * 0.45, w * 0.16).fill({ color: 0x000000, alpha: 0.45 });
  return s;
}

/** Capa de sheen/especular: una banda clara que se mueve con el tilt (luz sobre el normal). */
export function makeSheen(w: number, h: number, radius: number): Container {
  const c = new Container();
  const g = new Graphics();
  // Banda diagonal clara.
  g.roundRect(0, 0, w, h, radius).fill({ color: 0xffffff, alpha: 1 });
  g.blendMode = 'add';
  c.addChild(g);
  c.alpha = 0;
  return c;
}
