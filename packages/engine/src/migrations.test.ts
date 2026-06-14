import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateSave } from './migrations';

describe('migraciones de save (§5.5)', () => {
  it('migra v0 -> v1 conservando los datos', () => {
    const v0 = { schemaVersion: 0, seed: 'x', gold: 10 };
    const migrated = migrateSave(v0);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.seed).toBe('x');
    expect(migrated.gold).toBe(10);
  });

  it('un save sin schemaVersion se trata como v0 y se migra', () => {
    const migrated = migrateSave({ seed: 'y' });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('un save ya actual no cambia', () => {
    const current = { schemaVersion: CURRENT_SCHEMA_VERSION, foo: 1 };
    expect(migrateSave(current)).toEqual(current);
  });
});
