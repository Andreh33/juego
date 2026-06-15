// Pool de recompensas: elige reliquias reales del registry por rareza, escalada por Sima (§9.7).
// Excluye las ya poseidas y las exclusivas de Recipiente (Bloque 8). Pity basico (§2.2) opcional.
import { nextInt, pickWeighted, type Rarity, type RngState } from '@umbral/shared';
import type { ContentRegistry, RelicDef } from './dsl';

const RARITY_WEIGHTS: Record<number, Record<Rarity, number>> = {
  1: { comun: 60, pococomun: 28, rara: 10, espectral: 1, maldita: 1, legendaria: 0 },
  2: { comun: 45, pococomun: 32, rara: 16, espectral: 3, maldita: 3, legendaria: 1 },
  3: { comun: 30, pococomun: 32, rara: 24, espectral: 6, maldita: 5, legendaria: 3 },
  4: { comun: 20, pococomun: 28, rara: 30, espectral: 10, maldita: 7, legendaria: 5 },
};

const RARITIES: Rarity[] = ['comun', 'pococomun', 'rara', 'espectral', 'maldita', 'legendaria'];

export interface RewardPick {
  id: string;
  kind: 'relic';
}

/** Elige `count` reliquias distintas del pool por rareza ponderada (Sima 1-4). Muta rng. */
export function pickRelicRewards(
  registry: ContentRegistry,
  rng: RngState,
  sima: number,
  count: number,
  ownedIds: Set<string>,
): RewardPick[] {
  const byRarity = new Map<Rarity, RelicDef[]>();
  for (const def of Object.values(registry.relics)) {
    if (def.vessel || ownedIds.has(def.id)) continue; // exclusivas de Recipiente -> Bloque 8
    const g = byRarity.get(def.rarity) ?? [];
    g.push(def);
    byRarity.set(def.rarity, g);
  }
  const weights = RARITY_WEIGHTS[Math.min(4, Math.max(1, sima))] ?? RARITY_WEIGHTS[1];
  if (!weights) return [];

  const used = new Set<string>();
  const picks: RewardPick[] = [];
  for (let i = 0; i < count; i++) {
    const rarities = RARITIES.filter(
      (r) => weights[r] > 0 && (byRarity.get(r) ?? []).some((x) => !used.has(x.id)),
    );
    if (rarities.length === 0) break;
    const rarity = pickWeighted(
      rng,
      rarities,
      rarities.map((r) => weights[r]),
    );
    const candidates = (byRarity.get(rarity) ?? []).filter((x) => !used.has(x.id));
    const choice = candidates[nextInt(rng, 0, candidates.length - 1)];
    if (choice) {
      used.add(choice.id);
      picks.push({ id: choice.id, kind: 'relic' });
    }
  }
  return picks;
}
