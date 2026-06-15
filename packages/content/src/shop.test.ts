import { type GameState, generateShop, reduce, startRun } from '@umbral/engine';
import { createRngState } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import { CONSUMABLES, REGISTRY, VOUCHERS } from './index';

const START = { type: 'START_RUN', seed: 'shop', vessel: 'heraldo', ruleset: 1 } as const;

function newRun(): GameState {
  return startRun(START, REGISTRY);
}

function withConsumable(s: GameState, defId: string): GameState {
  return { ...s, consumables: [{ defId }] };
}

describe('catalogo de arcanos y vales (§11.2-§11.5)', () => {
  it('hay augurios, sellos, conjuros y 15 vales', () => {
    expect(CONSUMABLES.some((c) => c.kind === 'augurio')).toBe(true);
    expect(CONSUMABLES.some((c) => c.kind === 'sello')).toBe(true);
    expect(CONSUMABLES.some((c) => c.kind === 'conjuro')).toBe(true);
    expect(VOUCHERS).toHaveLength(15);
    expect(new Set(CONSUMABLES.map((c) => c.id)).size).toBe(CONSUMABLES.length);
  });
});

describe('generateShop (§11.10)', () => {
  it('genera reliquias, arcanos y un vale con coste', () => {
    const shop = generateShop(REGISTRY, createRngState('inv'), {
      sima: 1,
      ownedRelicIds: new Set(),
      ownedVoucherIds: new Set(),
      shopDiscount: 0,
      rerollDiscount: 0,
      extraItems: 0,
    });
    expect(shop.items.length).toBeGreaterThanOrEqual(4);
    expect(shop.items.some((i) => i.kind === 'relic')).toBe(true);
    expect(shop.items.some((i) => i.kind === 'arcano')).toBe(true);
    for (const item of shop.items) expect(item.cost).toBeGreaterThan(0);
  });

  it('el descuento de Mercader abarata', () => {
    const opts = {
      sima: 1,
      ownedRelicIds: new Set<string>(),
      ownedVoucherIds: new Set<string>(),
      rerollDiscount: 0,
      extraItems: 0,
    };
    const full = generateShop(REGISTRY, createRngState('d'), { ...opts, shopDiscount: 0 });
    const disc = generateShop(REGISTRY, createRngState('d'), { ...opts, shopDiscount: 0.15 });
    const sum = (s: typeof full) => s.items.reduce((a, i) => a + i.cost, 0);
    expect(sum(disc)).toBeLessThan(sum(full));
  });
});

describe('flujo de tienda (BUY/SELL/REROLL)', () => {
  it('comprar un vale aplica su efecto permanente', () => {
    const base = newRun();
    const shop = {
      items: [{ id: 'x', kind: 'vale' as const, cost: 5, payloadId: 'vale.reliquia' }],
      rerollCost: 5,
      rerollsThisVisit: 0,
    };
    const s: GameState = { ...base, phase: 'tienda', shop, gold: 100 };
    const after = reduce(s, { type: 'BUY', shopItemId: 'x' }, REGISTRY).state;
    expect(after.vouchers).toContain('vale.reliquia');
    expect(after.relicSlots).toBe(base.relicSlots + 1);
    expect(after.gold).toBe(95);
    expect(after.shop?.items).toHaveLength(0);
  });

  it('comprar sin oro es ilegal', () => {
    const base = newRun();
    const shop = {
      items: [{ id: 'x', kind: 'vale' as const, cost: 50, payloadId: 'vale.mano' }],
      rerollCost: 5,
      rerollsThisVisit: 0,
    };
    const s: GameState = { ...base, phase: 'tienda', shop, gold: 10 };
    const res = reduce(s, { type: 'BUY', shopItemId: 'x' }, REGISTRY);
    expect(res.events[0]?.t).toBe('error');
  });

  it('reroll cuesta oro y sube el coste', () => {
    const base = newRun();
    const shop = generateShop(REGISTRY, createRngState('inv'), {
      sima: 1,
      ownedRelicIds: new Set(),
      ownedVoucherIds: new Set(),
      shopDiscount: 0,
      rerollDiscount: 0,
      extraItems: 0,
    });
    const s: GameState = { ...base, phase: 'tienda', shop, gold: 100 };
    const after = reduce(s, { type: 'REROLL_SHOP' }, REGISTRY).state;
    expect(after.gold).toBe(95); // 100 - 5
    expect(after.shop?.rerollCost).toBe(6);
  });

  it('vender una reliquia devuelve oro', () => {
    const base = newRun(); // Heraldo arranca con Estandarte
    expect(base.relics).toHaveLength(1);
    const after = reduce(
      base,
      { type: 'SELL_RELIC', relicId: 'relic.heraldo.estandarte' },
      REGISTRY,
    ).state;
    expect(after.relics).toHaveLength(0);
    expect(after.gold).toBeGreaterThan(base.gold);
  });
});

describe('augurios y conjuros (USE_CONSUMABLE)', () => {
  it('Augurio del Ascenso sube +1 el rango', () => {
    const s0 = newRun();
    const card = s0.deck[0];
    if (!card || card.rank === null) throw new Error('sin carta');
    const s = reduce(
      withConsumable(s0, 'augurio.ascenso'),
      { type: 'USE_CONSUMABLE', consumableId: 'augurio.ascenso', targets: [card.id] },
      REGISTRY,
    ).state;
    expect(s.deck.find((c) => c.id === card.id)?.rank).toBe(Math.min(14, card.rank + 1));
  });

  it('Augurio del Vacio destruye; del Doble duplica', () => {
    const s0 = newRun();
    const first = s0.deck[0];
    if (!first) throw new Error('sin carta');
    const vac = reduce(
      withConsumable(s0, 'augurio.vacio'),
      { type: 'USE_CONSUMABLE', consumableId: 'augurio.vacio', targets: [first.id] },
      REGISTRY,
    ).state;
    expect(vac.deck).toHaveLength(s0.deck.length - 1);
    const dob = reduce(
      withConsumable(s0, 'augurio.doble'),
      { type: 'USE_CONSUMABLE', consumableId: 'augurio.doble', targets: [first.id] },
      REGISTRY,
    ).state;
    expect(dob.deck).toHaveLength(s0.deck.length + 1);
  });

  it('Conjuro de Sangre baja la Cordura', () => {
    const s0 = newRun();
    const s = reduce(
      withConsumable(s0, 'conjuro.sangre'),
      { type: 'USE_CONSUMABLE', consumableId: 'conjuro.sangre', targets: [] },
      REGISTRY,
    ).state;
    expect(s.sanity).toBe(s0.sanity - 5);
  });

  it('Conjuro del Doble Filo destruye y otorga reliquia espectral', () => {
    const s0 = newRun();
    const s = reduce(
      withConsumable(s0, 'conjuro.doble_filo'),
      { type: 'USE_CONSUMABLE', consumableId: 'conjuro.doble_filo', targets: [] },
      REGISTRY,
    ).state;
    expect(s.deck.length).toBe(s0.deck.length - 1);
    expect(s.relics.length).toBe(s0.relics.length + 1);
  });
});
