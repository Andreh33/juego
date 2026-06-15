// Marcador de amigos (§15, §16): subir puntuacion (POST) y leer marcador por modo (GET).
// Por confianza: se valida el FORMATO con Zod, no la legitimidad.
import type { NextRequest } from 'next/server';
import { LeaderboardQuery, ScoreSubmit } from '@/lib/api-schemas';
import { leaderboard, submitScore } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = ScoreSubmit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'formato invalido', detail: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const id = await submitScore(parsed.data);
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'error de base de datos', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = LeaderboardQuery.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: 'parametros invalidos', detail: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const entries = await leaderboard(parsed.data);
    return Response.json({ entries });
  } catch (err) {
    return Response.json({ error: 'error de base de datos', detail: String(err) }, { status: 500 });
  }
}
