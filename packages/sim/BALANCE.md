# Informe de balanceo — UMBRAL (Bloque 19)

> Salida versionada del simulador (§13.1). Regenerar con:
> `pnpm --filter @umbral/sim start -- --runs=12 --veils=0,3,6,10,15,20`
> (o `--json` para volcado completo, `--vessels=...` para acotar).

## Metodología

`packages/sim` juega runs completas con el engine real (reducer puro, determinista por seed)
conducidas por **políticas heurísticas** (`policy.ts`):

- **medio** — juega la mejor mano de póker de 5 cartas, cava con descartes si la mano es floja,
  sube de nivel manos en el Descanso, usa augurios/sellos, compra reliquias asequibles.
- **arquetipos** (§13.4) — `fichas`, `mult`, `xmult`, `retrigger`, `economia`, `escaladoras`:
  misma base, pero **sesgan la elección de reliquias** por `tags` (drafts y tienda).

El barrido (`report.ts`) cruza Velos × Recipientes × políticas, agrega win-rate por Velo,
profundidad/score medios, frecuencia de uso de cada reliquia y detecta **reliquias muertas**
(nunca vistas) y **rotas** (≥90 % victoria con ≥20 muestras).

## Resultado actual (ruleset v1, 3024 runs)

```
Velo | runs |  win% | objetivo  | ok | prof.med | score.med
-----|------|-------|-----------|----|----------|----------
   0 |  504 |    1% |    70-85% | ✗ |      4.9 |    134965
   3 |  504 |    1% |    55-70% | ✗ |      4.8 |    118241
   6 |  504 |    0% |    40-55% | ✗ |      4.5 |    114142
  10 |  504 |    1% |    40-50% | ✗ |      4.1 |    107573
  15 |  504 |    1% |    15-25% | ✗ |      3.9 |     98747
  20 |  504 |    0% |     0-8%  | ✓ |      3.7 |     75701
```

Reliquias muertas: **0**. Reliquias rotas: **0**.

## Hallazgos

1. **Gap de pool de Recipiente (CORREGIDO).** El simulador reveló que las **30 reliquias
   exclusivas de Recipiente** nunca entraban en recompensas/tienda (el pool excluía todo
   `def.vessel`). Arreglado en `content/pool.ts`: las reliquias del Recipiente **actual** sí
   entran (sesgo §8); las de otros Recipientes siguen excluidas. Tras el fix: 0 reliquias muertas.

2. **La curva de objetivos v1 supera al jugador greedy.** El bot mecánico aguanta hasta el
   **Umbral ~5** y luego el objetivo exponencial (×~2.3/Umbral) lo desborda → win-rate ~1 %.
   Esto es un **suelo mecánico**, no la tasa de un humano: el bot no encadena ×mult por orden
   (§7.3), no planifica sinergias ni secuencia breakpoints (§13.4). Un "jugador medio" humano
   rinde bastante por encima.

3. **Sin reliquias rotas.** Ninguna reliquia gana sola de forma degenerada con estas políticas.

## Recomendaciones (siguiente iteración, INV-7)

- El simulador es una **cota inferior**: para acercar la medición al "jugador medio" objetivo
  de §13.2 hace falta **(a)** políticas más fuertes (orden de reliquias ×mult, draft coherente
  por arquetipo, uso de conjuros) y/o **(b)** un `rulesetVersion` 2 que suavice la curva temprana
  de objetivos (§9.3) o refuerce la economía (§13.3).
- Decisión de afinado numérico **diferida a iteración con diseño** (no se inventa un rebalanceo
  especulativo): el tooling ya está listo para medir cualquier ajuste de números por versión.

## Estado del DoD (§19, Bloque 19)

- [x] `packages/sim` juega miles de runs por arquetipo/Velo.
- [x] Reporta win-rate por Velo, distribución de score, reliquias muertas/rotas.
- [x] Salida versionada (este documento).
- [~] Win-rates dentro de objetivos §13.2: **pendiente de afinado** (el tooling mide; el ajuste
  de números/políticas es la siguiente pasada). Documentado, no silenciado.
