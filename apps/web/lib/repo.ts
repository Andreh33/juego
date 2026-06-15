// Acceso a datos (Turso). Por confianza (§16): sin re-simulacion ni validacion de servidor.

import type { ScoreSubmit } from './api-schemas';
import { db } from './db';

/** Crea el jugador si no existe y actualiza su handle. */
export async function ensurePlayer(playerId: string, handle: string): Promise<void> {
  await db().execute({
    sql: `insert into players (id, handle) values (?, ?)
          on conflict(id) do update set handle = excluded.handle`,
    args: [playerId, handle],
  });
}

/** Inserta una puntuacion en el marcador. Devuelve el id generado. */
export async function submitScore(data: ScoreSubmit): Promise<string> {
  await ensurePlayer(data.playerId, data.handle);
  const id = crypto.randomUUID();
  await db().execute({
    sql: `insert into scores
          (id, player_id, vessel, seed, ruleset_version, mode, veil, daily_date, weekly_id,
           challenge_id, status, score, depth, action_log)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.playerId,
      data.vessel,
      data.seed,
      data.rulesetVersion,
      data.mode,
      data.veil,
      data.dailyDate ?? null,
      data.weeklyId ?? null,
      data.challengeId ?? null,
      data.status,
      data.score,
      data.depth,
      data.actionLog ? JSON.stringify(data.actionLog) : null,
    ],
  });
  return id;
}

export interface LeaderboardEntry {
  handle: string;
  score: number;
  depth: number;
  vessel: string;
  status: string;
  createdAt: number;
}

export interface LeaderboardOpts {
  mode: string;
  limit: number;
  dailyDate?: string | undefined;
  weeklyId?: string | undefined;
  challengeId?: string | undefined;
}

/** Marcador por modo. Diario/semanal/desafio: la MEJOR puntuacion por jugador. */
export async function leaderboard(opts: LeaderboardOpts): Promise<LeaderboardEntry[]> {
  const orderInfinito = opts.mode === 'infinito';
  const orderInner = orderInfinito ? 's.depth desc, s.score desc' : 's.score desc';
  const orderOuter = orderInfinito ? 'depth desc, score desc' : 'score desc';

  const where: string[] = ['s.mode = ?'];
  const args: (string | number)[] = [opts.mode];
  if (opts.dailyDate) {
    where.push('s.daily_date = ?');
    args.push(opts.dailyDate);
  }
  if (opts.weeklyId) {
    where.push('s.weekly_id = ?');
    args.push(opts.weeklyId);
  }
  if (opts.challengeId) {
    where.push('s.challenge_id = ?');
    args.push(opts.challengeId);
  }

  // La MEJOR puntuacion por jugador (un registro por persona) via row_number().
  const sql = `
    select handle, score, depth, vessel, status, createdAt from (
      select p.handle as handle, s.score as score, s.depth as depth, s.vessel as vessel,
             s.status as status, s.created_at as createdAt,
             row_number() over (partition by s.player_id order by ${orderInner}) as rn
      from scores s
      join players p on p.id = s.player_id
      where ${where.join(' and ')}
    )
    where rn = 1
    order by ${orderOuter}
    limit ?`;
  const res = await db().execute({ sql, args: [...args, opts.limit] });
  return res.rows.map((r) => ({
    handle: String(r.handle),
    score: Number(r.score),
    depth: Number(r.depth),
    vessel: String(r.vessel),
    status: String(r.status),
    createdAt: Number(r.createdAt),
  }));
}

/** Guarda (o reemplaza) el run en curso del jugador. */
export async function saveRun(
  playerId: string,
  handle: string,
  state: unknown,
  actionLog: unknown,
): Promise<void> {
  await ensurePlayer(playerId, handle);
  await db().execute({
    sql: `insert into run_saves (player_id, state, action_log, updated_at)
          values (?, ?, ?, unixepoch())
          on conflict(player_id) do update set
            state = excluded.state, action_log = excluded.action_log, updated_at = excluded.updated_at`,
    args: [playerId, JSON.stringify(state), JSON.stringify(actionLog)],
  });
}

export interface RunSave {
  state: unknown;
  actionLog: unknown;
  updatedAt: number;
}

/** Carga el run en curso del jugador, o null. */
export async function loadRun(playerId: string): Promise<RunSave | null> {
  const res = await db().execute({
    sql: 'select state, action_log, updated_at from run_saves where player_id = ?',
    args: [playerId],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    state: JSON.parse(String(row.state)),
    actionLog: JSON.parse(String(row.action_log)),
    updatedAt: Number(row.updated_at),
  };
}
