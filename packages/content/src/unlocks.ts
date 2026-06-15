// Arbol de desbloqueos (§12.2): recipientes, reliquias bloqueadas, mazos alternativos,
// manos especiales, jefe secreto, cosmeticos. Datos -> el motor de progresion los evalua.
import type { UnlockDef } from '@umbral/engine';

// ---- Recipientes (5 desbloqueables; el Heraldo es de inicio) ----
const VESSEL_UNLOCKS: UnlockDef[] = [
  {
    id: 'unlock.vessel.vidente',
    name: 'El Vidente',
    desc: 'Gana 1 run con el Heraldo.',
    kind: 'recipiente',
    payload: 'vidente',
    cond: { key: 'wonWith.heraldo', gte: 1 },
  },
  {
    id: 'unlock.vessel.usurero',
    name: 'El Usurero',
    desc: 'Acumula 1.000 de oro entre todas tus runs.',
    kind: 'recipiente',
    payload: 'usurero',
    cond: { key: 'lifetime.goldEarned', gte: 1000 },
  },
  {
    id: 'unlock.vessel.coleccionista',
    name: 'El Coleccionista',
    desc: 'Ten 20 cartas con mejora a la vez en una run.',
    kind: 'recipiente',
    payload: 'coleccionista',
    cond: { key: 'run.enhancedCards', gte: 20 },
  },
  {
    id: 'unlock.vessel.bestia',
    name: 'La Bestia',
    desc: 'Gana un combate usando 10 o mas descartes.',
    kind: 'recipiente',
    payload: 'bestia',
    cond: { key: 'run.maxDiscardsUsed', gte: 10 },
  },
  {
    id: 'unlock.vessel.profano',
    name: 'El Profano',
    desc: 'Llega a Cordura 0 y sobrevive el combate.',
    kind: 'recipiente',
    payload: 'profano',
    cond: { key: 'run.touchedSanity0', eq: 1 },
  },
];

// ---- Manos especiales (§7.4), via hitos ----
const HAND_UNLOCKS: UnlockDef[] = [
  {
    id: 'unlock.hand.quinteto',
    name: 'Quinteto',
    desc: 'Alcanza el Umbral 5.',
    kind: 'mano',
    payload: 'quinteto',
    cond: { key: 'lifetime.maxDepth', gte: 5 },
  },
  {
    id: 'unlock.hand.quinteto_color',
    name: 'Quinteto de Color',
    desc: 'Alcanza el Umbral 8 (vence una run).',
    kind: 'mano',
    payload: 'quinteto_color',
    cond: { key: 'lifetime.runsWon', gte: 1 },
  },
  {
    id: 'unlock.hand.hilera_negra',
    name: 'Hilera Negra',
    desc: 'Desciende al Umbral 12 en Infinito.',
    kind: 'mano',
    payload: 'hilera_negra',
    cond: { key: 'lifetime.maxDepth', gte: 12 },
  },
];

// ---- Jefe secreto (§11.8) ----
const BOSS_UNLOCKS: UnlockDef[] = [
  {
    id: 'unlock.boss.huesped',
    name: 'El Huesped',
    desc: 'Gana una run sin perder ninguna vela.',
    kind: 'jefe',
    payload: 'boss.huesped',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.candlesLost', lte: 0 },
      ],
    },
  },
];

