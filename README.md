# UMBRAL

Roguelike deckbuilder de puntuación (póker) con descenso por mazmorra ramificada.
Web (escritorio primero), deploy en Vercel + Supabase.

> Fuente única de verdad: [`UMBRAL_BIBLIA.md`](./UMBRAL_BIBLIA.md) — biblia de diseño + prompt
> maestro de ejecución. La ejecución va **por bloques con gate humano** (§19).

## Estado

**Bloque 0 — Andamiaje** (en curso). Monorepo levantado; engine/feel/contenido llegan en bloques posteriores.

## Estructura (monorepo pnpm + Turborepo)

```
apps/web              → Next.js 16 (App Router, TS strict, Tailwind v4) — EL SHELL
packages/engine       → motor de juego TS PURO (sin DOM/React/Pixi) — EL CEREBRO
packages/game-render  → capa PixiJS v8 que consume el engine — LOS OJOS
packages/content      → todo el contenido como data tipada
packages/shared       → tipos compartidos, PRNG sembrado, validadores Zod, utilidades
packages/sim          → herramientas de simulación/balanceo (CLI)
supabase/             → migraciones SQL, RLS, auth, guardado en nube
```

## Requisitos

- Node **24.x** (ver `.nvmrc`)
- pnpm **10.x** (`corepack enable`)

## Scripts

```bash
pnpm install        # instalar dependencias
pnpm dev            # arrancar la app web en desarrollo
pnpm build          # build de todo el monorepo (Turborepo)
pnpm test           # tests (Vitest)
pnpm typecheck      # comprobación de tipos (TS strict)
pnpm lint           # Biome (lint + format check)
pnpm lint:fix       # Biome con autofix
```

## Invariantes (resumen, ver §0.1 de la biblia)

Determinismo total por seed · puntuación en punto fijo (cross-device) · engine agnóstico
(TS puro) · estado serializable y versionado · IP propia · datos de jugador sagrados ·
content registry inmutable por versión · todo el contenido es data (cero `if`-por-id en el engine).
