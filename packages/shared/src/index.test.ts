import { describe, expect, it } from 'vitest';
import { UMBRAL_SCAFFOLD } from './index.js';

describe('andamiaje @umbral/shared', () => {
  it('exporta el marcador de andamiaje', () => {
    expect(UMBRAL_SCAFFOLD).toBe('umbral-shared@0');
  });
});