// ---- Mazos alternativos por Recipiente (~10) ----
const DECK_UNLOCKS: UnlockDef[] = [
  {
    id: 'unlock.deck.asceta',
    name: 'Mazo del Asceta (Heraldo)',
    desc: 'Gana 3 runs en total.',
    kind: 'mazo',
    payload: 'deck.heraldo.asceta',
    cond: { key: 'lifetime.runsWon', gte: 3 },
  },
  {
    id: 'unlock.deck.profeta',
    name: 'Mazo del Profeta (Vidente)',
    desc: 'Gana con el Vidente.',
    kind: 'mazo',
    payload: 'deck.vidente.profeta',
    cond: { key: 'wonWith.vidente', gte: 1 },
  },
  {
    id: 'unlock.deck.prestamista',
    name: 'Mazo del Prestamista (Usurero)',
    desc: 'Ten 500 de oro a la vez en una run.',
    kind: 'mazo',
    payload: 'deck.usurero.prestamista',
    cond: { key: 'run.goldPeak', gte: 500 },
  },
  {
    id: 'unlock.deck.curador',
    name: 'Mazo del Curador (Coleccionista)',
    desc: 'Gana con el Coleccionista.',
    kind: 'mazo',
    payload: 'deck.coleccionista.curador',
    cond: { key: 'wonWith.coleccionista', gte: 1 },
  },
  {
    id: 'unlock.deck.carnicero',
    name: 'Mazo del Carnicero (Bestia)',
    desc: 'Gana con la Bestia.',
    kind: 'mazo',
    payload: 'deck.bestia.carnicero',
    cond: { key: 'wonWith.bestia', gte: 1 },
  },
  {
    id: 'unlock.deck.hereje',
    name: 'Mazo del Hereje (Profano)',
    desc: 'Gana con el Profano.',
    kind: 'mazo',
    payload: 'deck.profano.hereje',
    cond: { key: 'wonWith.profano', gte: 1 },
  },
];

