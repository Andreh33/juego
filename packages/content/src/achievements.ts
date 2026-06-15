// Logros (§12.3, ~100). Datos declarativos: el motor de progresion (engine) evalua cada
// `cond` contra el stat bag (perfil + resumen de run). Cero `if`-por-id.
import type { AchievementDef } from '@umbral/engine';
import type { VesselId } from '@umbral/shared';

type A = AchievementDef;

const VESSELS: { id: VesselId; name: string }[] = [
  { id: 'heraldo', name: 'el Heraldo' },
  { id: 'vidente', name: 'el Vidente' },
  { id: 'usurero', name: 'el Usurero' },
  { id: 'coleccionista', name: 'el Coleccionista' },
  { id: 'bestia', name: 'la Bestia' },
  { id: 'profano', name: 'el Profano' },
];

// ---- Progreso ----
const PROGRESO: A[] = [
  {
    id: 'ach.primer_descenso',
    name: 'Primer Descenso',
    desc: 'Gana 1 run.',
    category: 'progreso',
    cond: { key: 'lifetime.runsWon', gte: 1 },
  },
  {
    id: 'ach.veterano',
    name: 'Veterano',
    desc: 'Gana 5 runs.',
    category: 'progreso',
    cond: { key: 'lifetime.runsWon', gte: 5 },
  },
  {
    id: 'ach.consumado',
    name: 'Consumado',
    desc: 'Gana 25 runs.',
    category: 'progreso',
    cond: { key: 'lifetime.runsWon', gte: 25 },
  },
  {
    id: 'ach.incansable',
    name: 'Incansable',
    desc: 'Juega 50 runs.',
    category: 'progreso',
    cond: { key: 'lifetime.runsPlayed', gte: 50 },
  },
  {
    id: 'ach.el_fondo',
    name: 'El Fondo',
    desc: 'Gana en Velo 0 con cada Recipiente.',
    category: 'progreso',
    cond: { key: 'lifetime.vesselsWon', gte: 6 },
  },
  {
    id: 'ach.ascension',
    name: 'Ascension',
    desc: 'Supera el Velo 5 con algun Recipiente.',
    category: 'progreso',
    cond: { key: 'lifetime.maxVeil', gte: 5 },
  },
  {
    id: 'ach.escalador',
    name: 'Escalador',
    desc: 'Supera el Velo 10.',
    category: 'progreso',
    cond: { key: 'lifetime.maxVeil', gte: 10 },
  },
  {
    id: 'ach.maestria',
    name: 'Maestria',
    desc: 'Conquista el Velo 20 con un Recipiente.',
    category: 'progreso',
    cond: { key: 'lifetime.veil20Count', gte: 1 },
  },
  {
    id: 'ach.leyenda',
    name: 'Leyenda',
    desc: 'Conquista el Velo 20 con los 6 Recipientes.',
    category: 'progreso',
    cond: { key: 'lifetime.veil20Count', gte: 6 },
  },
  // Ganar con cada Recipiente (6).
  ...VESSELS.map(
    (v): A => ({
      id: `ach.win.${v.id}`,
      name: `Comunion: ${v.name}`,
      desc: `Gana una run con ${v.name}.`,
      category: 'progreso',
      cond: { key: `wonWith.${v.id}`, gte: 1 },
    }),
  ),
];

// ---- Puntuacion ----
const PUNTUACION: A[] = [
  {
    id: 'ach.cinco_cifras',
    name: 'Cinco Cifras',
    desc: 'Una mano de 10.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 10000 },
  },
  {
    id: 'ach.seis_cifras',
    name: 'Seis Cifras',
    desc: 'Una mano de 100.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 100000 },
  },
  {
    id: 'ach.medio_millon',
    name: 'Medio Millon',
    desc: 'Una mano de 500.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 500000 },
  },
  {
    id: 'ach.millon',
    name: 'Millon',
    desc: 'Una mano de 1.000.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 1000000 },
  },
  {
    id: 'ach.diez_millones',
    name: 'Diez Millones',
    desc: 'Una mano de 10.000.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 10000000 },
  },
  {
    id: 'ach.cien_millones',
    name: 'Cien Millones',
    desc: 'Una mano de 100.000.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 100000000 },
  },
  {
    id: 'ach.lo_imposible',
    name: 'Lo Imposible',
    desc: 'Una mano de 1.000.000.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 1000000000 },
  },
];

