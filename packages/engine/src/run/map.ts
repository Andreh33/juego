// Generacion determinista del mapa de un Umbral (§9.2): grafo por capas que converge en el Jefe.
import { type NodeType, nextInt, pickN, pickWeighted, type RngState } from '@umbral/shared';
import type { MapNode, UmbralMap } from '../types';
import { objectiveFor } from './objectives';

type ContentType = Exclude<NodeType, 'jefe'>;

// Pesos base (§9.2). El Jefe va en la fila final, aparte.
const CONTENT_WEIGHTS: Record<ContentType, number> = {
  combate: 40,
  elite: 12,
  tienda: 12,
  evento: 16,
  tesoro: 7,
  descanso: 6,
  santuario: 4,
};
const CONTENT_TYPES = Object.keys(CONTENT_WEIGHTS) as ContentType[];

// Tipos "de alivio" en la fila previa al Jefe (§9.2).
const PRE_BOSS_TYPES: NodeType[] = ['descanso', 'tienda', 'santuario'];
const PRE_BOSS_WEIGHTS = [6, 12, 4];

function pickContentType(rng: RngState, allowElite: boolean): NodeType {
  const items = CONTENT_TYPES.filter((t) => allowElite || t !== 'elite');
  const weights = items.map((t) => CONTENT_WEIGHTS[t]);
  return pickWeighted(rng, items, weights);
}

function assignTypes(rows: MapNode[][], contentRows: number, rng: RngState): void {
  for (let r = 0; r < contentRows; r++) {
    const row = rows[r];
    if (!row) continue;
    const isPreBoss = r === contentRows - 1;
    for (const node of row) {
      node.type = isPreBoss
        ? pickWeighted(rng, PRE_BOSS_TYPES, PRE_BOSS_WEIGHTS)
        : pickContentType(rng, r >= 1); // Elite a partir de la fila 2 (indice 1)
    }
  }
  // Nunca dos Tiendas seguidas en un mismo camino (§9.2).
  for (let r = 1; r < contentRows; r++) {
    const prev = rows[r - 1];
    const row = rows[r];
    if (!prev || !row) continue;
    for (const node of row) {
      if (node.type !== 'tienda') continue;
      if (prev.some((p) => p.type === 'tienda' && p.next.includes(node.id))) node.type = 'combate';
    }
  }
  ensureType(rows, contentRows, 'elite', rng);
  ensureType(rows, contentRows, 'tienda', rng);
}

/** Garantiza que exista al menos un nodo del tipo dado (convirtiendo un combate si falta). */
function ensureType(rows: MapNode[][], contentRows: number, type: NodeType, rng: RngState): void {
  const exists = rows.slice(0, contentRows).some((row) => row.some((n) => n.type === type));
  if (exists) return;
  const minRow = type === 'elite' ? 1 : 0;
  const candidates: MapNode[] = [];
  for (let r = minRow; r < contentRows; r++) {
    const row = rows[r];
    if (row) for (const n of row) if (n.type === 'combate') candidates.push(n);
  }
  const pick = candidates[nextInt(rng, 0, Math.max(0, candidates.length - 1))];
  if (pick) pick.type = type;
}

/** Genera el mapa del Umbral. Muta el RngState recibido (stream del mapa). */
export function generateUmbralMap(umbral: number, rng: RngState): UmbralMap {
  const contentRows = nextInt(rng, 4, 6);
  const rows: MapNode[][] = [];
  let counter = 0;

  for (let r = 0; r < contentRows; r++) {
    const count = r === 0 ? nextInt(rng, 2, 3) : nextInt(rng, 2, 4);
    const row: MapNode[] = [];
    for (let i = 0; i < count; i++) {
      row.push({
        id: `u${umbral}_n${counter++}`,
        type: 'combate',
        row: r,
        next: [],
        visited: false,
      });
    }
    rows.push(row);
  }
  const boss: MapNode = {
    id: `u${umbral}_boss`,
    type: 'jefe',
    row: contentRows,
    next: [],
    visited: false,
  };
  rows.push([boss]);

  // Aristas: cada nodo conecta a 1-3 de la fila siguiente; cada destino con >=1 entrante.
  for (let r = 0; r < contentRows; r++) {
    const cur = rows[r];
    const nxt = rows[r + 1];
    if (!cur || !nxt) continue;
    for (const node of cur) {
      const k = Math.min(nxt.length, nextInt(rng, 1, 3));
      node.next = pickN(rng, nxt, k).map((t) => t.id);
    }
    for (const target of nxt) {
      if (cur.some((n) => n.next.includes(target.id))) continue;
      const parent = cur[nextInt(rng, 0, cur.length - 1)];
      if (parent && !parent.next.includes(target.id)) parent.next.push(target.id);
    }
  }

  assignTypes(rows, contentRows, rng);

  for (const row of rows) {
    for (const node of row) {
      if (node.type === 'combate' || node.type === 'elite' || node.type === 'jefe') {
        node.objective = objectiveFor(umbral, node.type, rng);
      }
    }
  }

  return { umbral, nodes: rows.flat(), currentNodeId: null };
}