// ---- Reliquias bloqueadas (~25), via hitos tematicos (claves rastreadas) ----
type RelicUnlock = {
  id: string;
  name: string;
  relic: string;
  desc: string;
  cond: UnlockDef['cond'];
};
const RELIC_UNLOCKS_RAW: RelicUnlock[] = [
  {
    id: 'unlock.relic.vitral',
    name: 'Vitral',
    relic: 'relic.vitral',
    desc: 'Gana una run con un mazo de un solo palo.',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.singleSuitDeck', eq: 1 },
      ],
    },
  },
  {
    id: 'unlock.relic.gloton',
    name: 'Gloton',
    relic: 'relic.gloton',
    desc: 'Gana sin ninguna reliquia de ×mult.',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.noXmultRelics', eq: 1 },
      ],
    },
  },
  {
    id: 'unlock.relic.tridente',
    name: 'Tridente',
    relic: 'relic.tridente',
    desc: 'Gana sin reliquias de fichas planas.',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.noFlatRelics', eq: 1 },
      ],
    },
  },
  {
    id: 'unlock.relic.osario_mayor',
    name: 'Osario Mayor',
    relic: 'relic.osario_mayor',
    desc: 'Vence 50 jefes/elites en total.',
    cond: { key: 'lifetime.bossesDefeated', gte: 50 },
  },
  {
    id: 'unlock.relic.corazon_negro',
    name: 'Corazon Negro',
    relic: 'relic.corazon_negro',
    desc: 'Lleva 3 reliquias Malditas a la vez.',
    cond: { key: 'lifetime.maxMalditasHeld', gte: 3 },
  },
  {
    id: 'unlock.relic.luna_sangrante',
    name: 'Luna Sangrante',
    relic: 'relic.luna_sangrante',
    desc: 'Gana habiendo tocado Cordura 0.',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.touchedSanity0', eq: 1 },
      ],
    },
  },
  {
    id: 'unlock.relic.banquete',
    name: 'Banquete',
    relic: 'relic.banquete',
    desc: 'Ten 500 de oro a la vez.',
    cond: { key: 'run.goldPeak', gte: 500 },
  },
  {
    id: 'unlock.relic.eclipse',
    name: 'Eclipse',
    relic: 'relic.eclipse',
    desc: 'Desciende al Umbral 10 (Infinito).',
    cond: { key: 'lifetime.maxDepth', gte: 10 },
  },
  {
    id: 'unlock.relic.convergencia',
    name: 'Convergencia',
    relic: 'relic.convergencia',
    desc: 'Haz una mano de 100.000+.',
    cond: { key: 'lifetime.bestHandScore', gte: 100000 },
  },
  {
    id: 'unlock.relic.camara_de_ecos',
    name: 'Camara de Ecos',
    relic: 'relic.camara_de_ecos',
    desc: 'Haz una mano de 1.000.000+.',
    cond: { key: 'lifetime.bestHandScore', gte: 1000000 },
  },
  {
    id: 'unlock.relic.cuatro_palos',
    name: 'Cuatro Palos',
    relic: 'relic.cuatro_palos',
    desc: 'Resuelve 20 eventos distintos.',
    cond: { key: 'lifetime.eventsResolved', gte: 20 },
  },
  {
    id: 'unlock.relic.corte_real',
    name: 'Corte Real',
    relic: 'relic.corte_real',
    desc: 'Ve 50 reliquias distintas.',
    cond: { key: 'lifetime.relicsSeen', gte: 50 },
  },
  {
    id: 'unlock.relic.monarca',
    name: 'Monarca',
    relic: 'relic.monarca',
    desc: 'Gana 5 runs.',
    cond: { key: 'lifetime.runsWon', gte: 5 },
  },
  {
    id: 'unlock.relic.serpiente',
    name: 'Serpiente',
    relic: 'relic.serpiente',
    desc: 'Supera el Velo 3 con algun Recipiente.',
    cond: { key: 'lifetime.maxVeil', gte: 3 },
  },
  {
    id: 'unlock.relic.trinidad',
    name: 'Trinidad',
    relic: 'relic.trinidad',
    desc: 'Supera el Velo 6.',
    cond: { key: 'lifetime.maxVeil', gte: 6 },
  },
  {
    id: 'unlock.relic.vendetta',
    name: 'Vendetta',
    relic: 'relic.vendetta',
    desc: 'Supera el Velo 10.',
    cond: { key: 'lifetime.maxVeil', gte: 10 },
  },
  {
    id: 'unlock.relic.espejo_negro',
    name: 'Espejo Negro',
    relic: 'relic.espejo_negro',
    desc: 'Gana un combate con Cordura 1.',
    cond: { key: 'run.minSanity', lte: 1 },
  },
  {
    id: 'unlock.relic.reverberacion',
    name: 'Reverberacion',
    relic: 'relic.reverberacion',
    desc: 'Ten 30 cartas con mejora en una run.',
    cond: { key: 'run.enhancedCards', gte: 30 },
  },
  {
    id: 'unlock.relic.sanguijuela',
    name: 'Sanguijuela',
    relic: 'relic.sanguijuela',
    desc: 'Usa 15 descartes en un combate.',
    cond: { key: 'run.maxDiscardsUsed', gte: 15 },
  },
  {
    id: 'unlock.relic.sistole',
    name: 'Sistole',
    relic: 'relic.sistole',
    desc: 'Vence 10 jefes/elites distintos.',
    cond: { key: 'lifetime.bossesDefeated', gte: 10 },
  },
  {
    id: 'unlock.relic.gemelo',
    name: 'Gemelo',
    relic: 'relic.gemelo',
    desc: 'Gana con 2 Recipientes distintos.',
    cond: { key: 'lifetime.vesselsWon', gte: 2 },
  },
  {
    id: 'unlock.relic.eco_hueco',
    name: 'Eco Hueco',
    relic: 'relic.eco_hueco',
    desc: 'Juega 10 runs.',
    cond: { key: 'lifetime.runsPlayed', gte: 10 },
  },
  {
    id: 'unlock.relic.resonancia_espectral',
    name: 'Resonancia Espectral',
    relic: 'relic.resonancia_espectral',
    desc: 'Desciende al Umbral 15.',
    cond: { key: 'lifetime.maxDepth', gte: 15 },
  },
  {
    id: 'unlock.relic.cronica',
    name: 'Cronica',
    relic: 'relic.cronica',
    desc: 'Ve 80 reliquias distintas.',
    cond: { key: 'lifetime.relicsSeen', gte: 80 },
  },
  {
    id: 'unlock.relic.as_en_la_manga',
    name: 'As en la Manga',
    relic: 'relic.as_en_la_manga',
    desc: 'Gana en el Velo 15.',
    cond: { key: 'lifetime.maxVeil', gte: 15 },
  },
];
const RELIC_UNLOCKS: UnlockDef[] = RELIC_UNLOCKS_RAW.map((r) => ({
  id: r.id,
  name: r.name,
  desc: r.desc,
  kind: 'reliquia' as const,
  payload: r.relic,
  cond: r.cond,
}));

export const UNLOCKS: UnlockDef[] = [
  ...VESSEL_UNLOCKS,
  ...HAND_UNLOCKS,
  ...BOSS_UNLOCKS,
  ...DECK_UNLOCKS,
  ...RELIC_UNLOCKS,
];