// ---- Builds ----
const BUILDS: A[] = [
  {
    id: 'ach.solo_fichas',
    name: 'Solo Fichas',
    desc: 'Gana sin ninguna reliquia de ×mult.',
    category: 'builds',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.noXmultRelics', eq: 1 },
      ],
    },
  },
  {
    id: 'ach.mult_puro',
    name: 'Mult Puro',
    desc: 'Gana sin reliquias de fichas planas.',
    category: 'builds',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.noFlatRelics', eq: 1 },
      ],
    },
  },
  {
    id: 'ach.economia',
    name: 'Economia',
    desc: 'Ten 500 de oro a la vez.',
    category: 'builds',
    cond: { key: 'run.goldPeak', gte: 500 },
  },
  {
    id: 'ach.magnate',
    name: 'Magnate',
    desc: 'Ten 1.000 de oro a la vez.',
    category: 'builds',
    cond: { key: 'run.goldPeak', gte: 1000 },
  },
  {
    id: 'ach.palo_unico',
    name: 'Palo Unico',
    desc: 'Gana con un mazo de un solo palo.',
    category: 'builds',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.singleSuitDeck', eq: 1 },
      ],
    },
  },
  {
    id: 'ach.coleccion',
    name: 'Coleccion',
    desc: 'Ten 20 cartas con mejora a la vez.',
    category: 'builds',
    cond: { key: 'run.enhancedCards', gte: 20 },
  },
  {
    id: 'ach.alquimista',
    name: 'Alquimista',
    desc: 'Ten 40 cartas con mejora a la vez.',
    category: 'builds',
    cond: { key: 'run.enhancedCards', gte: 40 },
  },
  {
    id: 'ach.descartador',
    name: 'Descartador',
    desc: 'Usa 10 descartes en un combate.',
    category: 'builds',
    cond: { key: 'run.maxDiscardsUsed', gte: 10 },
  },
  {
    id: 'ach.tormenta',
    name: 'Tormenta de Descartes',
    desc: 'Usa 20 descartes en un combate.',
    category: 'builds',
    cond: { key: 'run.maxDiscardsUsed', gte: 20 },
  },
  {
    id: 'ach.minimalista',
    name: 'Minimalista',
    desc: 'Gana con 3 reliquias o menos.',
    category: 'builds',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.relicCount', lte: 3 },
      ],
    },
  },
  {
    id: 'ach.arsenal',
    name: 'Arsenal',
    desc: 'Ten 8 reliquias en una run.',
    category: 'builds',
    cond: { key: 'run.relicCount', gte: 8 },
  },
];

// ---- Riesgo / Cordura ----
const RIESGO: A[] = [
  {
    id: 'ach.al_borde',
    name: 'Al Borde',
    desc: 'Gana un combate con Cordura 1.',
    category: 'riesgo',
    cond: { key: 'run.minSanity', lte: 1 },
  },
  {
    id: 'ach.abismo',
    name: 'Abismo',
    desc: 'Gana una run habiendo tocado Cordura 0.',
    category: 'riesgo',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.touchedSanity0', eq: 1 },
      ],
    },
  },
  {
    id: 'ach.pacto',
    name: 'Pacto',
    desc: 'Lleva 3 reliquias Malditas a la vez.',
    category: 'riesgo',
    cond: { key: 'run.malditasHeld', gte: 3 },
  },
  {
    id: 'ach.condenado',
    name: 'Condenado',
    desc: 'Lleva 5 reliquias Malditas a la vez.',
    category: 'riesgo',
    cond: { key: 'run.malditasHeld', gte: 5 },
  },
  {
    id: 'ach.impecable',
    name: 'Impecable',
    desc: 'Gana una run sin perder ninguna vela.',
    category: 'riesgo',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.candlesLost', lte: 0 },
      ],
    },
  },
  {
    id: 'ach.funambulista',
    name: 'Funambulista',
    desc: 'Gana una run perdiendo solo 1 vela.',
    category: 'riesgo',
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.candlesLost', lte: 1 },
      ],
    },
  },
];

