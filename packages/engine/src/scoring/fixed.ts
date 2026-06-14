// Aritmetica de PUNTO FIJO para la puntuacion (§7.3.1, §16.2, INV-2).
// El multiplicador se trabaja escalado en BigInt; solo al final se hace floor. Asi, misma seed +
// mismas acciones = misma puntuacion BIT A BIT en cualquier dispositivo (semillas compartidas).
// Nada de coma flotante en la ruta de puntuacion (prohibido por §24.8).

/** Escala interna del multiplicador: 1.0 real = 1_000_000 en fijo (6 decimales). */
export const MULT_SCALE = 1_000_000n;

/** Convierte un multiplicador real (p.ej. 1.5, 4, 0.5) a fijo. Conversion exacta de constantes. */
export function multToFixed(realMult: number): bigint {
  return BigInt(Math.round(realMult * 1_000_000));
}

/** Multiplica un mult fijo por un factor real, manteniendo la escala (×mult). */
export function xMultFixed(multScaled: bigint, factor: number): bigint {
  return (multScaled * multToFixed(factor)) / MULT_SCALE;
}

/** Puntuacion final = floor(FICHAS × MULT_real). Division BigInt = floor para no negativos. */
export function finalScore(fichas: bigint, multScaled: bigint): bigint {
  return (fichas * multScaled) / MULT_SCALE;
}
