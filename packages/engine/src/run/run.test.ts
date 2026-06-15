import { createRngState } from '@umbral/shared';
import { describe, expect, it } from 'vitest';
import type { MapNode, UmbralMap } from '../types';
import { bonoMultCordura, bossObjectiveFactor, corduraState } from './cordura';
import { combatGoldReward, interest, SKIP_REWARD_GOLD } from './economy';
import { generateUmbralMap } from './map';
import { baseObjective, objectiveFor } from './objectives';

function gen(seed: string, umbral = 1): UmbralMap {
  return generateUmbralMap(umbral, createRngState(seed));
}

function nodeById(map: UmbralMap, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

function reaches(map: UmbralMap, from: MapNode, targetId: string): boolean {
  if (from.id === targetId) return true;
  return from.next.some((id) => {
    const n = nodeById(map, id);
    return n ? reaches(map, n, targetId) : false;
  });
}

describe('generacion de mapa (§9.2)', () => {
  it('es determinista: misma seed -> mismo mapa', () => {
    expect(gen('mapa-1')).toEqual(gen('mapa-1'));
  });

  it('hay exactamente un jefe, en la fila final', () => {
    const map = gen('mapa-2');
    const bosses = map.nodes.filter((n) => n.type === 'jefe');
    expect(bosses).toHaveLength(1);
    const maxRow = Math.max(...map.nodes.map((n) => n.row));
    expect(bosses[0]?.row).toBe(maxRow);
  });

  it('todos los nodos pueden alcanzar al jefe', () => {
    const map = gen('mapa-3');
    const boss = map.nodes.find((n) => n.type === 'jefe');
    expect(boss).toBeDefined();
    if (!boss) return;
    for (const n of map.nodes) {
      expect(reaches(map, n, boss.id)).toBe(true);
    }
  });

  it('garantiza al menos una tienda y una elite accesibles', () => {
    for (const seed of ['mapa-a', 'mapa-b', 'mapa-c', 'mapa-d']) {
      const map = gen(seed);
      expect(map.nodes.some((n) => n.type === 'tienda')).toBe(true);
      expect(map.nodes.some((n) => n.type === 'elite')).toBe(true);
    }
  });

  it('no hay elite en la fila 0 y la fila previa al jefe es de alivio', () => {
    const map = gen('mapa-e');
    expect(map.nodes.filter((n) => n.row === 0).every((n) => n.type !== 'elite')).toBe(true);
    const maxRow = Math.max(...map.nodes.map((n) => n.row));
    const preBoss = map.nodes.filter((n) => n.row === maxRow - 1);
    expect(preBoss.every((n) => ['descanso', 'tienda', 'santuario'].includes(n.type))).toBe(true);
  });

  it('nunca dos tiendas seguidas en un camino', () => {
    for (const seed of ['x1', 'x2', 'x3', 'x4', 'x5']) {
      const map = gen(seed);
      for (const a of map.nodes) {
        if (a.type !== 'tienda') continue;
        for (const id of a.next) {
          expect(nodeById(map, id)?.type).not.toBe('tienda');
        }
      }
    }
  });

  it('los combates/elites/jefe tienen objetivo asignado', () => {
    const map = gen('mapa-obj');
    for (const n of map.nodes) {
      if (n.type === 'combate' || n.type === 'elite' || n.type === 'jefe') {
        expect(n.objective).toBeGreaterThan(0);
      }
    }
  });
});

describe('objetivos (§9.3)', () => {
  it('tabla base por Umbral', () => {
    expect(baseObjective(1, 'combate')).toBe(300);
    expect(baseObjective(1, 'jefe')).toBe(800);
    expect(baseObjective(8, 'combate')).toBe(100000);
    expect(baseObjective(8, 'jefe')).toBe(230000);
  });

  it('Infinito (>8) escala ~×2 por Umbral', () => {
    expect(baseObjective(9, 'combate')).toBe(200000);
    expect(baseObjective(10, 'combate')).toBe(400000);
  });

  it('varianza determinista dentro de ±5%', () => {
    const v = objectiveFor(1, 'combate', createRngState('obj'));
    expect(v).toBeGreaterThanOrEqual(285); // 300 -5%
    expect(v).toBeLessThanOrEqual(315); // 300 +5%
    expect(objectiveFor(1, 'combate', createRngState('obj'))).toBe(v); // determinista
  });
});

describe('Cordura (§10)', () => {
  it('estados por umbral', () => {
    expect(corduraState(100)).toBe('lucido');
    expect(corduraState(70)).toBe('lucido');
    expect(corduraState(69)).toBe('inquieto');
    expect(corduraState(40)).toBe('inquieto');
    expect(corduraState(39)).toBe('perturbado');
    expect(corduraState(15)).toBe('perturbado');
    expect(corduraState(14)).toBe('al_borde');
    expect(corduraState(1)).toBe('al_borde');
    expect(corduraState(0)).toBe('abismo');
  });

  it('bono de mult = floor((100 - cordura)/10)', () => {
    expect(bonoMultCordura(100)).toBe(0);
    expect(bonoMultCordura(95)).toBe(0);
    expect(bonoMultCordura(50)).toBe(5);
    expect(bonoMultCordura(0)).toBe(10);
  });

  it('factor de objetivo del jefe por Cordura', () => {
    expect(bossObjectiveFactor(100)).toBe(1);
    expect(bossObjectiveFactor(30)).toBeCloseTo(1.1);
    expect(bossObjectiveFactor(10)).toBeCloseTo(1.2);
    expect(bossObjectiveFactor(0)).toBe(1); // abismo: sin penalizacion extra
  });
});

describe('economia (§13.3)', () => {
  it('recompensa de oro por combate', () => {
    expect(combatGoldReward('combate')).toBe(5);
    expect(combatGoldReward('elite')).toBe(8);
    expect(combatGoldReward('jefe')).toBe(12);
    expect(SKIP_REWARD_GOLD).toBe(6);
  });

  it('interes +1 por cada 5, tope 5', () => {
    expect(interest(0)).toBe(0);
    expect(interest(12)).toBe(2);
    expect(interest(25)).toBe(5);
    expect(interest(100)).toBe(5);
  });
});
