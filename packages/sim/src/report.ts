// Agrega muchas runs: win-rate por Velo, distribucion de puntuacion, frecuencia de reliquias
// y deteccion de reliquias "muertas" (nunca vistas) o "rotas" (siempre ganan) (§13.1/§13.6).
import type { ContentRegistry } from '@umbral/engine';
import type { VesselId } from '@umbral/shared';
import { ARCHETYPES, type Policy } from './policy';
import { simulateRun } from './run';

export interface VeilBucket {
  veil: number;
  runs: number;
  wins: number;
  winRate: number;
  /** Objetivo de diseno (§13.2). */
  targetLo: number;
  targetHi: number;
  inTarget: boolean;
  avgDepth: number;
  avgScore: number;
  stalled: number;
}

export interface RelicUsage {
  id: string;
  name: string;
  seen: number;
  wins: number;
  /** Tasa de victoria de las runs que la tuvieron. */
  winRateWhenHeld: number;
}

export interface BalanceReport {
  totalRuns: number;
  stalledRuns: number;
  byVeil: VeilBucket[];
  deadRelics: string[];
  hotRelics: RelicUsage[];
  relicUsage: RelicUsage[];
}

export interface SweepOpts {
  registry: ContentRegistry;
  runsPerCell: number;
  veils: number[];
  vessels: VesselId[];
  policies?: Policy[];
  seedPrefix?: string;
}

/** Objetivo de win-rate por Velo (§13.2), como [lo, hi] en fraccion 0..1. */
export function winRateTarget(veil: number): [number, number] {
  if (veil <= 2) return [0.7, 0.85];
  if (veil <= 5) return [0.55, 0.7];
  if (veil <= 9) return [0.4, 0.55];
  if (veil === 10) return [0.4, 0.5];
  if (veil <= 14) return [0.25, 0.4];
  if (veil <= 17) return [0.15, 0.25];
  if (veil <= 19) return [0.08, 0.15];
  return [0, 0.08];
}

export function runSweep(opts: SweepOpts): BalanceReport {
  const policies = opts.policies ?? ARCHETYPES;
  const seedPrefix = opts.seedPrefix ?? 'sim';
  const perVeil = new Map<
    number,
    { runs: number; wins: number; depth: number; score: number; stalled: number }
  >();
  const usage = new Map<string, { seen: number; wins: number }>();
  let totalRuns = 0;
  let stalledRuns = 0;

  for (const veil of opts.veils) {
    const bucket = { runs: 0, wins: 0, depth: 0, score: 0, stalled: 0 };
    for (const vessel of opts.vessels) {
      for (const policy of policies) {
        for (let i = 0; i < opts.runsPerCell; i++) {
          const seed = `${seedPrefix}-${vessel}-${policy.name}-v${veil}-${i}`;
          const r = simulateRun(opts.registry, { seed, vessel, veil, policy });
          totalRuns++;
          bucket.runs++;
          bucket.depth += r.depth;
          bucket.score += r.score;
          if (r.won) bucket.wins++;
          if (r.stalled) {
            bucket.stalled++;
            stalledRuns++;
          }
          for (const id of r.relicsHeld) {
            const u = usage.get(id) ?? { seen: 0, wins: 0 };
            u.seen++;
            if (r.won) u.wins++;
            usage.set(id, u);
          }
        }
      }
    }
    perVeil.set(veil, bucket);
  }

  const byVeil: VeilBucket[] = [...perVeil.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([veil, b]) => {
      const winRate = b.runs > 0 ? b.wins / b.runs : 0;
      const [targetLo, targetHi] = winRateTarget(veil);
      return {
        veil,
        runs: b.runs,
        wins: b.wins,
        winRate,
        targetLo,
        targetHi,
        inTarget: winRate >= targetLo && winRate <= targetHi,
        avgDepth: b.runs > 0 ? b.depth / b.runs : 0,
        avgScore: b.runs > 0 ? b.score / b.runs : 0,
        stalled: b.stalled,
      };
    });

  const relicUsage: RelicUsage[] = Object.values(opts.registry.relics)
    .map((def) => {
      const u = usage.get(def.id) ?? { seen: 0, wins: 0 };
      return {
        id: def.id,
        name: def.name,
        seen: u.seen,
        wins: u.wins,
        winRateWhenHeld: u.seen > 0 ? u.wins / u.seen : 0,
      };
    })
    .sort((a, b) => b.seen - a.seen);

  const deadRelics = relicUsage.filter((r) => r.seen === 0).map((r) => r.id);
  const hotRelics = relicUsage.filter((r) => r.seen >= 20 && r.winRateWhenHeld >= 0.9);

  return { totalRuns, stalledRuns, byVeil, deadRelics, hotRelics, relicUsage };
}

/** Render de texto del informe (para el CLI y para versionar la salida). */
export function formatReport(rep: BalanceReport): string {
  const lines: string[] = [];
  lines.push(`UMBRAL — informe de balanceo (${rep.totalRuns} runs, ${rep.stalledRuns} atascadas)`);
  lines.push('');
  lines.push('Velo | runs |  win% | objetivo  | ok | prof.med | score.med | atascos');
  lines.push('-----|------|-------|-----------|----|----------|-----------|--------');
  for (const b of rep.byVeil) {
    const wr = (b.winRate * 100).toFixed(0).padStart(4);
    const tgt = `${(b.targetLo * 100).toFixed(0)}-${(b.targetHi * 100).toFixed(0)}%`.padStart(9);
    const ok = b.inTarget ? ' ✓' : ' ✗';
    lines.push(
      `${String(b.veil).padStart(4)} | ${String(b.runs).padStart(4)} | ${wr}% | ${tgt} |${ok} | ` +
        `${b.avgDepth.toFixed(1).padStart(8)} | ${b.avgScore.toFixed(0).padStart(9)} | ${String(b.stalled).padStart(7)}`,
    );
  }
  lines.push('');
  lines.push(`Reliquias muertas (nunca vistas): ${rep.deadRelics.length}`);
  if (rep.deadRelics.length > 0) lines.push(`  ${rep.deadRelics.join(', ')}`);
  lines.push(`Reliquias "rotas" (>=90% victoria con >=20 muestras): ${rep.hotRelics.length}`);
  for (const r of rep.hotRelics) {
    lines.push(`  ${r.id} — ${(r.winRateWhenHeld * 100).toFixed(0)}% (${r.seen})`);
  }
  return lines.join('\n');
}
