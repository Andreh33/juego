-- UMBRAL — esquema inicial (Turso/libsql). §15 adaptado a SQLite.
-- Sin auth ni RLS (Turso no las tiene): identidad por HANDLE, marcador POR CONFIANZA (§16).
-- Migraciones SIEMPRE aditivas y versionadas (INV-6): nunca DROP de datos de jugador.

create table if not exists players (
  id text primary key,                 -- uuid generado por el cliente (perfil/dispositivo)
  handle text not null unique,
  created_at integer not null default (unixepoch())
);

create table if not exists player_meta (
  player_id text primary key references players(id),
  schema_version integer not null default 1,
  blob text not null default '{}',     -- unlocks/cosmeticos/ajustes/guardado en nube (JSON)
  updated_at integer not null default (unixepoch())
);

create table if not exists player_unlocks (
  player_id text not null references players(id),
  unlock_id text not null,
  unlocked_at integer not null default (unixepoch()),
  primary key (player_id, unlock_id)
);

create table if not exists player_achievements (
  player_id text not null references players(id),
  achievement_id text not null,
  unlocked_at integer not null default (unixepoch()),
  primary key (player_id, achievement_id)
);

-- Guardado de run en curso (reanudar desde cualquier dispositivo).
create table if not exists run_saves (
  player_id text primary key references players(id),
  state text not null,                 -- GameState JSON
  action_log text not null,            -- action log JSON
  updated_at integer not null default (unixepoch())
);

-- Puntuaciones del MARCADOR DE AMIGOS (por confianza; sin validacion de servidor).
create table if not exists scores (
  id text primary key,                 -- uuid
  player_id text not null references players(id),
  vessel text not null,
  seed text not null,
  ruleset_version integer not null,
  mode text not null,                  -- carrera|diario|semanal|infinito|desafio|custom
  veil integer not null default 0,
  daily_date text,
  weekly_id text,
  challenge_id text,
  status text not null,                -- won|lost|abandoned
  score integer not null,             -- reportado por el cliente (confianza). INTEGER = 64-bit.
  depth integer not null default 0,   -- Umbral alcanzado (Infinito)
  action_log text,                    -- opcional: ver/repetir la run del amigo
  created_at integer not null default (unixepoch())
);
create index if not exists idx_scores_mode on scores (mode, score desc);
create index if not exists idx_scores_daily on scores (daily_date, score desc);
create index if not exists idx_scores_weekly on scores (weekly_id, score desc);
create index if not exists idx_scores_infinito on scores (mode, depth desc, score desc);

create table if not exists daily_seeds (
  date text primary key,
  seed text not null,
  vessel text not null
);

create table if not exists weekly_seeds (
  week_id text primary key,
  seed text not null,
  mutator text not null
);
