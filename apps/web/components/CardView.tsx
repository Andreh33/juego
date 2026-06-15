'use client';
import type { Card } from '@umbral/shared';
import { rankLabel, SUIT_COLOR, SUIT_GLYPH } from '../lib/display';

const ENH_BADGE: Record<string, string> = {
  grabado: 'Gr',
  marca: 'Ma',
  untado: 'Un',
  dorado: 'Do',
  cristal: 'Cr',
  piedra: 'Pi',
  espejo: 'Es',
};
const SEAL_DOT: Record<string, string> = {
  ocre: 'bg-umbral-ocre',
  sangre: 'bg-umbral-sangre',
  verdin: 'bg-umbral-verdin',
  violeta: 'bg-umbral-violeta',
  dorado: 'bg-umbral-ocre-alto',
};

export function CardView({
  card,
  selected = false,
  onClick,
  disabled = false,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const suitColor = card.suit ? SUIT_COLOR[card.suit] : 'text-umbral-ceniza';
  const glyph = card.suit ? SUIT_GLYPH[card.suit] : '■';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={[
        'relative flex h-28 w-20 flex-col items-center justify-between rounded-lg border p-2 transition-all',
        'bg-gradient-to-b from-umbral-pergamino to-umbral-tinta shadow-lg',
        selected
          ? '-translate-y-3 border-umbral-ocre-alto ring-2 ring-umbral-ocre-alto/60'
          : 'border-umbral-ceniza/30 hover:-translate-y-1 hover:border-umbral-ocre/60',
        disabled && !selected ? 'cursor-default opacity-80' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className={`self-start text-lg font-bold ${suitColor}`}>{rankLabel(card.rank)}</span>
      <span className={`text-3xl ${suitColor}`}>{glyph}</span>
      <span className="flex w-full items-center justify-between">
        {card.enhancement ? (
          <span className="rounded bg-umbral-ocre/20 px-1 text-[10px] text-umbral-ocre-alto">
            {ENH_BADGE[card.enhancement] ?? '?'}
          </span>
        ) : (
          <span />
        )}
        {card.seal ? (
          <span
            className={`h-2.5 w-2.5 rounded-full ${SEAL_DOT[card.seal] ?? 'bg-umbral-ceniza'}`}
          />
        ) : null}
      </span>
    </button>
  );
}
