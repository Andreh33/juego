// Cosmeticos (§12.2): dorsos de carta, paletas de orla, marcos. Puramente esteticos,
// ganados en hitos. Se modelan como UnlockDef de kind 'cosmetico' (se conceden por el
// mismo motor de progresion). El render los consume en bloques de feel.
import type { UnlockDef } from '@umbral/engine';

type CosmeticKind = 'dorso' | 'orla' | 'marco';
type Cosmetic = {
  id: string;
  name: string;
  cos: CosmeticKind;
  desc: string;
  cond: UnlockDef['cond'];
};

const COSMETICS_RAW: Cosmetic[] = [
  {
    id: 'cos.dorso.ceniza',
    name: 'Dorso de Ceniza',
    cos: 'dorso',
    desc: 'Gana tu primera run.',
    cond: { key: 'lifetime.runsWon', gte: 1 },
  },
  {
    id: 'cos.dorso.oro',
    name: 'Dorso de Oro',
    cos: 'dorso',
    desc: 'Acumula 10.000 de oro.',
    cond: { key: 'lifetime.goldEarned', gte: 10000 },
  },
  {
    id: 'cos.dorso.abismo',
    name: 'Dorso del Abismo',
    cos: 'dorso',
    desc: 'Alcanza el Umbral 15.',
    cond: { key: 'lifetime.maxDepth', gte: 15 },
  },
  {
    id: 'cos.orla.checkpoint10',
    name: 'Orla del Velo 10',
    cos: 'orla',
    desc: 'Supera el Velo 10.',
    cond: { key: 'lifetime.maxVeil', gte: 10 },
  },
  {
    id: 'cos.orla.maestria',
    name: 'Orla de Maestria',
    cos: 'orla',
    desc: 'Conquista el Velo 20.',
    cond: { key: 'lifetime.veil20Count', gte: 1 },
  },
  {
    id: 'cos.orla.leyenda',
    name: 'Orla de Leyenda',
    cos: 'orla',
    desc: 'Velo 20 con los 6 Recipientes.',
    cond: { key: 'lifetime.veil20Count', gte: 6 },
  },
  {
    id: 'cos.marco.coleccionista',
    name: 'Marco del Coleccionista',
    cos: 'marco',
    desc: 'Ve 90 reliquias.',
    cond: { key: 'lifetime.relicsSeen', gte: 90 },
  },
  {
    id: 'cos.marco.bestiario',
    name: 'Marco del Bestiario',
    cos: 'marco',
    desc: 'Vence los 26 jefes/elites.',
    cond: { key: 'lifetime.bossesDefeated', gte: 26 },
  },
  {
    id: 'cos.marco.millon',
    name: 'Marco del Millon',
    cos: 'marco',
    desc: 'Una mano de 1.000.000+.',
    cond: { key: 'lifetime.bestHandScore', gte: 1000000 },
  },
];

export const COSMETICS: UnlockDef[] = COSMETICS_RAW.map((c) => ({
  id: c.id,
  name: c.name,
  desc: c.desc,
  kind: 'cosmetico' as const,
  payload: `${c.cos}:${c.id}`,
  cond: c.cond,
}));
