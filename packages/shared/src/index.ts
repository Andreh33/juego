// @umbral/shared — tipos compartidos, PRNG sembrado, validadores Zod, utilidades.

/** Marcador de andamiaje (lo consume el engine en Bloque 0; se retira al cablear el engine real). */
export const UMBRAL_SCAFFOLD = 'umbral-shared@0';

export * from './prng';
export * from './schemas';
export * from './types';
