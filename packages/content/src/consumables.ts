// Arcanos consumibles como DATA (§11.2 Augurios, §11.3 Sellos). Bloque 5: basicos para probar
// el DSL via USE_CONSUMABLE. El catalogo completo (+ Conjuros, §11.4) llega en el Bloque 10.
import type { ConsumableDef } from '@umbral/engine';

export const CONSUMABLES: ConsumableDef[] = [
  // Augurios (modifican cartas, §11.2)
  {
    id: 'augurio.grabador',
    name: 'Augurio del Grabador',
    kind: 'augurio',
    flavor: 'Talla el numero en la carne de la carta.',
    applyEnhancement: 'grabado',
    maxTargets: 1,
  },
  {
    id: 'augurio.marca',
    name: 'Augurio de la Marca',
    kind: 'augurio',
    flavor: 'Una marca que multiplica.',
    applyEnhancement: 'marca',
    maxTargets: 1,
  },
  {
    id: 'augurio.unto',
    name: 'Augurio del Unto',
    kind: 'augurio',
    flavor: 'Unta la carta con algo que brilla mal.',
    applyEnhancement: 'untado',
    maxTargets: 1,
  },
  {
    id: 'augurio.sello_sangre',
    name: 'Augurio del Sello de Sangre',
    kind: 'augurio',
    flavor: 'Sella la carta para que vuelva a hablar.',
    applySeal: 'sangre',
    maxTargets: 1,
  },
  // Sellos (suben nivel de manos, §11.3)
  {
    id: 'sello.pareja',
    name: 'Sello de la Pareja',
    kind: 'sello',
    flavor: 'Eleva el rango de lo que viene en dos.',
    levelUpHand: 'pareja',
  },
  {
    id: 'sello.universal',
    name: 'Sello Universal',
    kind: 'sello',
    flavor: 'Eleva todo a la vez. Caro y raro.',
    levelUpHand: 'all',
  },
];