// ---- Profundidad (Infinito) ----
const PROFUNDIDAD: A[] = [
  {
    id: 'ach.bajo_el_fondo',
    name: 'Bajo el Fondo',
    desc: 'Alcanza el Umbral 10.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 10 },
  },
  {
    id: 'ach.mas_hondo',
    name: 'Mas Hondo',
    desc: 'Alcanza el Umbral 15.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 15 },
  },
  {
    id: 'ach.sin_retorno',
    name: 'Sin Retorno',
    desc: 'Alcanza el Umbral 20.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 20 },
  },
  {
    id: 'ach.el_vacio',
    name: 'El Vacio',
    desc: 'Alcanza el Umbral 25.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 25 },
  },
];

// ---- Coleccionista ----
const COLECCIONISTA: A[] = [
  {
    id: 'ach.aprendiz',
    name: 'Aprendiz',
    desc: 'Ve 25 reliquias distintas.',
    category: 'coleccionista',
    cond: { key: 'lifetime.relicsSeen', gte: 25 },
  },
  {
    id: 'ach.catalogo',
    name: 'Catalogo',
    desc: 'Ve 50 reliquias distintas.',
    category: 'coleccionista',
    cond: { key: 'lifetime.relicsSeen', gte: 50 },
  },
  {
    id: 'ach.archivero',
    name: 'Archivero',
    desc: 'Ve 90 reliquias distintas.',
    category: 'coleccionista',
    cond: { key: 'lifetime.relicsSeen', gte: 90 },
  },
  {
    id: 'ach.cazador',
    name: 'Cazador',
    desc: 'Vence 12 jefes/elites distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.bossesDefeated', gte: 12 },
  },
  {
    id: 'ach.bestiario',
    name: 'Bestiario',
    desc: 'Vence 26 jefes/elites distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.bossesDefeated', gte: 26 },
  },
  {
    id: 'ach.viajero',
    name: 'Viajero',
    desc: 'Resuelve 20 eventos distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.eventsResolved', gte: 20 },
  },
  {
    id: 'ach.erudito',
    name: 'Erudito',
    desc: 'Resuelve 40 eventos distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.eventsResolved', gte: 40 },
  },
  {
    id: 'ach.fortuna',
    name: 'Fortuna',
    desc: 'Acumula 5.000 de oro entre runs.',
    category: 'coleccionista',
    cond: { key: 'lifetime.goldEarned', gte: 5000 },
  },
  {
    id: 'ach.tesorero',
    name: 'Tesorero',
    desc: 'Acumula 25.000 de oro entre runs.',
    category: 'coleccionista',
    cond: { key: 'lifetime.goldEarned', gte: 25000 },
  },
];

// ---- Secretos / raros ----
const SECRETOS: A[] = [
  {
    id: 'ach.la_bestia_interior',
    name: 'La Bestia Interior',
    desc: 'Gana usando 25 descartes en un combate.',
    category: 'secreto',
    secret: true,
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.maxDiscardsUsed', gte: 25 },
      ],
    },
  },
  {
    id: 'ach.santo',
    name: 'Santo',
    desc: 'Gana una run sin que la Cordura baje de 100.',
    category: 'secreto',
    secret: true,
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.minSanity', gte: 100 },
      ],
    },
  },
  {
    id: 'ach.asceta',
    name: 'Asceta',
    desc: 'Gana sin comprar reliquias (0 reliquias al final).',
    category: 'secreto',
    secret: true,
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.relicCount', lte: 1 },
      ],
    },
  },
  {
    id: 'ach.el_huesped',
    name: 'El Huesped',
    desc: 'Despierta al jefe secreto.',
    category: 'secreto',
    secret: true,
    cond: {
      all: [
        { key: 'run.won', eq: 1 },
        { key: 'run.candlesLost', lte: 0 },
      ],
    },
  },
];

