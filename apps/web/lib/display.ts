// Helpers de presentacion (solo UI): nombres de contenido, glifos de palo, etiquetas de rango.
import { REGISTRY } from '@umbral/content';
import type { Card, Suit, VesselId } from '@umbral/shared';

export const SUIT_GLYPH: Record<Suit, string> = {
  CALIZ: '☥', // caliz / ankh
  LLAVE: '⚷', // llave (chiron)
  HUESO: '☠', // hueso (calavera)
  OJO: '◉', // ojo
};

export const SUIT_COLOR: Record<Suit, string> = {
  CALIZ: 'text-umbral-verdin',
  LLAVE: 'text-umbral-ocre-alto',
  HUESO: 'text-umbral-hueso',
  OJO: 'text-umbral-violeta',
};

export function rankLabel(rank: number | null): string {
  if (rank === null) return '■'; // Piedra
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

export function cardLabel(c: Card): string {
  if (c.rank === null || c.suit === null) return 'Piedra';
  return `${rankLabel(c.rank)} ${SUIT_GLYPH[c.suit]}`;
}

export const VESSEL_INFO: Record<VesselId, { name: string; tag: string }> = {
  heraldo: { name: 'El Heraldo', tag: 'Equilibrado · manos solidas' },
  vidente: { name: 'El Vidente', tag: 'Adivina y reordena el destino' },
  usurero: { name: 'El Usurero', tag: 'El oro es poder' },
  coleccionista: { name: 'El Coleccionista', tag: 'Mejora cartas, catalogo' },
  bestia: { name: 'La Bestia', tag: 'Frenesi de descartes' },
  profano: { name: 'El Profano', tag: 'Cordura rota = poder' },
};

export function relicName(defId: string): string {
  return REGISTRY.relics[defId]?.name ?? defId;
}
export function relicFlavor(defId: string): string {
  return REGISTRY.relics[defId]?.flavor ?? '';
}
export function consumableName(defId: string): string {
  return REGISTRY.consumables[defId]?.name ?? defId;
}

export const NODE_LABEL: Record<string, string> = {
  combate: 'Combate',
  elite: 'Elite',
  tienda: 'Tienda',
  evento: 'Evento',
  tesoro: 'Tesoro',
  descanso: 'Descanso',
  santuario: 'Santuario',
  jefe: 'Jefe',
};

export const NODE_ICON: Record<string, string> = {
  combate: '⚔', // espadas
  elite: '☠', // calavera
  tienda: '⚖', // balanza
  evento: '❓', // interrogante
  tesoro: '◈', // gema
  descanso: '☽', // luna
  santuario: '⛪', // templo
  jefe: '♛', // reina
};
