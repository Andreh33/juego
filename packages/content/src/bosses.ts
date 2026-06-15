// Los 24 jefes (8 por Sima) + 2 secretos (§11.7) como DATA. Cada uno con su modificador
// mecanico (lo expresable por el engine) + tell + infeccion de orla (render, §6.7).
// Mecanicas no expresables aun (decaimiento, bloqueo de carta, alucinaciones, copia de reliquia,
// fases detalladas) se aproximan con objectiveFactor y se marcan TODO para bloques visuales.
import type { BossDef } from '@umbral/engine';

export const BOSSES: BossDef[] = [
  // ===== SIMA I — El Vestibulo =====
  {
    id: 'boss.velado',
    name: 'El Velado',
    sima: 1,
    lore: 'No tiene cara, pero sabe la tuya.',
    tell: 'Figura de tela que se acerca cada mano.',
    orla: 'Telas que cubren los bordes.',
    modifier: { silenceSuits: ['CALIZ'] },
  }, // TODO: deberia silenciar el 1er palo jugado
  {
    id: 'boss.dentellada',
    name: 'La Dentellada',
    sima: 1,
    lore: 'Cuenta tus dedos.',
    tell: 'Mordiscos crecientes en el marco.',
    orla: 'Dientes.',
    modifier: { handsDelta: -1, figuresHalf: true },
  },
  {
    id: 'boss.polvo',
    name: 'El Polvo',
    sima: 1,
    lore: 'Todo lo que tocas envejece.',
    tell: 'Las cartas se encanecen.',
    orla: 'Ceniza que cae.',
    modifier: { objectiveFactor: 1.05 },
  }, // TODO: decaimiento -5 fichas/carta
  {
    id: 'boss.coro_mudo',
    name: 'El Coro Mudo',
    sima: 1,
    lore: 'Bocas sin sonido.',
    tell: 'Bocas cosidas en la orla.',
    orla: 'Labios sellados.',
    modifier: { discardsDelta: -2 },
  }, // TODO: sin descartar las 2 primeras manos
  {
    id: 'boss.polilla',
    name: 'La Polilla',
    sima: 1,
    lore: 'Come la luz.',
    tell: 'Polillas.',
    orla: 'Alas.',
    modifier: { objectiveFactor: 1.15 },
  },
  {
    id: 'boss.cerrojo',
    name: 'El Cerrojo',
    sima: 1,
    lore: 'Algo quiere quedarse dentro.',
    tell: 'Cadenas.',
    orla: 'Cerraduras.',
    modifier: { objectiveFactor: 1.05 },
  }, // TODO: traba 1 carta/mano
  {
    id: 'boss.vaho',
    name: 'El Vaho',
    sima: 1,
    lore: 'Respira lo que no deberias.',
    tell: 'Niebla verdin.',
    orla: 'Vapor.',
    modifier: { sanityPerHand: 5 },
  },
  {
    id: 'boss.primer_rostro',
    name: 'El Primer Rostro',
    sima: 1,
    lore: 'El que te recibio.',
    tell: 'Una cara tallada que sonrie al fallar.',
    orla: 'Madera agrietada.',
    modifier: { objectiveFactor: 1.25 },
  },

  // ===== SIMA II — Las Galerias =====
  {
    id: 'boss.coro_de_ojos',
    name: 'El Coro de Ojos',
    sima: 2,
    lore: 'Cada decision es observada.',
    tell: 'Ojos que parpadean al unisono.',
    orla: 'Ojos abriendose.',
    modifier: { discardsDelta: -3 },
  }, // TODO: marchitar cartas
  {
    id: 'boss.inundacion',
    name: 'La Inundacion',
    sima: 2,
    lore: 'El agua negra sube.',
    tell: 'Nivel de agua que sube.',
    orla: 'Agua.',
    modifier: { objectiveFactor: 1.1 },
  }, // TODO: +8% por sub-umbral fallido
  {
    id: 'boss.desollado',
    name: 'El Desollado',
    sima: 2,
    lore: 'Sin piel, todo duele.',
    tell: 'Cartas en carne viva.',
    orla: 'Musculo.',
    modifier: { objectiveFactor: 1.1 },
  }, // TODO: mejoras consumibles al jugar
  {
    id: 'boss.archivero',
    name: 'El Archivero',
    sima: 2,
    lore: 'Ya conoce tu jugada.',
    tell: 'Fichero que se abre.',
    orla: 'Papeles.',
    modifier: { objectiveFactor: 1.1 },
  }, // TODO: -50% a la mano mas repetida
  {
    id: 'boss.carcoma',
    name: 'La Carcoma',
    sima: 2,
    lore: 'Devora desde dentro.',
    tell: 'Agujeros.',
    orla: 'Madera comida.',
    modifier: { destroyDeckAtStart: 2 },
  },
  {
    id: 'boss.espejo_roto',
    name: 'El Espejo Roto',
    sima: 2,
    lore: 'Tu reflejo no obedece.',
    tell: 'Grietas de espejo.',
    orla: 'Cristal.',
    modifier: { relicXMultPenalty: 0.5 },
  },
  {
    id: 'boss.hambriento',
    name: 'El Hambriento',
    sima: 2,
    lore: 'Quiere tus monedas.',
    tell: 'Boca enorme.',
    orla: 'Fauces.',
    modifier: { coinsPerHand: 5 },
  },
  {
    id: 'boss.senora_galerias',
    name: 'La Senora de las Galerias',
    sima: 2,
    lore: 'Reina de lo humedo.',
    tell: 'Vestido que llena la pantalla.',
    orla: 'Cardenillo invasor.',
    modifier: { silenceSuits: ['CALIZ', 'OJO'], phases: 2 },
  },

  // ===== SIMA III — El Fondo =====
  {
    id: 'boss.madre_palida',
    name: 'La Madre Palida',
    sima: 3,
    lore: 'Bajaste para encontrarla. Ojala no.',
    tell: 'La pantalla respira; latido que acelera.',
    orla: 'Carne que late.',
    modifier: { objectiveFactor: 1.1, phases: 2 },
  }, // TODO: inmune a ×mult 1a mano; +10%/fallo
  {
    id: 'boss.devorador_nombres',
    name: 'El Devorador de Nombres',
    sima: 3,
    lore: 'Olvidaras quien eras.',
    tell: 'Nombres borrandose.',
    orla: 'Letras que se disuelven.',
    modifier: { relicXMultPenalty: 0.5 },
  }, // TODO: silencia 1 reliquia/mano rotando
  {
    id: 'boss.ultimo_ojo',
    name: 'El Ultimo Ojo',
    sima: 3,
    lore: 'Lo ve todo, incluido el final.',
    tell: 'Un ojo colosal.',
    orla: 'Iris gigante.',
    modifier: { objectiveFactor: 1.1 },
  }, // TODO: alucinaciones garantizadas (Bloque 18)
  {
    id: 'boss.pozo',
    name: 'El Pozo',
    sima: 3,
    lore: 'No tiene fondo, como tu temias.',
    tell: 'La mano se vacia hacia abajo.',
    orla: 'Vacio que succiona.',
    modifier: { handsDelta: -1 },
  }, // TODO: cada mano cuesta 1 carta
  {
    id: 'boss.corona_gusanos',
    name: 'La Corona de Gusanos',
    sima: 3,
    lore: 'Reina de lo que repta.',
    tell: 'Gusanos coronados.',
    orla: 'Anelidos.',
    modifier: { objectiveFactor: 1.15 },
  }, // TODO: mejoras -> penalizacion
  {
    id: 'boss.silencio',
    name: 'El Silencio',
    sima: 3,
    lore: 'Donde acaba el sonido.',
    tell: 'Ausencia total.',
    orla: 'Negro que avanza.',
    modifier: { objectiveFactor: 1.2 },
  },
  {
    id: 'boss.huesped_menor',
    name: 'El Huesped Menor',
    sima: 3,
    lore: 'Vino contigo desde arriba.',
    tell: 'Tu silueta deformada.',
    orla: 'Tu propio reflejo.',
    modifier: { relicXMultPenalty: 0.5 },
  }, // TODO: copia tu reliquia mas fuerte
  {
    id: 'boss.fondo_mismo',
    name: 'El Fondo Mismo',
    sima: 3,
    lore: 'Lo que esperaba al final.',
    tell: 'Todo lo anterior a la vez, atenuado.',
    orla: 'La pantalla entera infectada.',
    modifier: { objectiveFactor: 1.2, silenceSuits: ['CALIZ'], phases: 3 },
  },

  // ===== Secretos =====
  {
    id: 'boss.huesped',
    name: 'El Huesped',
    sima: 3,
    lore: 'Reemplaza a un jefe si ganaste sin perder velas.',
    tell: 'Presencia que no estaba.',
    orla: 'Sombra ajena.',
    modifier: { objectiveFactor: 1.3, silenceSuits: ['HUESO'], phases: 2 },
    secret: true,
  }, // recompensa: legendaria garantizada (Bloque 17)
  {
    id: 'boss.que_mira_desde_fuera',
    name: 'El Que Mira Desde Fuera',
    sima: 3,
    lore: 'Solo en Infinito Umbral 13+. Rompe una regla por combate.',
    tell: 'Algo observa desde mas alla del marco.',
    orla: 'Grieta en la realidad.',
    modifier: { objectiveFactor: 1.5, phases: 3 },
    secret: true,
  },
];
