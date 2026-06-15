// Cliente Turso/libsql (solo servidor). Singleton perezoso.
import { type Client, createClient } from '@libsql/client';
import { getServerEnv } from './server-env';

let client: Client | null = null;

export function db(): Client {
  if (client) return client;
  const env = getServerEnv();
  client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  return client;
}
