// Tienda (§11.10): inventario generado por seed (stream de tienda), ponderado por Sima.
import { nextInt, type RngState } from '@umbral/shared';
import type { ShopItem, ShopState } from '../types';
import type { ConsumableDef, ContentRegistry, VoucherDef } from './dsl';
import { pickRelicRewards } from './pool';

function consumableCost(c: ConsumableDef): number {
  if (c.kind === 'conjuro') return 7;
  if (c.kind === 'sello') return 5;
  return 4; // augurio
}

function withDiscount(base: number, discount: number): number {
  return Math.max(1, Math.round(base * (1 - discount)));
}

/** Descuentos agregados de los vales activos (Mercader, Reroll). */
export function voucherShopMods(
  vouchers: readonly string[],
  registry: ContentRegistry,
): { shopDiscount: number; rerollDiscount: number; extraItems: number } {
  let shopDiscount = 0;
  let rerollDiscount = 0;
  let extraItems = 0;
  for (const id of vouchers) {
    const e = registry.vouchers[id]?.effect;
    if (!e) continue;
    shopDiscount += e.shopDiscount ?? 0;
    rerollDiscount += e.rerollDiscount ?? 0;
    if (e.flags?.includes('abundancia')) extraItems += 1;
  }
  return { shopDiscount: Math.min(0.6, shopDiscount), rerollDiscount, extraItems };
}

export interface ShopGenOpts {
  sima: number;
  ownedRelicIds: Set<string>;
  ownedVoucherIds: Set<string>;
  shopDiscount: number;
  rerollDiscount: number;
  extraItems: number;
}

/** Genera el inventario de la tienda. Muta el RngState (stream de tienda). */
export function generateShop(
  registry: ContentRegistry,
  rng: RngState,
  opts: ShopGenOpts,
): ShopState {
  const items: ShopItem[] = [];
  let counter = 0;
  const mkId = () => `shop_${counter++}`;

  const relicCount = 2 + opts.extraItems;
  for (const pick of pickRelicRewards(registry, rng, opts.sima, relicCount, opts.ownedRelicIds)) {
    const def = registry.relics[pick.id];
    if (def) {
      items.push({
        id: mkId(),
        kind: 'relic',
        cost: withDiscount(def.cost, opts.shopDiscount),
        payloadId: pick.id,
      });
    }
  }

  const consumables = Object.values(registry.consumables);
  for (let i = 0; i < 2 && consumables.length > 0; i++) {
    const c = consumables[nextInt(rng, 0, consumables.length - 1)];
    if (c) {
      items.push({
        id: mkId(),
        kind: 'arcano',
        cost: withDiscount(consumableCost(c), opts.shopDiscount),
        payloadId: c.id,
      });
    }
  }

  const vouchers = Object.values(registry.vouchers).filter(
    (v: VoucherDef) => !opts.ownedVoucherIds.has(v.id),
  );
  if (vouchers.length > 0) {
    const v = vouchers[nextInt(rng, 0, vouchers.length - 1)];
    if (v) {
      items.push({
        id: mkId(),
        kind: 'vale',
        cost: withDiscount(v.cost, opts.shopDiscount),
        payloadId: v.id,
      });
    }
  }

  return { items, rerollCost: Math.max(1, 5 - opts.rerollDiscount), rerollsThisVisit: 0 };
}
