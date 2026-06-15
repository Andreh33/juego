// Validacion de bordes de red (Zod) para los Route Handlers. Por confianza (§16): se valida
// el FORMATO, no la legitimidad de la puntuacion.
import { z } from 'zod';

export const RunMode = z.enum(['carrera', 'diario', 'semanal', 'infinito', 'desafio', 'custom']);

export const ScoreSubmit = z.object({
  playerId: z.string().min(1).max(64),
  handle: z.string().min(1).max(32),
  vessel: z.string().min(1).max(32),
  seed: z.string().min(1).max(128),
  rulesetVersion: z.number().int(),
  mode: RunMode,
  veil: z.number().int().min(0).max(20).default(0),
  status: z.enum(['won', 'lost', 'abandoned']),
  score: z.number().int().nonnegative(),
  depth: z.number().int().min(0).default(0),
  dailyDate: z.string().max(16).optional(),
  weeklyId: z.string().max(32).optional(),
  challengeId: z.string().max(64).optional(),
  actionLog: z.array(z.unknown()).optional(),
});
export type ScoreSubmit = z.infer<typeof ScoreSubmit>;

export const SaveSubmit = z.object({
  playerId: z.string().min(1).max(64),
  handle: z.string().min(1).max(32),
  state: z.unknown(),
  actionLog: z.array(z.unknown()),
});
export type SaveSubmit = z.infer<typeof SaveSubmit>;

export const LeaderboardQuery = z.object({
  mode: RunMode.default('carrera'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  dailyDate: z.string().optional(),
  weeklyId: z.string().optional(),
  challengeId: z.string().optional(),
});
