// Runner de migraciones para Turso/libsql. Aplica db/migrations/*.sql en orden, una sola vez.
// Uso: node --env-file=apps/web/.env.local db/migrate.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = process.env;
if (!url || !authToken) {
  console.error(
    'Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (usa --env-file=apps/web/.env.local)',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const db = createClient({ url, authToken });

await db.execute(
  'create table if not exists _migrations (name text primary key, applied_at integer not null default (unixepoch()))',
);
const applied = new Set(
  (await db.execute('select name from _migrations')).rows.map((r) => String(r.name)),
);

const dir = join(here, 'migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  if (applied.has(file)) {
    console.log('· ya aplicada:', file);
    continue;
  }
  const sql = readFileSync(join(dir, file), 'utf8');
  await db.executeMultiple(sql);
  await db.execute({ sql: 'insert into _migrations (name) values (?)', args: [file] });
  console.log('✓ aplicada:', file);
}
console.log('migraciones al dia');
