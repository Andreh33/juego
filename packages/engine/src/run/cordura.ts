// Cordura — sistema de horror/riesgo global (§10).
export type CorduraState = 'lucido' | 'inquieto' | 'perturbado' | 'al_borde' | 'abismo';

/** Estado de Cordura por umbral (§10.2). */
export function corduraState(sanity: number): CorduraState {
  if (sanity >= 70) return 'lucido';
  if (sanity >= 40) return 'inquieto';
  if (sanity >= 15) return 'perturbado';
  if (sanity >= 1) return 'al_borde';
  return 'abismo';
}

/** Bono PLANO de mult por Cordura baja (§10.3): floor((100 - cordura) / 10), 0..10. */
export function bonoMultCordura(sanity: number): number {
  const s = Math.max(0, Math.min(100, sanity));
  return Math.floor((100 - s) / 10);
}

/**
 * Factor del objetivo del jefe segun Cordura (§10.2): +10% (perturbado), +20% (al borde).
 * En Abismo (0) no hay penalizacion extra de objetivo (es el borde del poder roto).
 */
export function bossObjectiveFactor(sanity: number): number {
  switch (corduraState(sanity)) {
    case 'perturbado':
      return 1.1;
    case 'al_borde':
      return 1.2;
    default:
      return 1.0;
  }
}