// Escaleras generadas para densificar el catalogo (Velo por Recipiente: 36 logros).
const VEIL_LADDER: A[] = VESSELS.flatMap((v) =>
  [5, 10, 15, 18, 20].map(
    (lvl): A => ({
      id: `ach.veil.${v.id}.${lvl}`,
      name: `Velo ${lvl}: ${v.name}`,
      desc: `Supera el Velo ${lvl} con ${v.name}.`,
      category: 'progreso',
      cond: { key: `veilCleared.${v.id}`, gte: lvl },
    }),
  ),
);

// Maratones de victorias (5).
const WIN_LADDER: A[] = [10, 50, 100].map(
  (n): A => ({
    id: `ach.wins.${n}`,
    name: `${n} Victorias`,
    desc: `Gana ${n} runs en total.`,
    category: 'progreso',
    cond: { key: 'lifetime.runsWon', gte: n },
  }),
);

// Hitos extra para redondear el catalogo a ~100.
const EXTRA: A[] = [
  {
    id: 'ach.depth.12',
    name: 'Decimosegundo',
    desc: 'Alcanza el Umbral 12.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 12 },
  },
  {
    id: 'ach.depth.30',
    name: 'El Pozo sin Fin',
    desc: 'Alcanza el Umbral 30.',
    category: 'profundidad',
    cond: { key: 'lifetime.maxDepth', gte: 30 },
  },
  {
    id: 'ach.relics.10',
    name: 'Curioso',
    desc: 'Ve 10 reliquias distintas.',
    category: 'coleccionista',
    cond: { key: 'lifetime.relicsSeen', gte: 10 },
  },
  {
    id: 'ach.bosses.3',
    name: 'Matagigantes',
    desc: 'Vence 3 jefes/elites distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.bossesDefeated', gte: 3 },
  },
  {
    id: 'ach.events.5',
    name: 'Encrucijada',
    desc: 'Resuelve 5 eventos distintos.',
    category: 'coleccionista',
    cond: { key: 'lifetime.eventsResolved', gte: 5 },
  },
  {
    id: 'ach.veil.any.20',
    name: 'Sello del Abismo',
    desc: 'Supera el Velo 20.',
    category: 'progreso',
    cond: { key: 'lifetime.maxVeil', gte: 20 },
  },
  {
    id: 'ach.veil.any.13',
    name: 'Eleccion Cruel',
    desc: 'Supera el Velo 13.',
    category: 'progreso',
    cond: { key: 'lifetime.maxVeil', gte: 13 },
  },
  {
    id: 'ach.score.run.500k',
    name: 'Run de Cifras',
    desc: 'Una mano de 250.000+.',
    category: 'puntuacion',
    cond: { key: 'lifetime.bestHandScore', gte: 250000 },
  },
  {
    id: 'ach.gold.peak.2k',
    name: 'Avaricia',
    desc: 'Ten 2.000 de oro a la vez.',
    category: 'builds',
    cond: { key: 'run.goldPeak', gte: 2000 },
  },
  {
    id: 'ach.two_clears',
    name: 'Polifacetico',
    desc: 'Gana con 3 Recipientes distintos.',
    category: 'progreso',
    cond: { key: 'lifetime.vesselsWon', gte: 3 },
  },
  {
    id: 'ach.depth.8.first',
    name: 'Tocar Fondo',
    desc: 'Alcanza el Umbral 8.',
    category: 'progreso',
    cond: { key: 'lifetime.maxDepth', gte: 8 },
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  ...PROGRESO,
  ...PUNTUACION,
  ...BUILDS,
  ...RIESGO,
  ...PROFUNDIDAD,
  ...COLECCIONISTA,
  ...SECRETOS,
  ...VEIL_LADDER,
  ...WIN_LADDER,
  ...EXTRA,
];
