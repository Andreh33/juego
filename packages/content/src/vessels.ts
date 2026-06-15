// Los 6 Recipientes (§8) como DATA. El engine aplica setup + mecanica.
import type { VesselDef } from '@umbral/engine';

export const VESSELS: VesselDef[] = [
  {
    id: 'heraldo',
    name: 'El Heraldo',
    lore: 'El que descendio primero. Poker puro, sin trucos: la base limpia para aprender.',
    deckSize: 52,
    startingRelicId: 'relic.heraldo.estandarte',
    startingGold: 0,
    baseCombat: { hands: 4, discards: 3, handSize: 8 },
    objectiveFactor: 1,
    corduraBonusMult: 1,
    interestDivisor: 5,
    mechanic: 'eco', // Eco del Descenso: repetir tipo de mano da +1 mult permanente a ese tipo
    mechanicParams: { perRepeat: 1 },
  },
  {
    id: 'vidente',
    name: 'La Vidente',
    lore: 'Lee el porvenir en las cartas. Domestica la suerte; el mazo es mas fino.',
    deckSize: 44,
    startingRelicId: 'relic.vidente.tercer_ojo',
    startingGold: 0,
    baseCombat: { hands: 4, discards: 3, handSize: 8 },
    objectiveFactor: 1,
    corduraBonusMult: 1,
    interestDivisor: 5,
    mechanic: 'premonicion', // ver/enterrar cartas (info, render)
  },
  {
    id: 'usurero',
    name: 'El Usurero',
    lore: 'Todo tiene precio, hasta la cordura. Las monedas puntuan.',
    deckSize: 52,
    startingRelicId: 'relic.usurero.libro_de_cuentas',
    startingGold: 20,
    baseCombat: { hands: 4, discards: 3, handSize: 8 },
    objectiveFactor: 1.05, // §8.3: los objetivos sienten un +5%
    corduraBonusMult: 1,
    interestDivisor: 4, // Capital: interes mejorado +1/4
    innate: [{ kind: 'addFichas', n: 1, per: 'gold' }], // Capital: +1 ficha por moneda
    mechanic: 'none',
  },
  {
    id: 'coleccionista',
    name: 'El Coleccionista',
    lore: 'Cataloga cada carta como una pieza preciosa. Construye el mazo perfecto.',
    deckSize: 52,
    preEnhanced: { enhancement: 'grabado', oncePerSuit: true }, // 4 cartas con Grabado
    startingRelicId: 'relic.coleccionista.vitrina',
    startingGold: 0,
    baseCombat: { hands: 4, discards: 3, handSize: 8 },
    objectiveFactor: 1,
    corduraBonusMult: 1,
    interestDivisor: 5,
    mechanic: 'catalogo', // +20 fichas por palo con >=5 cartas mejoradas
    mechanicParams: { fichasPerSuit: 20, threshold: 5 },
  },
  {
    id: 'bestia',
    name: 'La Bestia',
    lore: 'No piensa, devora. Juega rapido, arriesga todo.',
    deckSize: 52,
    startingRelicId: 'relic.bestia.colmillo',
    startingGold: 0,
    baseCombat: { hands: 3, discards: 6, handSize: 8 }, // -1 mano, +3 descartes
    objectiveFactor: 1,
    corduraBonusMult: 1,
    interestDivisor: 5,
    mechanic: 'frenesi', // cada descarte +1 Frenesi -> +1 mult/punto en la proxima mano
    mechanicParams: { multPerFrenesi: 1 },
  },
  {
    id: 'profano',
    name: 'El Profano',
    lore: 'Abrazo lo de abajo. El poder llega rompiendose por dentro.',
    deckSize: 48,
    preSealed: { seal: 'violeta', count: 2 }, // 2 cartas con sello Violeta
    startingRelicId: 'relic.profano.sello_roto',
    startingGold: 0,
    baseCombat: { hands: 4, discards: 3, handSize: 8 },
    objectiveFactor: 1,
    corduraBonusMult: 2, // Comunion: el bono de Cordura (§10.3) cuenta doble
    interestDivisor: 5,
    mechanic: 'none',
  },
];
