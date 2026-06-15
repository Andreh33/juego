// Eventos (§11.9) y Santuarios (§10.5) como DATA. Cada uno: lamina + opciones de riesgo/recompensa.
import type { EventDef } from '@umbral/engine';

const DISTINCTIVE: EventDef[] = [
  {
    id: 'evento.pozo_monedas',
    name: 'El Pozo de Monedas',
    lore: 'Una boca de piedra reclama tu oro.',
    options: [
      {
        id: 'pagar',
        label: 'Pagar 20 oro -> reliquia rara',
        effect: { goldDelta: -20, gainRelicRarity: 'rara' },
      },
      { id: 'irse', label: 'No pagar', effect: {} },
    ],
  },
  {
    id: 'evento.mano_cortada',
    name: 'La Mano Cortada',
    lore: 'Te ofrece quitarte un peso.',
    options: [
      { id: 'depurar', label: 'Destruir 1 carta del mazo', effect: { destroyRandomDeck: 1 } },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
  {
    id: 'evento.mercader_ciego',
    name: 'El Mercader Ciego',
    lore: 'Vende a ciegas. Tu suerte decide.',
    options: [
      {
        id: 'comprar',
        label: 'Pagar 10 -> reliquia oculta',
        effect: { goldDelta: -10, gainRelicRarity: 'pococomun' },
      },
      { id: 'irse', label: 'No comprar', effect: {} },
    ],
  },
  {
    id: 'evento.fuente_negra',
    name: 'La Fuente Negra',
    lore: 'El agua susurra promesas.',
    options: [
      {
        id: 'beber',
        label: 'Beber: -15 Cordura, reliquia espectral',
        effect: { sanityDelta: -15, gainRelicRarity: 'espectral' },
      },
      { id: 'no_beber', label: 'No beber: +10 Cordura', effect: { sanityDelta: 10 } },
    ],
  },
  {
    id: 'evento.tres_cofres',
    name: 'Los Tres Cofres',
    lore: 'Tres cofres. Solo uno.',
    options: [
      { id: 'oro', label: 'Oro', effect: { goldDelta: 25 } },
      { id: 'arcano', label: 'Arcano', effect: { gainConsumableKind: 'augurio' } },
      {
        id: 'riesgo',
        label: 'Riesgo: maldita o legendaria',
        effect: { gainRelicRarity: 'maldita' },
      },
    ],
  },
  {
    id: 'evento.ahorcado',
    name: 'El Ahorcado',
    lore: 'Una vela por un poder mayor.',
    options: [
      {
        id: 'sacrificar',
        label: 'Sacrificar 1 vela -> Legendaria',
        effect: { candleDelta: -1, gainRelicRarity: 'legendaria' },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
  {
    id: 'evento.vagabundo',
    name: 'El Vagabundo',
    lore: 'Marca tus cartas por una limosna.',
    options: [
      {
        id: 'pagar',
        label: 'Dar 15 oro -> 2 sellos',
        effect: { goldDelta: -15, gainConsumableKind: 'sello' },
      },
      { id: 'irse', label: 'Ignorar', effect: {} },
    ],
  },
  {
    id: 'evento.bruja',
    name: 'La Bruja',
    lore: 'Cambia el palo de lo que toca.',
    options: [
      {
        id: 'aceptar',
        label: 'Recibir un Augurio del Cambio',
        effect: { gainConsumableKind: 'augurio' },
      },
      { id: 'irse', label: 'Rehusar', effect: {} },
    ],
  },
  {
    id: 'evento.nino_perdido',
    name: 'El Nino Perdido',
    lore: 'Guialo y algo cambia en ti.',
    options: [
      {
        id: 'guiar',
        label: 'Guiarlo: +1 vela maxima, -10 oro',
        effect: { maxCandleDelta: 1, candleDelta: 1, goldDelta: -10 },
      },
      { id: 'irse', label: 'Dejarlo', effect: {} },
    ],
  },
  {
    id: 'evento.apuesta',
    name: 'La Apuesta',
    lore: 'Par o impar. Todo o nada.',
    options: [
      { id: 'apostar', label: 'Apostar 15 -> +30 (o pierdes)', effect: { goldDelta: 30 } },
      { id: 'no', label: 'No apostar', effect: {} },
    ],
  },
  {
    id: 'evento.confesionario',
    name: 'El Confesionario',
    lore: 'Confiesa un pecado por poder.',
    options: [
      {
        id: 'confesar',
        label: 'Confesar: -8 Cordura, reliquia rara',
        effect: { sanityDelta: -8, gainRelicRarity: 'rara' },
      },
      { id: 'purgar', label: 'Purgar: +12 Cordura', effect: { sanityDelta: 12 } },
    ],
  },
  {
    id: 'evento.relicario',
    name: 'El Relicario',
    lore: 'Elige una reliquia entre tres.',
    options: [
      {
        id: 'tomar',
        label: 'Tomar una reliquia (poco comun)',
        effect: { gainRelicRarity: 'pococomun' },
      },
      { id: 'irse', label: 'Dejarlo', effect: {} },
    ],
  },
  {
    id: 'evento.tumba',
    name: 'La Tumba',
    lore: 'Abrirla tiene precio.',
    options: [
      {
        id: 'abrir',
        label: 'Abrir: reliquia rara, pero destruye 1 carta',
        effect: { gainRelicRarity: 'rara', destroyRandomDeck: 1 },
      },
      { id: 'no', label: 'No tocar', effect: {} },
    ],
  },
  {
    id: 'evento.jardin',
    name: 'El Jardin Equivocado',
    lore: 'Una fruta de efecto incierto.',
    options: [
      {
        id: 'comer',
        label: 'Comer: -5 Cordura, +20 oro',
        effect: { sanityDelta: -5, goldDelta: 20 },
      },
      { id: 'no', label: 'No comer', effect: {} },
    ],
  },
  {
    id: 'evento.cobrador',
    name: 'El Cobrador',
    lore: 'Tus deudas te encuentran.',
    options: [
      { id: 'pagar', label: 'Pagar 20 oro', effect: { goldDelta: -20 } },
      { id: 'maldita', label: 'Aceptar una Maldita', effect: { gainRelicRarity: 'maldita' } },
    ],
  },
  {
    id: 'evento.encrucijada',
    name: 'La Encrucijada',
    lore: 'Tres caminos. Uno solo.',
    options: [
      { id: 'reliquia', label: 'Reliquia poco comun', effect: { gainRelicRarity: 'pococomun' } },
      { id: 'oro', label: '+30 oro', effect: { goldDelta: 30 } },
      { id: 'cordura', label: '+15 Cordura', effect: { sanityDelta: 15 } },
    ],
  },
  {
    id: 'evento.reloj',
    name: 'El Reloj',
    lore: 'Adelanta el tiempo.',
    options: [
      { id: 'avanzar', label: 'Saltar adelante: +12 oro', effect: { goldDelta: 12 } },
      { id: 'no', label: 'Esperar', effect: {} },
    ],
  },
  {
    id: 'evento.altar',
    name: 'El Altar',
    lore: 'Una ofrenda por algo mejor.',
    options: [
      {
        id: 'ofrendar',
        label: 'Ofrendar 15 oro -> reliquia espectral',
        effect: { goldDelta: -15, gainRelicRarity: 'espectral' },
      },
      { id: 'no', label: 'No ofrendar', effect: {} },
    ],
  },
  {
    id: 'evento.espejo',
    name: 'El Espejo',
    lore: 'Refleja lo que mas deseas.',
    options: [
      { id: 'mirar', label: 'Mirar: Conjuro aleatorio', effect: { gainConsumableKind: 'conjuro' } },
      { id: 'romper', label: 'Romperlo: +18 oro', effect: { goldDelta: 18 } },
    ],
  },
  {
    id: 'evento.pacto',
    name: 'El Pacto',
    lore: 'Poder a cambio de cordura.',
    options: [
      {
        id: 'firmar',
        label: 'Firmar: -12 Cordura, reliquia rara',
        effect: { sanityDelta: -12, gainRelicRarity: 'rara' },
      },
      { id: 'no', label: 'No firmar', effect: {} },
    ],
  },
];

// Variantes (21-40, §11.9): encrucijadas/apuestas/altares con numeros distintos.
const VARIANTS: EventDef[] = Array.from({ length: 20 }, (_, i): EventDef => {
  const gold = 10 + i * 2;
  const sanity = 4 + (i % 6);
  return {
    id: `evento.variante_${i + 1}`,
    name: `Encrucijada Menor ${i + 1}`,
    lore: 'Otra decision en el descenso.',
    options: [
      { id: 'oro', label: `+${gold} oro`, effect: { goldDelta: gold } },
      {
        id: 'riesgo',
        label: `-${sanity} Cordura -> arcano`,
        effect: { sanityDelta: -sanity, gainConsumableKind: 'augurio' },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  };
});

const SANTUARIOS: EventDef[] = [
  {
    id: 'santuario.ofrenda',
    name: 'Santuario: Ofrenda',
    lore: 'Sacrifica cordura por poder de abajo.',
    santuario: true,
    options: [
      {
        id: 'ofrendar',
        label: 'Sacrificar 15 Cordura -> reliquia espectral',
        effect: { sanityDelta: -15, gainRelicRarity: 'espectral' },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
  {
    id: 'santuario.purga',
    name: 'Santuario: Purga',
    lore: 'Recupera lo perdido, paga el precio.',
    santuario: true,
    options: [
      {
        id: 'purgar',
        label: 'Pagar 15 oro -> +25 Cordura',
        effect: { goldDelta: -15, sanityDelta: 25 },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
  {
    id: 'santuario.pacto',
    name: 'Santuario: Pacto',
    lore: 'Lo de abajo regatea a lo grande.',
    santuario: true,
    options: [
      {
        id: 'pactar',
        label: 'Cordura a la mitad -> Legendaria',
        effect: { sanityDelta: -50, gainRelicRarity: 'legendaria' },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
  {
    id: 'santuario.calma',
    name: 'Santuario: Calma',
    lore: 'Un momento de paz, raro aqui abajo.',
    santuario: true,
    options: [
      {
        id: 'descansar',
        label: '+1 Cordura maxima y +20 Cordura',
        effect: { maxSanityDelta: 1, sanityDelta: 20 },
      },
      { id: 'irse', label: 'Marcharse', effect: {} },
    ],
  },
];

export const EVENTS: EventDef[] = [...DISTINCTIVE, ...VARIANTS, ...SANTUARIOS];
