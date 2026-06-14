import { CURRENT_SCHEMA_VERSION } from '@umbral/engine';

// "Hola mundo" del shell. Importa del engine para probar el cableado del monorepo.
// El menu principal con la orla viva (§6.7, §6.9) llega en el Bloque 13.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-6xl font-bold tracking-widest text-umbral-ocre">UMBRAL</h1>
      <p className="max-w-md text-umbral-ceniza">
        Roguelike deckbuilder de puntuacion. El descenso comienza.
      </p>
      <code className="rounded border border-umbral-pergamino bg-umbral-tinta px-3 py-1 text-xs text-umbral-fosforo">
        engine · schema v{CURRENT_SCHEMA_VERSION}
      </code>
      <span className="text-xs text-umbral-ceniza/60">Bloque 2 — Estado + event-sourcing</span>
    </main>
  );
}
