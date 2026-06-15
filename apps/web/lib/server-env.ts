// Validacion de entorno de SERVIDOR (§23.3). Falla rapido si falta algo. Lazy: no rompe el build.
import { z } from 'zod';

const ServerEnv = z.object({
  TURSO_DATABASE_URL: z.string().min(1, 'falta TURSO_DATABASE_URL'),
  TURSO_AUTH_TOKEN: z.string().min(1, 'falta TURSO_AUTH_TOKEN'),
  RULESET_VERSION: z.coerce.number().int().default(1),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

/** Lee y valida el entorno de servidor (solo en Route Handlers, nunca en cliente). */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = ServerEnv.parse({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    RULESET_VERSION: process.env.RULESET_VERSION,
  });
  return cached;
}
