// Versionado de saves y migraciones (§5.5, INV-4/INV-6).
// Cada save lleva schemaVersion. Al cargar uno antiguo se aplican migraciones puras vN -> vN+1
// en cadena. Nunca se rompe un save sin migracion.

export const CURRENT_SCHEMA_VERSION = 1;

type RawSave = Record<string, unknown>;
type Migration = (s: RawSave) => RawSave;

/**
 * Cadena de migraciones, indexada por la version DE ORIGEN.
 * v0 -> v1: trivial (cablea el campo schemaVersion). Establece el mecanismo; las migraciones
 * reales de contenido/estado se anaden cuando el esquema cambie de verdad.
 */
const MIGRATIONS: Record<number, Migration> = {
  0: (s) => ({ ...s, schemaVersion: 1 }),
};

/** Aplica las migraciones necesarias hasta CURRENT_SCHEMA_VERSION. Lanza si falta un eslabon. */
export function migrateSave(raw: RawSave): RawSave {
  let s = raw;
  let version = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new Error(`Sin migracion para schemaVersion ${version} -> ${version + 1}`);
    }
    s = migration(s);
    const next = typeof s.schemaVersion === 'number' ? s.schemaVersion : version + 1;
    if (next <= version) {
      throw new Error(`Migracion de ${version} no avanzo la version`);
    }
    version = next;
  }
  return s;
}
