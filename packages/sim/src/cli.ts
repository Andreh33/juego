#!/usr/bin/env tsx
// @umbral/sim — CLI de balanceo (§13.1, §19 Bloque 19). Juega miles de runs con politicas
// heuristicas por arquetipo y reporta win-rate por Velo, distribucion de score y reliquias
// muertas/rotas. La salida se versiona (no es un test unitario).
import { REGISTRY } from '@umbral/content';
import type { VesselId } from '@umbral/shared';
import { ARCHETYPES } from './policy';
import { type BalanceReport, formatReport, runSweep } from './report';

const ALL_VESSELS: VesselId[] = [
  'heraldo',
  'vidente',
  'usurero',
  'coleccionista',
  'bestia',
  'profano',
];

function parseArg(name: string, fallback: string): string {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : fallback;
}

function main(): void {
  const runs = Math.max(1, Number.parseInt(parseArg('runs', '8'), 10) || 8);
  const veils = parseArg('veils', '0,3,6,10,15,20')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  const vessels = parseArg('vessels', ALL_VESSELS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is VesselId => (ALL_VESSELS as string[]).includes(s));
  const asJson = process.argv.includes('--json');

  const rep: BalanceReport = runSweep({
    registry: REGISTRY,
    runsPerCell: runs,
    veils,
    vessels,
    policies: ARCHETYPES,
  });

  if (asJson) {
    console.log(JSON.stringify(rep, null, 2));
  } else {
    console.log(formatReport(rep));
  }
}

main();
