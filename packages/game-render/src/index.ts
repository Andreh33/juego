// @umbral/game-render — los OJOS. Capa PixiJS v8 que consume snapshots del engine y reproduce
// FeelEvents. CERO reglas de juego (§3). Render de combate (B6) con placeholders premium (§17.13).
export { CARD_H, CARD_W, CardView } from './card';
export { COLORS, MATERIALS, type Material, type MaterialKind } from './materials';
export {
  type CombatController,
  type CombatHandlers,
  type CombatSnapshot,
  mountCombatScene,
} from './scene';
