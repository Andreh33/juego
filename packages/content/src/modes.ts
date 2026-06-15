// Modos (§12.5-§12.8): semillas diaria/semanal deterministas, mutadores semanales y desafios.
import type { RunModifiers } from '@umbral/engine';
import type { VesselId } from '@umbral/shared';

const VESSEL_ORDER: VesselId[] = [
  'heraldo',
  'vidente',
  'usurero',
  'coleccionista',
  'bestia',
  'profano',
];
const CUM_MONTH_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Numero de dia deterministico desde una fecha ISO (YYYY-MM-DD). Monotono; sirve para bucketing. */
function dayNumber(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map((x) => Number.parseInt(x, 10));
  const year = y ?? 2026;
  const month = m ?? 1;
  const day = d ?? 1;
  return year * 365 + Math.floor(year / 4) + (CUM_MONTH_DAYS[month - 1] ?? 0) + day;
}

/** Semilla diaria (igual para todos los amigos, §12.5). */
export function dailySeed(dateISO: string): string {
  return `umbral-diario-${dateISO}`;
}

/** Recipiente fijo del dia (rota). */
export function dailyVessel(dateISO: string): VesselId {
  return VESSEL_ORDER[dayNumber(dateISO) % VESSEL_ORDER.length] ?? 'heraldo';
}

/** Id de la semana (bucket de 7 dias). */
export function weeklyId(dateISO: string): string {
  return `W${Math.floor(dayNumber(dateISO) / 7)}`;
}

/** Semilla semanal. */
export function weeklySeed(week: string): string {
  return `umbral-semanal-${week}`;
}

const WEEKLY_MUTATORS = [
  'un_palo',
  'tres_malditas',
  'mano_pequena',
  'sin_descartes',
  'todo_espejo',
  'cordura_baja',
];

/** Mutador de la semana (deterministico por week id). */
export function weeklyMutator(week: string): string {
  const n = Number.parseInt(week.replace('W', ''), 10) || 0;
  return WEEKLY_MUTATORS[n % WEEKLY_MUTATORS.length] ?? 'un_palo';
}

export interface ChallengeDef {
  id: string;
  name: string;
  desc: string;
  vessel: VesselId;
  modifiers: RunModifiers;
}

const BASE_CHALLENGES: ChallengeDef[] = [
  {
    id: 'desafio.manos_de_hierro',
    name: 'Manos de Hierro',
    desc: 'Solo 1 mano por combate; descartes infinitos.',
    vessel: 'heraldo',
    modifiers: { hands: 1, discards: 99 },
  },
  {
    id: 'desafio.el_avaro',
    name: 'El Avaro',
    desc: 'Empiezas con 200 oro.',
    vessel: 'usurero',
    modifiers: { startingGold: 200 },
  },
  {
    id: 'desafio.mazo_minimo',
    name: 'Mazo Minimo',
    desc: 'Empiezas con 20 cartas.',
    vessel: 'heraldo',
    modifiers: { deckSize: 20 },
  },
  {
    id: 'desafio.sin_tienda',
    name: 'Sin Tienda',
    desc: 'No hay tiendas, solo recompensas.',
    vessel: 'heraldo',
    modifiers: { flags: ['noShop'] },
  },
  {
    id: 'desafio.todo_maldito',
    name: 'Todo Maldito',
    desc: 'Todas las reliquias del pool son Malditas.',
    vessel: 'profano',
    modifiers: { flags: ['todoMaldito'] },
  },
  {
    id: 'desafio.cordura_cero',
    name: 'Cordura Cero',
    desc: 'Empiezas con Cordura 1.',
    vessel: 'profano',
    modifiers: { startingSanity: 1 },
  },
  {
    id: 'desafio.un_palo',
    name: 'Un Palo',
    desc: 'El mazo es de un solo palo.',
    vessel: 'coleccionista',
    modifiers: { flags: ['unPalo'] },
  },
  {
    id: 'desafio.escalera_o_muerte',
    name: 'Escalera o Muerte',
    desc: 'Solo puntuan Escaleras.',
    vessel: 'heraldo',
    modifiers: { flags: ['soloEscaleras'] },
  },
  {
    id: 'desafio.velocidad',
    name: 'Velocidad',
    desc: 'Temporizador por mano.',
    vessel: 'bestia',
    modifiers: { flags: ['timer'] },
  },
  {
    id: 'desafio.espejo',
    name: 'Espejo',
    desc: 'Todas tus cartas son Espejo.',
    vessel: 'coleccionista',
    modifiers: { flags: ['todoEspejo'] },
  },
];

// Variantes 11-20: combinaciones que fuerzan builds extremas.
const VARIANT_CHALLENGES: ChallengeDef[] = Array.from({ length: 10 }, (_, i): ChallengeDef => {
  const vessel = VESSEL_ORDER[i % VESSEL_ORDER.length] ?? 'heraldo';
  return {
    id: `desafio.variante_${i + 1}`,
    name: `Mutador ${i + 1}`,
    desc: 'Reglas alteradas: recursos ajustados.',
    vessel,
    modifiers: {
      hands: 3 + (i % 3),
      discards: 1 + (i % 4),
      handSize: 7 + (i % 3),
      startingSanity: 60 + (i % 5) * 8,
    },
  };
});

export const CHALLENGES: ChallengeDef[] = [...BASE_CHALLENGES, ...VARIANT_CHALLENGES];
