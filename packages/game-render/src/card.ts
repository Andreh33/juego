// Carta compuesta sobre el material base (§17.13). Marco + inicial de rango/palo, sheen que se
// mueve con el tilt (luz sobre el "normal"), especular, foil/holo segun la mejora (placeholder de
// rareza) y sombra de contacto. Cero logica de juego: solo dibuja un Card del engine.
import type { Card, Suit } from '@umbral/shared';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  COLORS,
  drawPanel,
  MATERIALS,
  type Material,
  makeContactShadow,
  makeSheen,
} from './materials';

export const CARD_W = 96;
export const CARD_H = 134;
const RADIUS = 10;

const SUIT_GLYPH: Record<Suit, string> = { CALIZ: '☥', LLAVE: '⚷', HUESO: '☠', OJO: '◉' };
const SUIT_COLOR: Record<Suit, number> = {
  CALIZ: COLORS.verdin,
  LLAVE: COLORS.ocreAlto,
  HUESO: COLORS.hueso,
  OJO: COLORS.violeta,
};
const ENH_BADGE: Record<string, string> = {
  grabado: 'GR',
  marca: 'MA',
  untado: 'UN',
  dorado: 'DO',
  cristal: 'CR',
  piedra: 'PI',
  espejo: 'ES',
};

function rankLabel(rank: number | null): string {
  if (rank === null) return '■';
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

/** El material (placeholder de rareza): oro/foil segun la mejora, pergamino por defecto. */
function materialFor(card: Card): Material {
  switch (card.enhancement) {
    case 'dorado':
      return MATERIALS.oro;
    case 'espejo':
    case 'cristal':
    case 'marca':
    case 'untado':
      return MATERIALS.foil;
    default:
      return MATERIALS.pergamino;
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class CardView extends Container {
  readonly card: Card;
  private readonly mat: Material;
  private readonly inner = new Container(); // se inclina con el tilt
  private readonly sheen: Container;
  private readonly foil: Graphics;
  private readonly shadow: Graphics;
  hovered = false;
  selected = false;
  /** Posicion del puntero relativa al centro (-1..1) para mover la luz. */
  px = 0;
  py = 0;
  private curRot = 0;
  private curScale = 1;
  private curSheen = 0;

  constructor(card: Card) {
    super();
    this.card = card;
    this.mat = materialFor(card);

    this.shadow = makeContactShadow(CARD_W);
    this.shadow.position.set(0, CARD_H * 0.52);
    this.addChild(this.shadow);

    this.inner.pivot.set(CARD_W / 2, CARD_H / 2);
    this.addChild(this.inner);

    const body = new Graphics();
    drawPanel(body, CARD_W, CARD_H, RADIUS, this.mat);
    this.inner.addChild(body);

    // Capas FX (foil + sheen) recortadas al cuerpo.
    const fx = new Container();
    this.foil = makeFoil(CARD_W, CARD_H, RADIUS);
    this.foil.alpha = this.mat.foil * 0.35;
    this.sheen = makeSheen(CARD_W * 0.5, CARD_H * 1.6, RADIUS);
    this.sheen.rotation = -0.5;
    this.sheen.position.set(CARD_W / 2, CARD_H / 2);
    this.sheen.pivot.set(CARD_W * 0.25, CARD_H * 0.8);
    fx.addChild(this.foil, this.sheen);
    const mask = new Graphics();
    mask.roundRect(0, 0, CARD_W, CARD_H, RADIUS).fill(0xffffff);
    fx.mask = mask;
    this.inner.addChild(mask, fx);

    // Rango + palo.
    const suitColor = card.suit ? SUIT_COLOR[card.suit] : COLORS.ceniza;
    const glyph = card.suit ? SUIT_GLYPH[card.suit] : '■';
    const corner = new TextStyle({ fill: suitColor, fontSize: 20, fontWeight: '700' });
    const tl = new Text({ text: rankLabel(card.rank), style: corner });
    tl.position.set(8, 6);
    const br = new Text({ text: rankLabel(card.rank), style: corner });
    br.anchor.set(1, 1);
    br.position.set(CARD_W - 8, CARD_H - 6);
    br.rotation = Math.PI;
    const big = new Text({
      text: glyph,
      style: new TextStyle({ fill: suitColor, fontSize: 48, fontWeight: '700' }),
    });
    big.anchor.set(0.5);
    big.position.set(CARD_W / 2, CARD_H / 2);
    this.inner.addChild(big, tl, br);

    if (card.enhancement) {
      const badge = new Text({
        text: ENH_BADGE[card.enhancement] ?? '?',
        style: new TextStyle({ fill: COLORS.ocreAlto, fontSize: 11, fontWeight: '700' }),
      });
      badge.position.set(8, CARD_H - 20);
      this.inner.addChild(badge);
    }
    if (card.seal) {
      const dot = new Graphics();
      dot.circle(CARD_W - 12, CARD_H - 14, 4).fill({ color: sealColor(card.seal) });
      this.inner.addChild(dot);
    }

    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  setSelected(v: boolean): void {
    this.selected = v;
  }

  /** Avanza animaciones (lerp suave del tilt/sheen/escala). dt en frames (~1 a 60fps). */
  tick(dt: number): void {
    const k = Math.min(1, 0.18 * dt);
    const targetRot = this.hovered ? this.px * 0.08 : 0;
    const targetScale = this.hovered ? 1.07 : 1;
    const targetSheen = this.hovered ? 0.26 : 0;
    this.curRot = lerp(this.curRot, targetRot, k);
    this.curScale = lerp(this.curScale, targetScale, k);
    this.curSheen = lerp(this.curSheen, targetSheen, k);

    this.inner.rotation = this.curRot;
    this.inner.skew.set(
      this.py * 0.06 * (this.hovered ? 1 : 0),
      -this.px * 0.06 * (this.hovered ? 1 : 0),
    );
    this.inner.scale.set(this.curScale);
    this.sheen.alpha = this.curSheen;
    // La luz (sheen) se mueve con el tilt sobre el material.
    this.sheen.x = CARD_W / 2 + this.px * CARD_W * 0.55;
    this.sheen.y = CARD_H / 2 + this.py * CARD_H * 0.35;
    this.foil.alpha = this.mat.foil * (this.hovered ? 0.9 : 0.35);
    this.foil.x = this.px * 6;
    this.shadow.alpha = this.hovered ? 0.3 : 0.45;
    this.shadow.scale.set(this.hovered ? 1.08 : 1);
  }
}

function sealColor(seal: string): number {
  switch (seal) {
    case 'sangre':
      return COLORS.sangre;
    case 'verdin':
      return COLORS.verdin;
    case 'violeta':
      return COLORS.violeta;
    case 'dorado':
      return COLORS.ocreAlto;
    default:
      return COLORS.ocre;
  }
}

/** Foil/holo: bandas iridiscentes tenues que dan el brillo de rareza. */
function makeFoil(w: number, h: number, radius: number): Graphics {
  const g = new Graphics();
  const bands = [0xff5a8a, 0x5ad1ff, 0xa9f0d1, 0xe6b45a];
  const bw = w / bands.length;
  bands.forEach((c, i) => {
    g.roundRect(i * bw, 0, bw + 1, h, i === 0 || i === bands.length - 1 ? radius : 0).fill({
      color: c,
      alpha: 0.5,
    });
  });
  g.blendMode = 'add';
  return g;
}
