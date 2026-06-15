// Guardado en nube del run en curso (§15): guardar (POST) y cargar (GET ?playerId=).
import type { NextRequest } from 'next/server';
import { SaveSubmit } from '@/lib/api-schemas';
import { loadRun, saveRun } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = SaveSubmit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'formato invalido', detail: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const { playerId, handle, state, actionLog } = parsed.data;
    await saveRun(playerId, handle, state, actionLog);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'error de base de datos', detail: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const playerId = req.nextUrl.searchParams.get('playerId');
  if (!playerId) return Response.json({ error: 'falta playerId' }, { status: 400 });
  try {
    const save = await loadRun(playerId);
    return Response.json({ save });
  } catch (err) {
    return Response.json({ error: 'error de base de datos', detail: String(err) }, { status: 500 });
  }
}
