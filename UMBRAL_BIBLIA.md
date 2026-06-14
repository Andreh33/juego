# BIBLIA DE DISEÑO + PROMPT MAESTRO — UMBRAL (EDICIÓN COMPLETA v2)

**Codename:** `UMBRAL` · **Género:** roguelike deckbuilder de puntuación (póker) con descenso por mazmorra ramificada · **Plataforma:** web (escritorio primero) · **Deploy:** Vercel + Supabase · **Diseño:** Andreh (Latech) · **Ejecutor:** Claude Code · **Objetivo declarado:** un juego de *cientos de horas*, alta rejugabilidad, diversidad de builds y factor suerte deliberado. No un juego que se pasa en dos horas.

> Este documento es a la vez **biblia de diseño** (el "qué" y el "por qué") y **prompt maestro de ejecución** (el "cómo", por bloques con gate). Es la fuente única de verdad. Si algo no está aquí, Claude Code PARA y pregunta; no inventa.

---

# ÍNDICE

0. Cómo usar este documento · Invariantes
1. Visión, pilares y la tesis de "cientos de horas"
2. Filosofía de rejugabilidad y diseño de la suerte
3. Decisiones de diseño cerradas
4. Stack técnico (bloqueado)
5. Arquitectura (engine, event-sourcing, content registry, save migration)
6. Dirección de arte e identidad visual (bible completa)
7. El motor de puntuación (núcleo, números exactos, retriggers, breakpoints)
8. Los Recipientes (clases jugables) — el gran multiplicador de rejugabilidad
9. Estructura de run (Simas, Umbrales, mapa, modo infinito)
10. Cordura — el sistema de horror/riesgo global
11. CONTENIDO MASIVO (90 reliquias, arcanos, vales, jefes ×24+, élites, eventos ×40+)
12. Sistemas de progresión y longevidad (Velos de dificultad ×20, desbloqueos, logros ×100, codex, retos, desafíos, infinito)
13. Economía, curvas de balanceo y objetivos numéricos
14. Game feel y audio (librería completa de juice + música dinámica)
15. Datos / Supabase (esquema completo, leaderboards múltiples, telemetría)
16. Determinismo, semillas compartidas y marcadores entre amigos
17. Producción de assets: texturas PBR reales, normal maps, shader de material, grade y licencias
18. Accesibilidad y opciones
19. Bloques de ejecución (con gate humano)
20. Criterios de aceptación / Definition of Done
21. Roadmap post-lanzamiento
22. Apéndices (glosario, fórmulas, tablas maestras)
23. Despliegue en Vercel + Supabase (topología, env, CDN de assets, CI)
24. Manual de operación para Claude Code (convenciones, git, testing, SSR, errores)
25. Modelo de datos canónico (tipos TypeScript que NO debes reinventar)
26. Presupuestos de rendimiento (números duros) y checklist de lanzamiento

---

# 0. CÓMO USAR ESTE DOCUMENTO · INVARIANTES

Eres **Claude Code** ejecutando bajo dirección del arquitecto humano (Andreh). Reglas, sin excepción:

1. **No tomas decisiones de diseño.** Todas están aquí. Si falta una concreción **en el momento de implementarla**, PARAS y preguntas. No inventas mecánicas, nombres, números ni estética.
2. **Ejecución por bloques con gate humano** (§19). Al cierre de cada bloque: paras, resumes, indicas cómo probarlo, esperas `OK` explícito. No encadenas bloques.
3. **Invariantes inmutables** (§0.1): jamás se violan. Si una tarea las contradice, paras y avisas.
4. **Commits atómicos por bloque**, merge `--no-ff`, un tag por bloque (`v0.X.0`). Mensajes de commit descriptivos.
5. **TypeScript strict.** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Cero `any` implícito; cada `@ts-expect-error` lleva comentario.
6. **El motor es código puro testeable.** Si una pieza de lógica no se puede testear en Node sin DOM, está mal ubicada.
7. **Todo el contenido es data, no código hardcodeado.** 150 reliquias no son 150 `if`. Es un registro de datos + un intérprete de efectos (§5.4). Esto es lo que permite escalar a cientos de piezas sin que el engine se pudra.
8. **El balanceo va con red de tests.** Cambiar un número no debe romper silenciosamente otra cosa.

## 0.1 Invariantes inmutables

- **INV-1 — Determinismo total.** Toda aleatoriedad deriva de una única `seed` por run vía PRNG sembrado, cuyo estado vive dentro del `GameState`. Misma seed + mismas acciones = mismo resultado byte a byte. `Math.random()` PROHIBIDO en cualquier ruta que afecte estado.
- **INV-2 — Reproducibilidad por semilla (para semillas compartidas entre amigos).** La misma `seed` + las mismas acciones producen la misma partida **en cualquier dispositivo**. Esto habilita el modo estrella entre amigos (todos juegan la misma run del día y comparan puntuación) y el guardado/repetición. La puntuación se calcula en el cliente y se confía (es un juego para ti y tus amigos; **no hay validación de servidor ni anti-trampas**, por decisión explícita). Para que dos dispositivos coincidan byte a byte, la puntuación usa **aritmética de punto fijo** (§7.3.1), no coma flotante.
- **INV-3 — Engine agnóstico.** `packages/engine` es TS puro: sin DOM, sin `pixi.js`, sin `react`. Corre idéntico en navegador y Node.
- **INV-4 — Estado serializable y versionado.** Todo `GameState` serializa a JSON y se reconstruye sin pérdida. Cada save lleva `schemaVersion`; existe una cadena de migraciones (§5.5). Nunca se rompe un save de jugador sin migración.
- **INV-5 — IP propia.** Cero nombres, arte, copy o assets de otros juegos. Lo de aquí es UMBRAL. Assets con licencia integrados según §17.
- **INV-6 — Datos de jugador sagrados.** Migraciones de Supabase aditivas y versionadas. Nunca `DROP` con datos de runs/unlocks/logros sin backfill aprobado.
- **INV-7 — Content registry inmutable por versión.** Cada pieza de contenido tiene `id` estable y un `rulesetVersion`. Re-balancear crea una versión nueva; las runs guardan con qué versión se jugaron (para reproducir/repetir y comparar semillas correctamente).


---

# 1. VISIÓN, PILARES Y LA TESIS DE "CIENTOS DE HORAS"

**UMBRAL** es un roguelike donde puntúas formando manos de póker mientras *desciendes* a un lugar maldito. Cada partida es una caída por *Umbrales* (los "antes"), cada uno más hondo. Entre combates recorres un **mapa de mazmorra ramificado** con decisiones, y al fondo de cada Umbral espera un **Jefe** que rompe las reglas y da miedo de verdad. Eliges un **Recipiente** (clase) con mecánica propia, construyes un mazo y una colección de **Reliquias** que se combinan en sinergias rotas, y persigues puntuaciones imposibles.

## 1.1 Pilares (orden de prioridad innegociable)

1. **El loop engancha por la matemática.** Fichas × Multiplicador, sinergias, escalada exponencial de objetivos. Esto se clava primero, antes de un solo gráfico.
2. **Game feel antes que fidelidad.** Cada mano jugada se *siente*: el conteo, el shake, el ralentí del crítico, el sonido que sube de tono con el mult. Mayor retorno que cualquier modelo 3D.
3. **2.5D por shaders, no geometría.** Cartas físicas iluminadas: tilt en perspectiva, foil/holo/espectral, especular dinámico, parallax, profundidad de campo. Estética de estudio AAA a coste de cómputo bajo.
4. **Terror atmosférico, no gore.** El miedo entra por ambientación, sonido y jefes que parecen *mirarte* y cambian las reglas. Ocultismo de gabinete, no casquería.
5. **Rejugabilidad infinita.** Clases, escalera de 20 niveles de dificultad, modo infinito, retos diarios/semanales, cientos de desbloqueos, y un espacio combinatorio de builds tan amplio que dos runs no se parecen.

## 1.2 La tesis de "cientos de horas" (cómo se consigue, explícito)

Un roguelike no se hace largo con cinemáticas, se hace largo con **espacio de decisiones × razones para volver**. Las siete palancas de longevidad de UMBRAL, todas implementadas:

1. **Amplitud de contenido.** 6 Recipientes con mecánicas distintas · 90 reliquias (60 generales + 30 de Recipiente, cero relleno) · ~60 arcanos/vales · 24+ jefes (rotación por profundidad, no siempre los mismos) · 40+ eventos · 50+ logros de contenido. El "pool" es tan grande que cada run reparte una mano distinta.
2. **Diversidad de builds reales.** No basta con tener 150 reliquias; tienen que cuajar en **arquetipos viables y distintos** (Fichas puras, Mult plano, Mult×Mult, Retrigger, Economía, Escaladoras, Palo único, Caos espectral, Cordura-rota...). Ver §11.1 y §13.4: cada arquetipo tiene su camino de breakpoints.
3. **Escalera de maestría (Velos).** 20 niveles de dificultad ascendente (§12.1), cada uno con un modificador permanente. Subir del Velo 0 al 20 con cada Recipiente es el "endgame" de cientos de horas. (6 recipientes × 20 velos = 120 cumbres distintas que conquistar.)
4. **Modo infinito + persecución de puntuación.** Tras ganar (Umbral 8), el descenso continúa con escalado exponencial; el objetivo deja de ser sobrevivir y pasa a ser **batir tu récord** y el del leaderboard. Esto es horas puras de optimización.
5. **Retos diarios y semanales con semilla compartida (modo estrella entre amigos).** Una seed igual para todos cada día/semana: tú y tus amigos jugáis **exactamente la misma run** y comparáis quién puntúa más. Es el pique social del grupo. Marcador de amigos basado en confianza (§16). La gente vuelve cada día a por la del día.
6. **Factor suerte que crea historias.** RNG generoso y swingy (cartas, ofertas de tienda, jefes) con herramientas de mitigación (rerolls, scry, depuración de mazo, drafts). Las runs memorables nacen de "me salió la reliquia perfecta justo a tiempo" o "el jefe me silenció mi único palo". Diseño en §2.
7. **Meta-progresión persistente.** Desbloqueos, logros, codex/bestiario con cientos de entradas, mazos y recipientes que se ganan jugando. Sensación constante de avanzar incluso al perder.

> **Métrica de éxito de longevidad (objetivo de diseño):** un jugador promedio debería tener >40 h antes de "ver casi todo" el contenido una vez, y el endgame (Velo 20 con los 6 recipientes + leaderboards) debería sostener 200+ h para quien se enganche. Las decisiones de balanceo (§13) sirven a esto.

## 1.3 No-objetivos de v1 (para no diluir el alcance)

- Multijugador en tiempo real (solo leaderboards asíncronos).
- 3D real con Three.js en el juego (el shell puede usar 2.5D; el juego es Pixi puro).
- Monetización / anuncios.
- i18n multi-idioma en MVP (español primero; arquitectura preparada, solo `es` activo).
- Generación procedural de arte por IA en runtime (el arte se produce/licencia en pipeline, §17).

---

# 2. FILOSOFÍA DE REJUGABILIDAD Y DISEÑO DE LA SUERTE

## 2.1 Qué hace que dos runs no se parezcan

La varianza entra por **siete vectores independientes** sembrados desde la seed:

1. **Recipiente elegido** (6) → mecánica base + mazo inicial + pool de reliquias sesgado.
2. **Mapa del Umbral** (ramificado) → qué nodos hay y en qué orden; el jugador decide la ruta.
3. **Ofertas de tienda y recompensas** → qué reliquias/arcanos/vales se ofrecen.
4. **Jefes de cada Umbral** → extraídos de un pool por profundidad; su modificador redefine el combate.
5. **Eventos** → decisiones con consecuencias, extraídos de un pool de 40+.
6. **Reparto de cartas** dentro de cada combate.
7. **Cordura** (§10) → estados que alteran sutilmente el RNG y crean "alucinaciones".

Multiplicados, el espacio es prácticamente infinito. El diseño garantiza que casi cualquier combinación inicial **tiene un camino jugable** (no hay "seeds muertas"), pero no que todas sean igual de fáciles: parte de la gracia es leer la mano que te toca y adaptarte.

## 2.2 El diseño de la suerte (swingy pero justo)

El usuario quiere **factor suerte**. La suerte mal hecha frustra; bien hecha, crea historias. Principios:

- **Generosidad con varianza alta.** Las ofertas son potentes y frecuentes, pero variadas. Mejor "esta run me tocó un motor de economía brutal" que "todas las runs van igual".
- **Mitigación siempre disponible.** El jugador nunca está indefenso ante el RNG: rerolls de tienda, scry (ver/reordenar el mazo), depuración de mazo (quitar cartas malas), drafts (elegir 1 de N), y reliquias que reducen varianza. La suerte se *domestica* con decisiones, no se sufre pasiva.
- **Pity / suelo de fortuna.** Sistemas de "lástima" para evitar rachas catastróficas: si llevas X combates sin que aparezca ninguna reliquia rara, sube la probabilidad; el reto diario garantiza al menos una oferta fuerte temprana. Evita la espiral de muerte por mala suerte pura.
- **Riesgo elegido > riesgo impuesto.** El jugador puede **buscar** varianza alta (reliquias Malditas, cofres con riesgo, eventos de pacto, bajar Cordura) a cambio de poder. La suerte se convierte en una palanca que el jugador acciona, no solo en algo que le pasa.
- **Breakpoints como momento "eureka".** El placer de "si consigo esta tercera pieza, mi mult se dispara ×8" es el corazón del vicio. El balanceo (§13.4) coloca breakpoints alcanzables que premian leer las sinergias.
- **Lectura de jefe.** Saber qué jefe viene (se revela con antelación, §9.4) permite preparar el mazo. La suerte de *qué* jefe te toca se compensa con la habilidad de *prepararte*.

## 2.3 La curva emocional de una run

Cada run debería trazar: **arranque humilde → primeras sinergias → momento de poder (el motor arranca) → tensión creciente (objetivos exponenciales) → pico de jefe (rompe tus reglas) → catarsis (build roto destroza el objetivo) o muerte (las velas se apagan)**. El balanceo y el feel sirven a esta curva. El modo infinito extiende la fase de "poder roto" indefinidamente.

---

# 3. DECISIONES DE DISEÑO CERRADAS

Mías (arquitecto). No se discuten ni se "mejoran" sin orden explícita.

| Tema | Decisión |
|---|---|
| Estructura macro | Híbrida: motor de puntuación lineal (manos/objetivos) + mapa de mazmorra ramificado entre combates + modo infinito al final. |
| Unidad de progreso | El **Umbral** (= "ante"). Run completa = 8 Umbrales, agrupados en 3 **Simas** (actos). Tras el 8 → Infinito. |
| Clases | 6 **Recipientes** con mecánica única, mazo inicial único y pool de reliquias sesgado (§8). |
| Nodos del mapa | Combate · Élite · Tienda · Evento · Tesoro · Descanso · Santuario · Jefe. (§9.2) |
| Render del juego | **PixiJS v8** (WebGL/WebGPU). Shell en React/Next 16. |
| Estado | Engine TS puro (event-sourced) + **Zustand** como puente reactivo (el store NO tiene lógica). |
| Familias de objetos | **Reliquias** (sinergias/mult), **Augurios** (modifican cartas), **Sellos** (suben nivel de manos), **Conjuros** (efectos espectrales de un uso), **Vales** (mejoras permanentes de la run). (§11) |
| Sistema de horror | **Cordura** global (§10): riesgo/recompensa + alucinaciones + sesgo de RNG. |
| Dificultad | **20 Velos** de ascensión por recipiente (§12.1). |
| Semillas compartidas | Seed determinista + punto fijo → misma run en todos los dispositivos. Marcadores entre amigos por confianza, SIN anti-trampas (§16). |
| Plataforma primaria | Escritorio (ratón, hover-tilt). Móvil = adaptación posterior, no rompe en MVP. |
| Persistencia | Supabase (Auth + Postgres + RLS) + IndexedDB local (juega sin login, sin leaderboard). |
| Modos | Carrera (estándar) · Diario · Semanal · Infinito · Desafíos (mutadores) · Personalizado (seed + toggles). |
| Licencias | El usuario provee/gestiona licencias de fuentes, arte y audio; integración según pipeline §17. |


---

# 4. STACK TÉCNICO (BLOQUEADO)

```
Monorepo (pnpm workspaces + Turborepo)
├── apps/web              → Next.js 16, App Router, TS strict, Tailwind v4 (EL SHELL)
├── packages/engine       → motor de juego TS PURO (sin DOM/React/Pixi) — EL CEREBRO
├── packages/game-render  → capa PixiJS v8 que consume el engine — LOS OJOS
├── packages/content      → TODO el contenido como data tipada (reliquias, jefes, eventos…)
├── packages/shared       → tipos compartidos, PRNG sembrado, validadores Zod, utilidades
├── packages/sim          → herramientas de simulación/balanceo (CLI que juega miles de runs)
└── supabase              → migraciones SQL, RLS, auth, guardado en nube, marcador de amigos
```

- **Framework:** Next.js 16 (App Router, Server Actions, Route Handlers, Partial Prerendering donde aplique).
- **Lenguaje:** TypeScript 5.x estricto (flags en §0).
- **Estilos shell:** Tailwind v4 (config en CSS, `@theme`), componentes propios, sin librería pesada de UI.
- **Render juego:** PixiJS v8. Filtros/shaders GLSL propios. WebGPU con fallback WebGL.
- **Estado cliente:** Zustand (puente engine↔UI; el engine es la verdad).
- **Validación:** Zod en todos los bordes (red, saves, env).
- **Audio:** Howler.js (sprites SFX + música por capas con crossfade).
- **Tween shell:** GSAP (UI React). **Tween juego:** dentro del loop de Pixi (tween.js o tweens propios; decidir Bloque 6).
- **DB/Auth:** Supabase (`@supabase/ssr`).
- **Persistencia social:** Supabase (auth + guardado en nube + marcador de amigos). Sin servidor de validación (juego entre amigos, §16).
- **Tests:** Vitest (engine, content, shared). Playwright (smoke E2E shell). El paquete `sim` para balanceo estadístico.
- **Telemetría:** eventos anónimos de balanceo a Supabase (opt-out respetado).
- **Deploy:** Vercel (apps/web), Supabase gestionado.
- **Lint/format:** Biome.
- **Runtime:** Node 20 LTS · pnpm.

> Incompatibilidades de versión: PARAS y propones la estable más cercana. No cambias de librería por tu cuenta (INV-5/regla 1).

---

# 5. ARQUITECTURA

## 5.1 Separación de mundos

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web (React/Next) — SHELL                                 │
│ Menús · Selección de Recipiente · Tienda meta · Leaderboards  │
│ Codex · Logros · Ajustes · Auth · Pantalla de run (canvas+HUD)│
└───────────────┬──────────────────────────────────────────────┘
                │ acciones del jugador (GameAction)
                ▼
┌──────────────────────────────────────────────────────────────┐
│ packages/engine — CEREBRO (TS puro, event-sourced)            │
│ PRNG · GameState · reglas · scoring · efectos · validación    │
│ reduce(state, action) → { state, events }  (puro, determinista)│
└───────────────┬──────────────────────────────────────────────┘
                │ snapshots de estado + FeelEvents (cosméticos)
                ▼
┌──────────────────────────────────────────────────────────────┐
│ packages/game-render (PixiJS) — OJOS                          │
│ Dibuja tablero/cartas/VFX leyendo snapshots; reproduce feel.  │
│ CERO reglas: si el engine no lo dijo, no pasa.                 │
└──────────────────────────────────────────────────────────────┘
```

## 5.2 El motor como reductor puro (event-sourcing)

```ts
type GameAction =
  | { type: 'START_RUN'; seed: string; vessel: VesselId; ruleset: number; modifiers?: RunModifiers }
  | { type: 'SELECT_CARD'; cardId: CardId }
  | { type: 'DESELECT_CARD'; cardId: CardId }
  | { type: 'REORDER_HAND'; order: CardId[] }
  | { type: 'PLAY_HAND' }
  | { type: 'DISCARD' }
  | { type: 'BUY'; shopItemId: string }
  | { type: 'SELL_RELIC'; relicId: string }
  | { type: 'REROLL_SHOP' }
  | { type: 'USE_CONSUMABLE'; consumableId: string; targets: CardId[] }
  | { type: 'REORDER_RELICS'; order: string[] }
  | { type: 'CHOOSE_NODE'; nodeId: string }
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  | { type: 'PICK_REWARD'; rewardId: string }
  | { type: 'SKIP_REWARD' }
  | { type: 'REST_ACTION'; kind: 'heal' | 'upgrade' | 'remove'; target?: string }
  | { type: 'SCRY_KEEP'; cardId: CardId } | { type: 'SCRY_BURY'; cardId: CardId }
  | { type: 'NEXT' }
  | { type: 'TICK'; ms: number }; // SOLO timers cosméticos; NO afecta lógica ni va al action log

function reduce(state: GameState, action: GameAction): {
  state: GameState;
  events: FeelEvent[]; // "+X fichas", "shake", "jefe ríe"... cosméticos, ignorables sin perder corrección
};
```

Reglas duras:
- `reduce` **puro y síncrono**: sin `await`, sin `Date.now()`, sin `Math.random()`.
- El **action log** = lista ordenada de `GameAction` aplicadas (sin `TICK`). Sirve para **guardar/reanudar** una run, para **repetir/compartir** una partida (ver una run de un amigo desde su seed+log) y para depurar. No para validación (no hay anti-trampas).
- Cada acción **valida su propia legalidad**; una acción ilegal devuelve estado sin cambios + un `FeelEvent` de error.
- Toda `FeelEvent` es cosmética. Reproducir la run ignorando `events` produce el mismo `state` (gracias al punto fijo, §7.3.1, esto es idéntico en cualquier dispositivo → semillas compartidas).

## 5.3 PRNG sembrado y *streams* independientes

`packages/shared/prng.ts`:
- **mulberry32** sembrado con **cyrb128** (string seed → 4× uint32).
- El estado del PRNG vive **dentro de `GameState`** (serializable). Nunca un PRNG global mutable.
- **Streams separados** para evitar correlaciones raras: el RNG de *reparto de cartas* es un stream distinto del de *ofertas de tienda*, del de *generación de mapa*, del de *jefes*, del de *eventos*. Cada stream es un sub-PRNG derivado de la seed maestra + una etiqueta de dominio. Así, manipular descartes no "mueve" la tienda. (Esto también hace el balanceo y el debugging deterministas por dominio.)
- Helpers: `nextFloat`, `nextInt(min,max)`, `shuffle`, `pickWeighted`, `pickN`, `chance(p)`.

## 5.4 Content registry — "todo es data" (clave para escalar contenido sin tocar el engine)

El engine NO conoce reliquias concretas. Conoce un **modelo de efectos**. El contenido vive en `packages/content` como objetos tipados:

```ts
interface RelicDef {
  id: string;                 // estable, p.ej. 'relic.espejo_negro'
  name: string;               // "Espejo Negro"
  rarity: Rarity;             // 'comun'|'pococomun'|'rara'|'espectral'|'maldita'|'legendaria'
  cost: number;
  flavor: string;             // copy de grimorio
  tags: RelicTag[];           // 'mult'|'fichas'|'retrigger'|'economia'|'escaladora'|...
  unlock?: UnlockCondition;   // null = disponible de inicio
  vessel?: VesselId;          // exclusiva de un recipiente
  hooks: Partial<Record<EngineHook, EffectExpr>>; // efectos declarativos
}
```

Los **efectos son declarativos** (un mini-DSL de expresiones evaluadas por el engine), no funciones arbitrarias. Hooks disponibles (orden de evaluación documentado en §7.5):
`onRunStart, onUmbralStart, onCombatStart, onHandPlayed, onCardScored, onSuitScored, onRankScored, onHandTypeDetected, onDiscard, onCardDestroyed, onShopEnter, onCombatEnd, onUmbralEnd, beforeScore, afterScore, onSanityChange`.

Beneficios: contenido testeable en aislamiento, serializable, re-simulable, versionable, y **escalable a cientos de piezas** sin tocar el engine. Añadir una reliquia = añadir un objeto de datos + (si introduce un verbo nuevo) extender el DSL una vez.

> Si una reliquia necesita un comportamiento que el DSL no expresa, se PARA y se decide si (a) se extiende el DSL con un verbo nuevo bien definido, o (b) se rediseña la reliquia. Nunca un `eval` de código arbitrario ni un `if (id === ...)` salpicado por el engine.

## 5.5 Versionado de saves y migraciones

- Cada `GameState` y cada blob de meta-progresión lleva `schemaVersion`.
- `packages/engine/migrations/` contiene migraciones puras `vN → vN+1`. Al cargar un save antiguo, se aplican en cadena.
- `rulesetVersion` (balanceo/contenido) se guarda con cada run. La reproducción/repetición de una run usa el contenido de **esa** versión (INV-7). El registry mantiene versiones congeladas.
- Una run *en curso* de un ruleset anterior se puede terminar (re-sim con su versión) pero su score compite en el leaderboard etiquetado por versión (o se marca "legacy").

## 5.6 Flujo de una run (cliente)

1. Menú → elegir Recipiente → (seed manual / diaria / aleatoria) → `START_RUN`.
2. Cada interacción → `dispatch(action)` → `reduce` → nuevo estado → Zustand notifica → React HUD + Pixi se actualizan; Pixi reproduce `events`.
3. Persistencia continua del estado en IndexedDB (reanudar). El action log crece en paralelo.
4. Fin de run (victoria/muerte/abandono) → se guarda la run y, si hay login, se sube `{ vessel, seed, mode, score, depth }` al **marcador de amigos** (por confianza, sin re-simulación). El action log se conserva para poder repetir/compartir la partida.
5. Desbloqueos/logros derivados de la run se aplican al perfil (local y, si hay login, servidor).


---

# 6. DIRECCIÓN DE ARTE E IDENTIDAD VISUAL

## 6.1 Concepto rector

**Ocultismo de gabinete victoriano.** La estética de un naturalista del siglo XIX que cataloga lo innombrable: láminas calcográficas entintadas, herbarios de plantas imposibles, anatomías que no deberían existir. El horror entra por lo **orgánico-equivocado** (simetrías rotas, ojos donde no van, crecimiento antinatural), nunca por la sangre. Mezcla de **grabado a buril** + **foil moderno de cartas coleccionables**. Cada carta parece una lámina de un grimorio que alguien iluminó con pan de oro y algo peor.

Tres palabras guía: **entintado, sagrado, equivocado.**

## 6.2 Sistema de color — tokens base

```
--umbral-vacio    #0A0B0F   /* fondo base: negro azulado, NUNCA negro puro */
--umbral-tinta    #14161D   /* paneles, superficies */
--umbral-pergamino#1B1D26   /* superficies elevadas / cartas dorso */
--umbral-hueso    #E8E2D0   /* texto/"papel": hueso viejo */
--umbral-ceniza   #8B8775   /* texto secundario, apagado */
--umbral-ocre     #C8923A   /* acento primario: oro viejo / luz de vela */
--umbral-ocre-alto#E6B45A   /* highlight del oro */
--umbral-sangre   #7A1420   /* peligro/jefe: granate apagado (NO rojo brillante) */
--umbral-verdin   #3E6B5A   /* secundario: cardenillo/cobre oxidado */
--umbral-fosforo  #A9F0D1   /* SOLO lo sobrenatural: foil, magia, espectral */
--umbral-violeta  #4A3B6B   /* arcano profundo, Cordura baja */
```

Reglas de color:
- Negro puro (`#000`) prohibido en superficies grandes (mata el rango dinámico del foil).
- `--umbral-fosforo` es el ÚNICO color "vivo"; reservado a lo arcano. Si todo brilla, nada brilla.
- Regla de dos acentos por pantalla: cálido (ocre) y frío (sangre/verdín) no dominan a la vez.
- La saturación general baja conforme desciendes (§6.3).

## 6.3 Paletas por Sima (la profundidad tiñe el mundo)

El descenso se *siente* porque el color vira:

| Sima | Umbrales | Atmósfera | Desvío de paleta |
|---|---|---|---|
| **Sima I — El Vestíbulo** | 1-3 | Penumbra de gabinete, polvo, velas | Base, ocres cálidos, contraste medio |
| **Sima II — Las Galerías** | 4-6 | Húmedo, cardenillo, agua negra | Verdín dominante, ocre apagándose, saturación −20% |
| **Sima III — El Fondo** | 7-8 | Carne y piedra, latido, fósforo enfermo | Violeta + fósforo + sangre, contraste alto, viñeta fuerte, saturación −35% salvo lo arcano |
| **Infinito — Bajo el Fondo** | 9+ | Lo que no debería verse | Casi monocromo desaturado roto por estallidos de fósforo; la orla devora la pantalla progresivamente |

## 6.4 Tipografía

Tres roles, emparejados con intención (el usuario gestiona licencias, §17):
- **Display** (logo "UMBRAL", nombres de jefe, titulares): blackletter/gótica moderna *legible* o serif display de altísimo contraste con ligaduras y personalidad. Uso muy restringido: solo titulares y nombres de jefe. Candidatas: una gótica humanizada o una serif "spooky-elegante" (no chillona).
- **Cuerpo / descripciones** (reliquias, arcanos, eventos, lore): serif humanista legible a tamaño pequeño (refuerza "papel de grimorio"). Candidata: una serif tipo *Spectral*.
- **Datos / puntuación**: grotesque o mono con **números tabulares** (`tabular-nums`) impecables, para que las cifras al saltar no "bailen". Los números son protagonistas. Peso 500-600 para los grandes.
- Escala 1.250 (major third), pesos intencionales (display 700, cuerpo 400, datos 500-600). Tracking ligeramente abierto en titulares display.

## 6.5 Anatomía de la carta (capas para 2.5D)

Cada carta es un sprite compuesto por capas a distinta "profundidad" (z fake), lo que habilita el parallax del tilt:

```
[ capa 5: glare/especular ]      (se mueve con el tilt)
[ capa 4: foil/holo overlay ]    (shader según acabado)
[ capa 3: marco entintado ]      (orla calcográfica + esquinas con rango/palo)
[ capa 2: ilustración ]          (la "lámina": rango+palo o reliquia)
[ capa 1: fondo de pergamino ]   (textura papel viejo, leve grano)
[ capa 0: sombra de contacto ]   (proyectada según tilt, vende el volumen)
```

- **Marco** distinto por tipo: carta de juego, reliquia, arcano, vale. Reconocible de un vistazo.
- **Indicadores de rareza** por color de orla y por acabado (§6.6).
- **Estado** (mejoras, sellos) se muestra con sellos/gemas pequeñas incrustadas en el marco, no con texto encima.

## 6.6 Shaders y acabados (el "parece 3D")

Cuatro técnicas sobre sprites planos. NADA es geometría 3D.

1. **Tilt en perspectiva (hover):** el sprite rota hacia el cursor mediante una matriz de perspectiva fake; las capas internas se desplazan en paralaje (la ilustración se mueve distinto que el marco). Da sensación de relieve y profundidad.
2. **Especular dinámico:** un highlight (glare) recorre la superficie según el ángulo del tilt. Vende el "material".
3. **Acabados por rareza (shader de superficie):**
   - *Normal:* mate, sin overlay.
   - *Foil:* gradiente iridiscente animado bajo el glare (interferencia de jabón).
   - *Holo:* patrón de difracción que cambia con el ángulo (arcoíris fragmentado).
   - *Polícromo (raras+):* foil + holo combinados, más intenso.
   - *Espectral:* emite `--umbral-fosforo`, con distorsión heat-haze y leve "respiración".
   - *Maldita:* aura `--umbral-sangre` que late; bordes que "sangran" tinta.
4. **Sombra de contacto dinámica:** proyectada según el tilt; al elevar la carta para puntuar, la sombra se separa (salto físico).

Parámetros expuestos por carta para que VFX/feel los module: intensidad de glare, velocidad de foil, fuerza de distorsión, color de aura.

## 6.7 La firma visual: el marco que respira

Elemento memorable único de UMBRAL. El tablero está enmarcado por una **orla calcográfica viva** (vegetación/anatomía imposible entintada) que reacciona al estado del juego:
- **En calma:** respira lento, casi imperceptible.
- **Cerca del objetivo:** se tensa, las ramas se crispan.
- **Crítico de puntuación:** pulsa con la cifra, supura `--umbral-fosforo` por las venas del grabado.
- **Jefe en pantalla:** la orla cobra vida según el jefe — se abren ojos que parpadean al unísono, mordiscos que crecen, raíces que invaden el tablero. Cada jefe tiene su "infección" de orla (§11.7).
- **Cordura baja (§10):** la orla se distorsiona, aparecen formas en los bordes que no están del todo ahí.

Esto vende el terror sin un solo jpeg de sangre. Es lo que ningún clon tiene.

## 6.8 VFX library (catálogo de efectos a implementar)

- **Pops de puntuación:** burbujas de número que saltan de cada carta (fichas en hueso, mult en sangre, ×mult en fósforo) con squash/stretch y arco.
- **Conteo:** el marcador grande cuenta hacia arriba con easing y "tick" sonoro; en críticos, ralentí + zoom.
- **Disparo de reliquia:** la reliquia se sacude, emite su número y una chispa del color de su tag.
- **Retrigger:** eco visual (la carta "fantasmea" cada re-disparo).
- **Destrucción de carta:** se entinta y se deshace en cuervos/polvo según contexto.
- **Foil/holo idle:** brillo sutil constante en cartas de rareza.
- **Partículas ambientales por Sima:** polvo (I), esporas/goteo (II), ceniza/fósforo flotante (III).
- **Transición de Umbral:** descenso (la cámara "cae"), la paleta vira a la siguiente Sima.
- **Entrada de jefe:** zoom cinematográfico, distorsión cromática breve, sub-grave, la orla se infecta.
- **Cordura:** viñeta que late, leve aberración cromática, "alucinaciones" (cartas falsas que se desvanecen).

Todo VFX tiene versión reducida bajo el toggle "Reducir efectos" (§18) sin perder legibilidad.

## 6.9 Inventario de pantallas (UI a diseñar)

Shell (React): **Menú principal** (con la orla viva de fondo) · **Selección de Recipiente** (carrusel con mecánica/lore de cada uno) · **Pantalla de seed/modo** · **Run en curso** (canvas Pixi + HUD React: velas, cordura, monedas, manos/descartes, objetivo, reliquias, consumibles) · **Mapa del Umbral** (nodos ramificados, ruta, preview de jefe) · **Tienda** · **Evento** (lámina + opciones) · **Recompensa** (draft 1 de N) · **Descanso/Santuario** · **Pantalla de jefe** (cinemática) · **Fin de run** (resumen, estadísticas, desbloqueos) · **Leaderboards** (categorías) · **Codex/Grimorio** (reliquias, jefes, cartas, lore) · **Logros** · **Ajustes** · **Perfil/Auth**.

HUD in-game debe ser legible y no tapar el tablero. La mano de cartas es el foco; todo lo demás orbita.

## 6.10 Suelo de calidad (innegociable)

- Responsive hasta móvil (MVP prioriza escritorio, pero no se rompe).
- Foco de teclado visible en todo el shell; navegación por teclado del menú.
- `prefers-reduced-motion` respetado en el shell; toggle "Reducir efectos" in-game.
- 60 fps estables en el juego en hardware medio; DPR con techo (máx 2); batching de sprites; atlas de texturas.
- Contraste de texto AA mínimo sobre sus fondos.


---

# 7. EL MOTOR DE PUNTUACIÓN (NÚCLEO — NÚMEROS EXACTOS)

> Lo más importante del documento. Se implementa primero (Bloque 3) con suite de tests antes de dibujar nada. Números = balanceo v1; ajustables solo con orden explícita. El espacio de builds y los breakpoints (§13.4) emergen de este motor; clavarlo es clavar el vicio.

## 7.1 El mazo

- 52 cartas: 4 palos × 13 rangos. Palos temáticos (ids neutros para el engine): `CALIZ`(♥), `LLAVE`(♦), `HUESO`(♣), `OJO`(♠).
- Rangos `2..10, J, Q, K, A`.
- **Fichas base por carta jugada:** número = su valor; `J/Q/K = 10`; `A = 11`.
- El mazo crece/cambia durante la run (augurios, eventos, reliquias, recipientes).

## 7.2 La mano (turno de combate)

Un nodo de combate da: **objetivo** de puntuación, nº de **manos** (jugadas) y nº de **descartes**. Hand size base = **8**.
- Seleccionas 1-5 cartas de las 8 en mano.
- Al **jugar**, el engine detecta el **mejor tipo de mano** dentro de las cartas jugadas (no de las 8).
- Solo las cartas que **forman parte del tipo** puntúan base (en una pareja, las 2 cartas; las demás seleccionadas no aportan fichas base salvo reliquias). Algunas reliquias hacen puntuar a TODAS las jugadas.
- **Descartar** tira las seleccionadas, repone del mazo (gasta 1 descarte), no puntúa.
- Tras jugar/descartar, repones hasta hand size barajando con el PRNG del estado (stream de reparto).
- Ganas en cuanto **acumulado ≥ objetivo**. Agotar manos sin llegar = apagas 1 vela (§9.5).

## 7.3 Fórmula de puntuación (orden estricto y determinista)

```
puntuaciónDeLaMano = floor( FICHAS_TOTAL × MULT_TOTAL )
```

**Pipeline de evaluación (orden FIJO, testeado):**

1. Detectar tipo de mano → cargar `fichasBase` y `multBase` (por tipo y NIVEL, §7.4).
2. `FICHAS = fichasBase`. `MULT = multBase`.
3. **Por cada carta que puntúa, en orden de izquierda→derecha en la zona jugada** (resolviendo retriggers, §7.6):
   a. `FICHAS += valorEnFichas(carta)`
   b. aplicar las mejoras **ADITIVAS** de la carta (Grabado +fichas, Marca +mult, Cristal +fichas, Piedra +fichas). **Los ×mult de mejora de carta (p.ej. Untado ×mult) NO se aplican aquí: se difieren al paso 5.**
   c. aplicar sellos de la carta (Ocre genera moneda, Sangre = retrigger, etc.).
   d. disparar hooks `onCardScored`/`onSuitScored`/`onRankScored` de reliquias afectadas (en orden de posición de reliquia).
4. Disparar hooks `onHandPlayed` de reliquias (sumas de fichas y de mult), **en orden de posición de reliquia izquierda→derecha**.
5. Aplicar **TODOS los ×mult**, en orden **izquierda→derecha**: primero los ×mult de **mejoras de carta** (Untado, en orden de la zona jugada; un re-disparo aplica su ×mult de nuevo), luego los ×mult de **reliquias** (en orden de posición de reliquia). Ningún ×mult se aplica antes de este paso.
6. `afterScore` hooks (efectos que leen el total, p.ej. "+1 moneda por cada 100 de puntuación").
7. `puntuación = floor(FICHAS × MULT)`; acumular.

**Principio de oro:** primero TODAS las sumas a fichas, luego TODAS las sumas a mult, luego TODOS los ×mult. El **orden de las reliquias** (reordenable por el jugador, acción `REORDER_RELICS`) cambia el resultado cuando hay ×mult condicionales → esto es una palanca de optimización deliberada (skill expression).

## 7.4 Tipos de mano — base por nivel

Cada tipo tiene NIVEL (inicia Nv.1), sube con **Sellos** (§11.3). Cada nivel suma a fichas base y mult base.

| Mano | Fichas Nv.1 | Mult Nv.1 | +Fichas/nivel | +Mult/nivel |
|---|---|---|---|---|
| Carta alta | 5 | 1 | +10 | +1 |
| Pareja | 10 | 2 | +15 | +1 |
| Doble pareja | 20 | 2 | +20 | +1 |
| Trío | 30 | 3 | +20 | +2 |
| Escalera | 30 | 4 | +30 | +3 |
| Color | 35 | 4 | +15 | +2 |
| Full | 40 | 4 | +25 | +2 |
| Póker | 60 | 7 | +30 | +3 |
| Escalera de color | 100 | 8 | +40 | +4 |
| Escalera real | 100 | 8 | +40 | +4 |

**Manos especiales de UMBRAL (desbloqueables, vía Sellos raros / recipientes / arcanos):**
| Mano | Cómo | Fichas Nv.1 | Mult Nv.1 |
|---|---|---|---|
| **Quinteto** (5 iguales) | requiere cartas duplicadas en mazo | 120 | 12 |
| **Quinteto de color** (5 iguales mismo palo) | duplicados + palo | 160 | 16 |
| **Hilera Negra** (5 cartas del mismo palo Y consecutivas alternando color imposible) | recipiente/arcano | 140 | 14 |

> Manos especiales NO en MVP-core; entran en Bloque de contenido extendido. El engine las soporta desde el diseño (detección extensible).

## 7.5 Hooks y orden de evaluación (referencia para el DSL)

Orden global por evento de juego: `onRunStart → onUmbralStart → onCombatStart → [bucle de manos: beforeScore → (onCardScored×n con retriggers) → onHandTypeDetected → onHandPlayed → ×mult → afterScore] → onCombatEnd → onUmbralEnd`. Dentro de cada hook con múltiples reliquias, **orden = posición izquierda→derecha** del jugador. Esto se documenta como contrato y se testea exhaustivamente.

## 7.6 Retriggers (sistema de "re-disparo")

Un retrigger hace que una carta vuelva a puntuar (repite pasos 3a-3d). Fuentes: sello Sangre, reliquias de retrigger, mejoras. Reglas:
- Los retriggers se resuelven **inmediatamente tras el disparo original** de esa carta, antes de pasar a la siguiente.
- Retriggers de retriggers permitidos pero con **tope de seguridad** (máx 20 disparos por carta) para evitar bucles infinitos por sinergia rota (un build "infinito" se capa aquí, no peta).
- Cada re-disparo cuenta como evento `onCardScored` completo (las reliquias que reaccionan a cartas puntuadas se benefician → sinergia retrigger×reactivas, un arquetipo entero).

## 7.7 Mejoras de carta y sellos (resumen; catálogo en §11.4)

Una carta lleva como mucho UNA mejora + UN sello (independientes).
- **Mejoras:** Grabado (+30 fichas) · Marca (+4 mult) · Untado (×1.5 mult) · Dorado (+3 monedas si queda en mano al fin de ronda) · Cristal (+50 fichas, frágil 1/5) · Piedra (no tiene rango/palo; +50 fichas planas, no forma manos) · Espejo (copia el rango de la carta a su izquierda al puntuar).
- **Sellos:** Ocre (+1 moneda al jugarla) · Sangre (retrigger ×1) · Verdín (al descartarla, genera 1 arcano) · Violeta (al jugarla, −2 Cordura, +6 mult) · Dorado-sello (se queda en mano tras jugar, no se descarta).

## 7.8 Ejemplo trabajado (test de oro, obligatorio)

Pareja de Reyes: K♥ con **Grabado**, K♦ normal + 3 basura (no puntúan). Pareja a **Nv.2**. Reliquias en orden: **Catalizador** (+4 mult), **Espejo Negro** (×1.5 mult).

```
Fichas base Pareja Nv.2 = 10 + 15 = 25
Cartas que puntúan: K(10) + K(10) = 20 ; +30 Grabado = 50
FICHAS_TOTAL = 25 + 50 = 75

Mult base Pareja Nv.2 = 2 + 1 = 3
+ Catalizador (+4)  → 7
× Espejo Negro (×1.5) → 10.5
MULT_TOTAL = 10.5

Puntuación = floor(75 × 10.5) = floor(787.5) = 787
```

**Segundo test de oro (retrigger):** misma mano pero K♥ además lleva **sello Sangre** (retrigger ×1):
```
K♥ puntúa, retrigger → puntúa otra vez. Cada disparo: +10 fichas y +30 Grabado.
Fichas: base 25 + [K♥:10+30] + [K♥ retrigger:10+30] + [K♦:10] = 25+40+40+10 = 115
Mult: base 3 +4 (Catalizador) = 7, ×1.5 = 10.5
Puntuación = floor(115 × 10.5) = floor(1207.5) = 1207
```

**Tercer test de oro (orden de ×mult — blinda la regla):** Pareja de Damas con una carta **Marcada** (+4 mult, aditivo) y otra **Untada** (×1.5, diferido al paso 5). Demuestra que el ×1.5 se aplica **después** de sumar el +4, no antes:
```
Fichas base Pareja Nv.1 = 10 ; +Q(10) +Q(10) = 30
Mult base 2 + 4 (Marca, paso 3b) = 6
× 1.5 (Untado, PASO 5) → 9          (si se aplicara antes del +4: 2×1.5=3, +4=7 → mal)
Puntuación = floor(30 × 9) = 270     (la regla incorrecta daría floor(30 × 7) = 210)
```

Los tres son tests unitarios obligatorios en Bloque 3, junto a casos límite: A como 1 y 11 en escaleras (A-2-3-4-5 y 10-J-Q-K-A), color vs escalera, full vs trío vs doble pareja, Quinteto, tope de retrigger, orden de reliquias afecta ×mult condicionales.


---

# 8. LOS RECIPIENTES (CLASES JUGABLES)

El mayor multiplicador de rejugabilidad. Un **Recipiente** es quien desciende: define mecánica única, mazo inicial, reliquia inicial, sesgo del pool de ofertas y estilo de juego. 6 en v1. Cada uno se desbloquea progresando (salvo el primero). Cada uno tiene su escalera de 20 Velos (§12.1) → 120 cumbres distintas.

> Diseño: cada Recipiente debe sentirse un **juego distinto**, no un modificador de inicio. Su mecánica toca el motor de forma única.

## 8.1 EL HERALDO (inicial, equilibrado)
- **Fantasía:** el que descendió primero. Póker puro, sin trucos. La base limpia para aprender.
- **Mecánica única — "Eco del Descenso":** cada vez que repites el mismo tipo de mano dos veces seguidas, ganas +1 mult permanente para ese tipo durante el combate (premia el foco).
- **Mazo inicial:** 52 estándar limpio.
- **Reliquia inicial:** *Estandarte* (Común+) — +2 mult; +1 adicional por cada Umbral superado.
- **Sesgo de pool:** neutro (todo el pool disponible).
- **Recipiente-exclusivas (5):** Heraldo de Hierro (+10 fichas por mano repetida), Voz del Heraldo (el Eco da +2 en vez de +1), Marcha (cada 3 manos jugadas, +1 mano este combate), Pendón Roto (manos distintas dan +3 mult la primera vez de cada tipo), Trompeta (la primera mano de cada combate vale ×2).

## 8.2 LA VIDENTE (suerte / control de RNG)
- **Fantasía:** lee el porvenir en las cartas. Domestica la suerte.
- **Mecánica única — "Premonición":** ve siempre las **3 cartas superiores** del mazo y puede **enterrar** una (mandarla al fondo) 1 vez por combate gratis (acciones SCRY). Reliquias de Vidente potencian predecir/reordenar.
- **Mazo inicial:** 44 cartas (mazo más fino → más control sobre qué sale).
- **Reliquia inicial:** *Tercer Ojo* (Poco común) — al jugar la carta que estaba en el tope visible, +30 fichas.
- **Sesgo de pool:** más reliquias de scry/draw/varianza; más Augurios en tienda.
- **Exclusivas (5):** Augur (entierra 2/combate), Carta Marcada (la carta superior visible da +4 mult al jugarla), Hilo del Destino (si juegas 3 cartas que viste venir, ×2 mult), Ojo Abierto (ves 5 cartas superiores; −1 vela máx), Reescritura (1/combate, baraja a tu favor: ordena tu mano).

## 8.3 EL USURERO (economía)
- **Fantasía:** todo tiene precio, hasta la cordura. El dinero es poder.
- **Mecánica única — "Capital":** las monedas puntúan. `+1 ficha por cada moneda` en cada mano (base; reliquias lo amplifican). Interés mejorado (+1/4 en vez de +1/5). Pero los objetivos sienten un +5%: necesitas el motor económico para llegar.
- **Mazo inicial:** 52 estándar + empiezas con **20 monedas**.
- **Reliquia inicial:** *Libro de Cuentas* (Poco común) — interés sin tope; +1 moneda por combate.
- **Sesgo de pool:** reliquias de economía; tiendas con más opciones y rerolls baratos.
- **Exclusivas (5):** Préstamo Usurario (×1 mult por cada 25 monedas), Cofre Sin Fondo (+50 monedas, pero −10 al entrar a cada Umbral), Avaricia (no puedes vender reliquias, pero todas cuestan −40%), Moneda de Hueso (cada moneda gastada en tienda → +2 fichas permanentes esta run), Inversión (al fin de cada Umbral, duplica tus monedas si no compraste nada ese Umbral).

## 8.4 EL COLECCIONISTA (mejora de cartas / deck-building)
- **Fantasía:** cataloga cada carta como una pieza preciosa. Construye un mazo perfecto.
- **Mecánica única — "Catálogo":** ganas bonos por **completar palos/rangos** mejorados. Por cada palo del que tengas ≥5 cartas con mejora, +20 fichas a todas las manos. Empieza con herramientas de mejora.
- **Mazo inicial:** 52 estándar, pero **4 cartas ya con Grabado** (una por palo).
- **Reliquia inicial:** *Vitrina* (Poco común) — +10 fichas por cada carta con mejora en el mazo (cuenta al inicio del combate).
- **Sesgo de pool:** más Augurios y reliquias de mejora/sellos; descansos ofrecen mejoras mejores.
- **Exclusivas (5):** Conservador (las mejoras Cristal nunca se quiebran), Espécimen Raro (cartas Espejo dan +20 fichas extra), Colección Completa (si todas las cartas en mano puntúan, ×2 mult), Restaurador (1/Umbral, copia una mejora de una carta a otra), Pieza de Museo (la carta más mejorada da +60 fichas).

## 8.5 LA BESTIA (agresión / descarte)
- **Fantasía:** no piensa, devora. Juega rápido, arriesga todo.
- **Mecánica única — "Frenesí":** descartes casi ilimitados; cada descarte acumula **+1 a un contador de Frenesí** que da +1 mult por punto en tu próxima mano jugada (se gasta al jugar). Pero solo tienes **3 manos** por combate (menos jugadas, más caza de la mano perfecta).
- **Mazo inicial:** 52 estándar; **+3 descartes base** (6 total), **−1 mano** (3 total).
- **Reliquia inicial:** *Colmillo* (Poco común) — cada descarte da +1 ficha permanente esta run (escaladora natural).
- **Sesgo de pool:** reliquias de descarte/escaladoras/agresión.
- **Exclusivas (5):** Hambre Voraz (Frenesí da +2 por punto), Mandíbula (descartar 5 a la vez → +30 fichas a la próxima mano), Instinto (si juegas una mano sin descartar antes, ×2 mult), Rastro de Sangre (cada carta destruida → +1 descarte este combate), Saciedad (al matar el objetivo con manos de sobra, +mult permanente por cada mano no usada).

## 8.6 EL PROFANO (espectral / Cordura / alto riesgo)
- **Fantasía:** abrazó lo de abajo. El poder llega rompiéndose por dentro.
- **Mecánica única — "Comunión":** interactúa fuerte con **Cordura** (§10). A menor Cordura, mayor mult global (escala de bonificación, §10.3), pero los jefes pegan más fuerte y aparecen más alucinaciones. Empieza con reliquias/cartas espectrales.
- **Mazo inicial:** 48 cartas + **2 cartas con sello Violeta** (−Cordura, +mult).
- **Reliquia inicial:** *Sello Roto* (Espectral) — +1 mult global por cada 5 puntos de Cordura perdidos.
- **Sesgo de pool:** reliquias Espectrales/Malditas mucho más frecuentes; Conjuros en tienda.
- **Exclusivas (5):** Voz Interior (con Cordura <30, ×2 mult), Ofrenda (sacrifica 10 Cordura → +1 reliquia espectral aleatoria), Abismo (las reliquias Malditas no aplican su penalización, pero −20 Cordura al obtenerlas), Susurro (cada alucinación jugada como si fuera real → +50 fichas), Disolución (con 0 Cordura no mueres: entras en "Frenesí del Abismo", ×4 mult pero pierdes 1 vela por combate).

## 8.7 Resumen comparativo (para selección de Recipiente)

| Recipiente | Eje | Mazo inicio | Dificultad de aprendizaje | Techo de poder |
|---|---|---|---|---|
| Heraldo | Foco/repetición | 52 limpio | ★☆☆ | Alto |
| Vidente | Control de suerte | 44 fino | ★★☆ | Alto |
| Usurero | Economía | 52 + 20 oro | ★★☆ | Muy alto |
| Coleccionista | Mejora de cartas | 52 + 4 grabados | ★★☆ | Muy alto |
| Bestia | Descarte/agresión | 52, +desc −mano | ★★★ | Explosivo |
| Profano | Cordura/riesgo | 48 + violeta | ★★★ | El más alto y volátil |

Desbloqueo: Heraldo de inicio; cada otro se gana con hitos (§12.2). El recipiente elegido se incluye en el action log y forma parte de la reproducción por seed (afecta reglas → INV-3).


---

# 9. ESTRUCTURA DE RUN (SIMAS, UMBRALES, MAPA, INFINITO)

## 9.1 La run

Una run completa = descender **8 Umbrales**, agrupados en **3 Simas**:
- **Sima I — El Vestíbulo:** Umbrales 1-3.
- **Sima II — Las Galerías:** Umbrales 4-6.
- **Sima III — El Fondo:** Umbrales 7-8.
Vencer el Jefe del Umbral 8 = **victoria**. Después, **Modo Infinito** (§9.6) para perseguir puntuación. El cruce de Sima es un evento atmosférico (paleta vira, dificultad escala).

## 9.2 El mapa de cada Umbral (ramificado)

Generado determinista desde la seed (stream de mapa). ~10-14 nodos en 4-6 filas que convergen en el **Jefe** (fila final). Aristas hacia 1-3 nodos de la fila siguiente, garantizando ≥1 camino completo. El jugador elige ruta (acción `CHOOSE_NODE`).

| Nodo | Símbolo | Peso base | Función |
|---|---|---|---|
| Combate | ⚔ | 40% | Ronda de puntuación estándar. |
| Élite | ☠ | 12% | Combate duro; reliquia garantizada (≥poco común); +Cordura coste. No en fila 1. |
| Tienda | ⌂ | 12% | §11.8. |
| Evento | ? | 16% | Decisión con consecuencias (§11.9). |
| Tesoro | ✦ | 7% | Reliquia/arcano gratis, o cofre con riesgo. |
| Descanso | ☾ | 6% | Curar 1 vela / mejorar (subir nivel de mano, añadir mejora) / depurar carta. |
| Santuario | ⛧ | 4% | Nodo arcano: ofrenda de Cordura por poder, o purgar una maldición. (§10.5) |
| Jefe | ♛ | fila final | El jefe del Umbral. |

Reglas de generación: nunca dos Tiendas seguidas en un mismo camino; Élite a partir de fila 2; el nodo previo al Jefe es Descanso o Tienda o Santuario (alivio antes del pico); cada Umbral garantiza al menos 1 Tienda accesible y 1 Élite accesible en alguna ruta.

## 9.3 Objetivos de puntuación (escalada exponencial)

`objetivo(umbral, tipoNodo)` con varianza determinista ±5%. Curva ~×2.4 por Umbral (la potencia exponencial fuerza escalar el motor, no solo sumar).

| Umbral | Combate | Élite | Jefe |
|---|---|---|---|
| 1 | 300 | 450 | 800 |
| 2 | 750 | 1.150 | 1.900 |
| 3 | 1.800 | 2.700 | 4.400 |
| 4 | 4.200 | 6.300 | 10.000 |
| 5 | 9.500 | 14.000 | 22.000 |
| 6 | 21.000 | 31.000 | 48.000 |
| 7 | 46.000 | 68.000 | 105.000 |
| 8 | 100.000 | 150.000 | 230.000 |

Recursos por combate (base, modificables): Manos **4** · Descartes **3** · Hand size **8**. (Recipientes y reliquias alteran estos.)

## 9.4 Preview de jefe

Al entrar a un Umbral, el Jefe de su fila final se **revela** (nombre + pista de su modificador + "infección" de orla en preview). Permite preparar el mazo/ruta. La habilidad de prepararse compensa la suerte de qué jefe toca (§2.2). El jefe se extrae de un **pool por Sima** (no siempre el mismo) → variedad entre runs (§11.7).

## 9.5 Velas (vidas)

- Empiezas con **3 velas**. Perder un combate (no alcanzar objetivo) **apaga 1 vela** y permite seguir el mapa (re-intentas el nodo o sigues, según diseño: el nodo se marca superado a coste de vela; el jugador continúa). **0 velas = muerte (fin de run).**
- Razón de diseño: las velas dan margen y refuerzan el terror del "se apagan una a una". El Descanso recupera 1. Algunos Velos altos reducen velas iniciales.

## 9.6 Modo Infinito (Bajo el Fondo)

Tras vencer el Umbral 8, el jugador puede **continuar descendiendo**. Umbrales 9+:
- Objetivos crecen **exponencial sin techo** (~×2 por Umbral desde el 8).
- Paleta "Bajo el Fondo" (§6.3): casi monocromo roto por fósforo; la orla devora la pantalla.
- Jefes infinitos: variantes "corruptas" de los jefes del pool con modificadores apilados.
- Cordura más volátil; alucinaciones frecuentes.
- **Objetivo:** ver hasta qué Umbral aguantas y con qué puntuación total. Es la métrica de leaderboard "Profundidad" + "Puntuación infinita". Aquí viven las cientos de horas de optimización de los jugadores hardcore.

## 9.7 Recompensas de combate

Tras ganar: monedas (§13.3) + **draft de 1 de 3** recompensas (reliquia, arcano, o "saltar" por +monedas/+Cordura). Élite incluye siempre 1 reliquia ≥poco común. Reliquias de "más opciones" amplían el draft a 1 de 4/5.

---

# 10. CORDURA — EL SISTEMA DE HORROR/RIESGO GLOBAL

Sistema transversal que da identidad de terror y una palanca de riesgo/recompensa que el jugador acciona (sirve a §2.2: suerte/riesgo elegidos).

## 10.1 Qué es

La **Cordura** es un recurso de run (0-100, empieza en 100). Desciende por: jefes, eventos, sellos Violeta, reliquias Malditas, Santuarios, profundidad (en Infinito baja sola). Sube por: Descansos, ciertos eventos, reliquias específicas. **No mata por sí sola** (salvo combos como El Préstamo): es una palanca, no una barra de vida.

## 10.2 Efectos por umbral de Cordura

| Cordura | Estado | Efectos |
|---|---|---|
| 70-100 | **Lúcido** | Sin penalización ni bono. RNG normal. |
| 40-69 | **Inquieto** | Leves alucinaciones cosméticas (orla); RNG de reparto ligeramente más swingy; +pequeño bono de mult (escala §10.3). |
| 15-39 | **Perturbado** | Alucinaciones mecánicas: ocasionalmente aparece en mano una **carta falsa** que, si la juegas, se desvanece sin puntuar (pero algunas reliquias del Profano la aprovechan); mayor bono de mult; jefes +10% objetivo. |
| 1-14 | **Al Borde** | Alucinaciones frecuentes; gran bono de mult; jefes +20% objetivo; tienda muestra ofertas "equivocadas" (a veces mejores). |
| 0 | **Abismo** | Normalmente nada extra salvo que reliquias lo exploten (Profano: Disolución → ×4 mult, −1 vela/combate). El borde del poder roto. |

## 10.3 Bonificación de mult por Cordura baja (la zanahoria del riesgo)

`bonoMultCordura = floor((100 - cordura) / 10)` → de 0 (lúcido) a +10 mult (abismo), aplicado como **suma plana de mult** en el paso 4 del pipeline. El Profano multiplica esta relación (§8.6). Esto convierte "arriesgar la cordura" en poder tangible, equilibrado por jefes más duros y alucinaciones.

## 10.4 Alucinaciones (la suerte que da miedo)

Con Cordura <40, el stream de reparto puede inyectar **cartas falsas** (visualmente sutiles: bordes que tiemblan, fósforo tenue). Jugarlas no puntúa (se desvanecen). Mitigación: aprender a detectarlas (tells visuales/sonoros) es skill; algunas reliquias las revelan o las convierten en poder. Deterministas respecto a la seed (re-simulables).

## 10.5 Santuarios (⛧)

Nodo dedicado a la Cordura:
- **Ofrenda:** sacrifica X Cordura → reliquia espectral / poder.
- **Purga:** recupera Cordura / elimina una maldición de una reliquia Maldita (a coste de oro).
- **Pacto:** opciones de alto riesgo (gana mucho, baja mucho la Cordura).


---

# 11. CONTENIDO MASIVO

> Todo vive en `packages/content` como data tipada + efectos declarativos (§5.4). Cada pieza: `id`, `name`, `rarity`, `cost`, `flavor` (grimorio), `tags`, `unlock`, `hooks`. Los números son balanceo v1. **60 reliquias generales + 30 exclusivas de Recipiente (§8) = 90 reliquias, todas con personalidad propia (cero relleno).** Más arcanos, vales, jefes, eventos. Filosofía: 90 reliquias distintas y memorables valen más que 150 con gemelas; cada una hace algo que ninguna otra hace igual.

## 11.1 RELIQUIAS (catálogo de 60 generales)

Rarezas: Común (C), Poco común (PC), Rara (R), Espectral (E), Maldita (M), Legendaria (L). Slots base: **5** (ampliables). Cada una con `id`, flavor de grimorio y efecto declarativo (§5.4). Curadas para que **cada una sea distinta** y cada arquetipo (§13.4) tenga ≥5-6 apoyos (sumando las 30 de Recipiente, sobra).

### 11.1.a Mult plano (6)
1. **Catalizador** (C) — +4 mult.
2. **Letanía** (C) — +1 mult por cada carta jugada esta mano.
3. **Tridente** (C) — +12 mult si juegas exactamente 3 cartas.
4. **Mano Abierta** (C) — +2 mult por cada carta NO jugada que quede en mano.
5. **Brasa** (C) — +3 mult; +1 más si es la 1ª mano del combate.
6. **Yesca** (C) — +4 mult; +2 extra si tu Cordura es <70.

### 11.1.b Fichas plano (6)
7. **Lastre de Plomo** (C) — +50 fichas.
8. **Reliquia del Avaro** (C) — +2 fichas por cada moneda (máx +100).
9. **Costra** (C) — +20 fichas; +20 más si la mano contiene una figura (J/Q/K).
10. **Ladrillo** (C) — +40 fichas planas, siempre.
11. **Ceniza Compacta** (C) — +10 fichas por cada carta con mejora en la mano.
12. **Piedra de Amolar** (C) — +25 fichas; +5 fichas permanentes cada vez que mejoras una carta.

### 11.1.c Condicionales por palo (4) — escaladoras por palo, cada una distinta
13. **Osario Mayor** (PC) — cada `HUESO`(♣) jugado: +20 fichas y +1 mult.
14. **Corazón Negro** (PC) — cada `CALIZ`(♥) jugado: +3 mult.
15. **Cerrajero** (PC) — cada `LLAVE`(♦) jugado: +25 fichas.
16. **Vigía** (PC) — cada `OJO`(♠) jugado: +4 mult.

### 11.1.d Condicionales por tipo de mano (6)
17. **Gemelo** (C) — +8 mult con Pareja o Doble pareja.
18. **Trinidad** (C) — +10 mult con Trío.
19. **Serpiente** (PC) — +6 mult con Escalera; +12 si es de 5 cartas.
20. **Vitral** (PC) — +30 fichas y +4 mult con Color.
21. **Banquete** (PC) — +40 fichas con Full.
22. **Monarca** (R) — ×2 mult con Full, Póker, Escalera de color o Real.

### 11.1.e Composición / rango (3)
23. **Corte Real** (PC) — cada figura (J/Q/K) jugada: +30 fichas.
24. **As en la Manga** (PC) — cada As jugado: +20 fichas y +2 mult.
25. **Cuatro Palos** (R) — si juegas los 4 palos en una mano: +60 fichas y +15 mult.

### 11.1.f Retrigger (4)
26. **Eco Hueco** (PC) — la 1ª carta puntuada se re-dispara 1 vez.
27. **Cámara de Ecos** (R) — todas las cartas con mejora se re-disparan 1 vez.
28. **Reverberación** (R) — las figuras (J/Q/K) se re-disparan 1 vez.
29. **Resonancia Espectral** (E) — las cartas con sello se re-disparan 2 veces.

### 11.1.g ×Multiplicador (5)
30. **Espejo Negro** (R) — ×1.5 mult.
31. **Eclipse** (R) — ×0.5 mult, ×2 fichas (habilita builds de fichas puras).
32. **Luna Sangrante** (R) — ×2 mult si tu Cordura es <50.
33. **Convergencia** (R) — ×mult = 1 + (nº de reliquias ×mult / 4).
34. **Sístole** (R) — ×3 mult en la 1ª mano del combate; las demás ×1.

### 11.1.h Escaladoras (5) — crecen durante la run
35. **Sanguijuela** (PC) — +1 mult permanente cada vez que juegas una Pareja.
36. **Crónica** (R) — +2 fichas permanentes cada vez que descartas (sin tope).
37. **Glotón** (R) — +3 fichas permanentes por cada carta jugada (sin tope).
38. **Devorador** (E) — +0.2 ×mult permanente por cada carta destruida (cualquier fuente).
39. **Vendetta** (R) — +4 mult permanente por cada jefe vencido.

### 11.1.i Cambia-motor (5)
40. **Tercera Mano** (R) — +1 mano por combate.
41. **Quinta Carta** (R) — hand size +1 (9 cartas en mano).
42. **Comodín** (R) — una carta basura por mano cuenta como el rango que elijas (forja la mejor mano).
43. **Igualador** (R) — todas las cartas valen 10 fichas base (sube las bajas, baja As/figuras).
44. **Memoria** (R) — repetir la última mano jugada da +20 fichas, acumulativo.

### 11.1.j Espectrales (5) — alto riesgo
45. **Ojo que No Duerme** (E) — ves la carta superior del mazo siempre; −1 vela máxima.
46. **Simbiosis** (E) — ×mult = 1 + (nº de reliquias Espectrales / 2).
47. **Hambre** (E) — ×2 mult; al final de cada combate destruye 1 carta aleatoria de tu mano.
48. **Reloj Detenido** (E) — la 1ª mano del combate ×3; las demás ×0.75.
49. **Eco del Vacío** (E) — con Cordura <20, todas las manos ×2 mult.

### 11.1.k Malditas (5) — poder + penalización
50. **Pacto de Plomo** (M) — +100 fichas; −1 mano por combate permanentemente.
51. **Corona de Espinas** (M) — ×3 mult; pierdes 5 Cordura por combate.
52. **Cadena** (M) — +12 mult; no puedes vender ni descartar reliquias.
53. **Diezmo** (M) — ×2 mult; pierdes el 20% de tus monedas al final de cada Umbral.
54. **Sacrificio** (M) — +20 mult; al inicio de cada combate destruyes 1 carta aleatoria de tu mazo (¡se reduce!).

### 11.1.l Legendarias (6) — definen build, difíciles de obtener
55. **Corazón del Abismo** (L) — ×mult = 1 + (Cordura perdida / 20). Define builds de Profano.
56. **El Contable Perfecto** (L) — +1 ficha por cada moneda, sin tope; interés sin tope. Define economía.
57. **Caleidoscopio** (L) — cada carta jugada cuenta como el palo que más te convenga esa mano (palo único trivial).
58. **Eternidad** (L) — los retriggers de tus reliquias se disparan 1 vez más cada uno.
59. **El Coleccionista Supremo** (L) — +5 fichas por CADA carta de tu mazo (no solo las jugadas).
60. **Sin Fondo** (L) — elimina el techo de retrigger (¡cuidado!); pero −1 vela máxima. Builds infinitos controlados.

> **Total: 60 reliquias generales + 30 exclusivas de Recipiente (§8) = 90.** Cada arquetipo (§13.4) tiene ≥5-6 reliquias de apoyo entre estas 60, y las 30 de Recipiente añaden apoyo temático. Si en balanceo (§13) una reliquia resulta "muerta" (nunca elegida) o "rota" (siempre gana), se rediseña — no se añade relleno para inflar la cuenta.

## 11.2 ARCANOS — "Augurios" (modifican cartas) · un uso · slots base 2
- **Augurio del Grabador** — Grabado (+30 fichas) a 1 carta.
- **Augurio de la Marca** — Marca (+4 mult) a 1 carta.
- **Augurio del Unto** — Untado (×1.5 mult) a 1 carta.
- **Augurio del Oro** — 2 cartas → Doradas.
- **Augurio del Cambio** — cambia el palo de hasta 3 cartas.
- **Augurio del Ascenso** — +1 rango a hasta 3 cartas.
- **Augurio del Descenso** — −1 rango a hasta 3 cartas (para escaleras a medida).
- **Augurio del Vacío** — destruye hasta 2 cartas (depurar mazo).
- **Augurio del Doble** — duplica 1 carta.
- **Augurio del Sello** — añade un sello (Ocre/Sangre/Verdín/Violeta) a 1 carta.
- **Augurio de Cristal** — Cristal (+50 fichas, frágil) a 1 carta.
- **Augurio de Piedra** — convierte 1 carta en Piedra (+50 fichas planas, sin rango/palo).
- **Augurio del Espejo** — convierte 1 carta en Espejo.
- **Augurio del Igualar** — iguala el rango de hasta 3 cartas al de una elegida (forja Tríos/Pókers).

## 11.3 ARCANOS — "Sellos" (suben nivel de manos = puntos base)
Uno por tipo de mano (sube +1 nivel ese tipo): Sello de la Carta Alta, de la Pareja, de la Doble, del Trío, de la Escalera, del Color, del Full, del Póker, de la Escalera de Color, de la Real. + **Sellos raros**: Sello del Quinteto (desbloquea/sube Quinteto), Sello Universal (sube +1 a TODAS las manos, raro y caro).

## 11.4 ARCANOS — "Conjuros" (espectrales, un uso, riesgo)
- **Conjuro de Sangre** — −5 Cordura; +30 mult a la próxima mano.
- **Conjuro del Doble Filo** — destruye 1 carta aleatoria; +1 reliquia espectral aleatoria.
- **Conjuro del Vidente** — ve y reordena tus próximas 5 cartas.
- **Conjuro de la Carne** — convierte 3 cartas en el mismo rango (forja Tríos), −3 Cordura.
- **Conjuro del Olvido** — elimina una maldición de una reliquia Maldita, −10 Cordura.
- **Conjuro del Abismo** — pon tu Cordura a 0; recibe una reliquia Legendaria aleatoria (¡riesgo máximo!).
- **Conjuro de la Ofrenda** — sacrifica una reliquia; recibe 2 reliquias de rareza superior.

## 11.5 VALES (mejoras permanentes de la run) · se compran en tienda, no ocupan slot
- **Vale del Reroll** — rerolls de tienda −1 coste permanente. (Apilable, decreciente.)
- **Vale del Mercader** — todo en tienda −15%.
- **Vale de la Abundancia** — +1 ítem en cada tienda.
- **Vale de la Mano** — +1 mano por combate permanente.
- **Vale del Descarte** — +1 descarte por combate permanente.
- **Vale de la Carta** — hand size +1 permanente.
- **Vale de la Reliquia** — +1 slot de reliquia.
- **Vale del Arcano** — +1 slot de arcano.
- **Vale de la Suerte** — sube la calidad media de las ofertas (mejor rareza ponderada).
- **Vale de la Vela** — +1 vela máxima.
- **Vale de la Cordura** — Cordura máxima +20.
- **Vale del Interés** — tope de interés +5.
- **Vale del Vidente** — ves siempre 1 carta superior (para todos los recipientes).
- **Vale de la Fortuna** — el draft de recompensa siempre incluye 1 reliquia.
- **Vale de la Profundidad** (Infinito) — reduce el escalado de objetivos un 10% (solo Infinito).


## 11.6 MEJORAS Y SELLOS DE CARTA (detalle)
**Mejoras** (una por carta): Grabado (+30 fichas) · Marca (+4 mult) · Untado (×1.5 mult) · Dorado (+3 monedas si queda en mano al fin de ronda) · Cristal (+50 fichas, 1/5 se quiebra) · Piedra (+50 fichas planas, sin rango/palo, no forma manos) · Espejo (al puntuar, copia el rango de la carta a su izquierda).
**Sellos** (uno por carta, independiente de mejora): Ocre (+1 moneda al jugarla) · Sangre (retrigger ×1) · Verdín (al descartarla → genera 1 augurio) · Violeta (al jugarla: −2 Cordura, +6 mult) · Dorado-sello (no se descarta tras jugar; permanece en mano).

## 11.7 JEFES (pool por Sima — rotación entre runs)

Cada jefe: nombre, lore atmosférico, **modificador mecánico** (cambia el combate), **tell** (visual/sonoro) e **infección de orla** (§6.7). Cada Umbral extrae un jefe del pool de su Sima (no repite en la misma run). Esto da variedad: dos runs ven jefes distintos. **24 jefes** (8 por Sima) + 2 secretos.

### Sima I — El Vestíbulo (jefes de Umbrales 1-3)
1. **EL VELADO** — *"No tiene cara, pero sabe la tuya."* Mod: el 1er palo que juegues queda **silenciado** (sus cartas no dan fichas) el resto del combate. Tell: figura de tela que se acerca cada mano. Orla: telas que cubren los bordes.
2. **LA DENTELLADA** — *"Cuenta tus dedos."* Mod: −1 mano; figuras (J/Q/K) valen mitad de fichas. Tell: mordiscos crecientes en el marco. Orla: dientes.
3. **EL POLVO** — *"Todo lo que tocas envejece."* Mod: cada carta jugada pierde 5 fichas base acumulativo ese combate. Tell: las cartas se "encanecen". Orla: ceniza que cae.
4. **EL CORO MUDO** — *"Bocas sin sonido."* Mod: no puedes descartar las primeras 2 manos. Tell: bocas cosidas en la orla. Orla: labios sellados.
5. **LA POLILLA** — *"Come la luz."* Mod: pierdes 1 vela de luz visual (pantalla más oscura, cosmético) y −10% objetivo... mentira: +15% objetivo oculto hasta media vida. Tell: polillas. Orla: alas.
6. **EL CERROJO** — *"Algo quiere quedarse dentro."* Mod: 1 carta aleatoria de tu mano queda "trabada" (no jugable) cada mano. Tell: cadenas. Orla: cerraduras.
7. **EL VAHO** — *"Respira lo que no deberías."* Mod: −5 Cordura por mano jugada. Tell: niebla verdín. Orla: vapor.
8. **EL PRIMER ROSTRO** — *"El que te recibió."* Mod (jefe-tutorial duro): objetivo alto pero sin truco; recompensa extra. Tell: una cara tallada que sonríe al fallar. Orla: madera agrietada.

### Sima II — Las Galerías (Umbrales 4-6)
9. **EL CORO DE OJOS** — *"Cada decisión es observada."* Mod: descartar prohibido; cada 3 cartas jugadas, una se marchita (pierde mejora). Tell: ojos que parpadean al unísono. Orla: ojos abriéndose.
10. **LA INUNDACIÓN** — *"El agua negra sube."* Mod: cada mano fallida en alcanzar un sub-umbral sube +8% objetivo. Tell: nivel de agua que sube por la pantalla. Orla: agua.
11. **EL DESOLLADO** — *"Sin piel, todo duele."* Mod: las cartas con mejora pierden su mejora al jugarlas (consumibles). Tell: cartas "en carne viva". Orla: músculo.
12. **EL ARCHIVERO** — *"Ya conoce tu jugada."* Mod: la mano que más repitas da −50% puntuación. Tell: fichero que se abre. Orla: papeles.
13. **LA CARCOMA** — *"Devora desde dentro."* Mod: al inicio del combate destruye 2 cartas aleatorias de tu mazo (este combate, vuelven luego). Tell: agujeros. Orla: madera comida.
14. **EL ESPEJO ROTO** — *"Tu reflejo no obedece."* Mod: los ×mult de tus reliquias se reducen 0.5 cada uno (mín ×1). Tell: grietas de espejo. Orla: cristal.
15. **EL HAMBRIENTO** — *"Quiere tus monedas."* Mod: pierdes 5 monedas por mano jugada; con 0 monedas, −20% puntuación. Tell: boca enorme. Orla: fauces.
16. **LA SEÑORA DE LAS GALERÍAS** — *"Reina de lo húmedo."* Mod (jefe-pico Sima II): dos fases; a media vida silencia 2 palos. Tell: vestido que llena la pantalla. Orla: cardenillo invasor.

### Sima III — El Fondo (Umbrales 7-8)
17. **LA MADRE PÁLIDA** — *"Bajaste para encontrarla. Ojalá no."* Mod: objetivo +10% por mano fallida; inmune a ×mult en la 1ª mano; **2 fases** (a media vida apaga 1 vela y duplica fichas restantes requeridas). Tell: la pantalla respira, latido que acelera. Orla: carne que late.
18. **EL DEVORADOR DE NOMBRES** — *"Olvidarás quién eras."* Mod: una reliquia aleatoria se "silencia" (sin efecto) cada mano, rotando. Tell: nombres borrándose. Orla: letras que se disuelven.
19. **EL ÚLTIMO OJO** — *"Lo ve todo, incluido el final."* Mod: alucinaciones garantizadas cada mano (independiente de Cordura). Tell: un ojo colosal. Orla: iris gigante.
20. **EL POZO** — *"No tiene fondo, como tú temías."* Mod: cada mano cuesta 1 carta de tu mano (se cae al pozo). Tell: la mano se vacía hacia abajo. Orla: vacío que succiona.
21. **LA CORONA DE GUSANOS** — *"Reina de lo que repta."* Mod: cada mejora de carta se convierte en penalización (−fichas) ese combate. Tell: gusanos coronados. Orla: anélidos.
22. **EL SILENCIO** — *"Donde acaba el sonido."* Mod: el audio se apaga (cosmético) y +20% objetivo; tus pops de puntuación no se ven (juegas "a ciegas" del feedback). Tell: ausencia total. Orla: negro que avanza.
23. **EL HUÉSPED MENOR** — *"Vino contigo desde arriba."* Mod: copia tu reliquia más fuerte y la usa contra ti (resta lo que tú sumas con ella). Tell: tu silueta deformada. Orla: tu propio reflejo.
24. **EL FONDO MISMO** — *"Lo que esperaba al final."* Mod (jefe final del Umbral 8): **3 fases**, combina silencio de palo + objetivo creciente + alucinaciones. Recompensa: cierre de la run / desbloqueo. Tell: todo lo anterior a la vez, atenuado. Orla: la pantalla entera infectada.

### Secretos
25. **EL HUÉSPED** — reemplaza a un jefe si ganaste una run sin perder velas (condición de desbloqueo). Mod brutal combinado + recompensa única (reliquia legendaria garantizada).
26. **EL QUE MIRA DESDE FUERA** — solo en Infinito Umbral 13+. Mod: rompe una regla del juego por combate al azar (meta-jefe). Para los hardcore.

## 11.8 ÉLITES (☠)
Combates duros con reliquia garantizada. No tienen lore de jefe pero sí un "sabueso" temático con un mini-modificador (más leve que un jefe). Pool de ~10 modificadores de élite (ej.: "−1 descarte", "objetivo +20% pero +reliquia rara", "Cordura −10 al ganar", "una carta trabada/mano"). Aparecen desde la fila 2.

## 11.9 EVENTOS (?) — pool de 40+ (decisiones con consecuencias)

Cada evento: lámina atmosférica + 2-3 opciones de riesgo/recompensa. Deterministas (stream de eventos). Lista (resumen de efecto; el copy de grimorio se escribe en el bloque de contenido):
1. **El Pozo de Monedas** — paga 20 oro → reliquia rara garantizada / no pagar → nada.
2. **El Pacto** — gana reliquia poderosa / −1 mano hasta fin de Umbral.
3. **La Mano Cortada** — destruye 1 carta de tu mazo gratis (depurar).
4. **El Mercader Ciego** — compra a ciegas (1 reliquia oculta) por 10 oro.
5. **El Altar** — sacrifica 1 reliquia → 2 reliquias de rareza superior.
6. **La Fuente Negra** — bebe: −15 Cordura, +reliquia espectral / no beber: +10 Cordura.
7. **El Espejo** — duplica una carta de tu mazo (eliges) / o duplica una reliquia (eliges) por 25 oro.
8. **Los Tres Cofres** — elige 1 de 3: oro / arcano / riesgo (puede ser maldición o legendaria).
9. **El Ahorcado** — sacrifica 1 vela → reliquia legendaria.
10. **El Vagabundo** — dale 15 oro → te "marca" 2 cartas con sellos a tu elección.
11. **La Bruja** — convierte hasta 3 cartas a un mismo palo gratis.
12. **El Niño Perdido** — guíalo (gratis): +1 vela máxima, pero −10% oro el resto de la run.
13. **La Apuesta** — apuesta oro a "par o impar" del próximo reparto: gana doble o pierde todo.
14. **El Confesionario** — purga una maldición gratis / o gana mult permanente por confesar un pecado (−Cordura).
15. **El Relicario** — elige 1 reliquia de 3 (draft de evento).
16. **La Tumba** — abre (riesgo): reliquia o "El Polvo" (pierde una mejora aleatoria del mazo).
17. **El Jardín Equivocado** — come una fruta: efecto aleatorio (buff o debuff temporal).
18. **El Cobrador** — paga deudas (oro) o acepta una Maldita.
19. **La Encrucijada** — elige camino: +reliquia / +oro / +Cordura.
20. **El Reloj** — adelanta el tiempo: salta el próximo combate (lo ganas) pero sin recompensa.
21–40. **(variantes)** — más pactos, altares, mercaderes, apuestas, espejos, tumbas y encrucijadas con números distintos, garantizando que el pool de 40 ofrezca decisiones frescas. (Se especifican en el bloque de contenido; cada una con su data y efecto declarativo.)

## 11.10 LA TIENDA (⌂)

Inventario generado por seed (stream de tienda), ponderado por Sima y por sesgo de Recipiente:
- **2-3 Reliquias** (rareza ponderada por profundidad).
- **2 Arcanos** (Augurio / Sello / Conjuro según sesgo).
- **1 Mejora de carta** aplicable in situ.
- **1 Vale** (mejora permanente).
- **1 "Cierre":** eliminar carta del mazo (25 oro) o reroll de comodín.
- **Reroll** del inventario: coste 5, +1 por reroll en la misma visita (vales lo reducen).
Costes orientativos: C 4-5 · PC 6-8 · R 9-13 · E/M 12-18 · L 20-30 · Augurio 3-5 · Sello 4-6 · Conjuro 5-8 · Vale 6-12 · Mejora 4. (Ajustables en balanceo, §13.)


---

# 12. SISTEMAS DE PROGRESIÓN Y LONGEVIDAD

## 12.1 Velos (escalera de dificultad, 0-20, por Recipiente)

Como las "ascensiones"/"stakes". Cada Recipiente se juega del Velo 0 (base) al 20. Ganar un Velo desbloquea el siguiente **para ese Recipiente**. Cada Velo **añade** su modificador a todos los anteriores (acumulativo). 6 × 20 = 120 cumbres → endgame de cientos de horas.

| Velo | Modificador acumulativo |
|---|---|
| 0 | Base. |
| 1 | Objetivos +5%. |
| 2 | Tienda +15% coste. |
| 3 | Empiezas con −1 Cordura máx por Umbral acumulado en Infinito; reroll +1 coste. |
| 4 | Élites más frecuentes. |
| 5 | Empiezas con 2 velas (en vez de 3). |
| 6 | Los jefes ganan +10% objetivo. |
| 7 | Menos oro por combate (−1). |
| 8 | Una reliquia Maldita garantizada en el pool temprano. |
| 9 | Hand size −1 base (7). |
| 10 | Objetivos +10% adicional; checkpoint (desbloquea cosmético). |
| 11 | Descansos solo curan O mejoran, no ambos; nunca curan vela completa. |
| 12 | Cordura empieza en 80. |
| 13 | El draft de recompensa es 1 de 2 (menos elección). |
| 14 | Los Sellos suben de nivel +0 visible pero cuestan más. |
| 15 | −1 mano base (las manos son oro). |
| 16 | Alucinaciones aparecen desde Cordura <60. |
| 17 | Las tiendas tienen 1 ítem menos. |
| 18 | Jefes de fase ganan una fase extra. |
| 19 | Objetivos +15% adicional. |
| 20 | **El Sello del Abismo:** combinación brutal final + el jefe del Umbral 8 siempre es El Fondo Mismo en su forma corrupta. Conquistar el Velo 20 con un Recipiente = maestría. |

> El balanceo (§13) fija el win-rate objetivo por Velo (alto en 0-3, ~50% en 8-10, muy bajo y "para expertos" en 18-20).

## 12.2 Desbloqueos (qué se gana jugando)

Meta-progresión persistente (Supabase si hay login; IndexedDB si no). Categorías:
- **Recipientes (5 desbloqueables):** Vidente (gana 1 run con Heraldo), Usurero (acumula 1.000 oro total entre runs), Coleccionista (ten 20 cartas con mejora a la vez en una run), Bestia (gana un combate con ≥10 descartes), Profano (llega a Cordura 0 y sobrevive el combate).
- **Reliquias bloqueadas (~25 de las 90):** entran al pool al cumplir hitos temáticos (ej. "gana un combate solo con Color" → Vitral; "destruye 20 cartas en una run" → Devorador; "vence 3 jefes en una run sin perder velas" → una Legendaria).
- **Mazos alternativos por Recipiente (modificadores de inicio):** cada Recipiente desbloquea 1-2 mazos alternativos (ej. Heraldo: "Mazo del Asceta" −descartes +mult). ~10 mazos.
- **Velos:** §12.1, por Recipiente.
- **Jefe secreto El Huésped:** gana una run sin perder ninguna vela.
- **Manos especiales (Quinteto, etc.):** desbloqueadas vía logros específicos.
- **Cosméticos:** dorsos de carta, paletas de orla alternativas, marcos. Puramente estéticos, ganados en hitos.
- **Entradas de Codex:** cada reliquia vista, jefe vencido, carta mejorada y evento resuelto rellena su entrada (§12.4).

## 12.3 Logros (~100, en categorías)

Persistentes, con notificación in-game. Ejemplos por categoría (lista completa en el bloque de contenido):
- **Progreso:** "Primer Descenso" (gana 1 run), "El Fondo" (gana en Velo 0 con cada Recipiente), "Maestría" (Velo 20 con uno), "Leyenda" (Velo 20 con los 6).
- **Puntuación:** "Seis Cifras" (mano de 100k+), "Millón" (mano de 1M+), "Lo Imposible" (mano de 1.000M+ en Infinito).
- **Builds:** "Solo Fichas" (gana sin ninguna reliquia ×mult), "Mult Puro" (gana sin reliquias de fichas planas), "Economía" (ten 500 oro a la vez), "Retrigger" (50 disparos en una sola mano), "Palo Único" (gana con Comunión Forzada).
- **Riesgo/Cordura:** "Al Borde" (gana un combate con Cordura 1), "Abismo" (gana una run habiendo tocado Cordura 0), "Pacto" (lleva 3 reliquias Malditas a la vez).
- **Profundidad (Infinito):** "Bajo el Fondo" (Umbral 10), "Más Hondo" (Umbral 15), "Sin Retorno" (Umbral 20+).
- **Coleccionista:** "Catálogo" (ve 100 reliquias distintas), "Bestiario" (vence los 24 jefes), "Erudito" (resuelve los 40 eventos).
- **Secretos/raros:** condiciones ocultas que premian experimentación.

## 12.4 Codex / Grimorio (cientos de entradas)
Compendio que se rellena jugando: **Reliquias** (90, con flavor + efecto + "primera vez vista") · **Jefes** (24+2, con lore desbloqueado al vencer) · **Cartas y mejoras** · **Eventos** (40) · **Recipientes** (lore) · **Arcanos/Vales**. Da sensación constante de progreso y razón para "ver qué falta". Cientos de entradas = motor de completitud.

## 12.5 Retos diarios y semanales
- **Diario:** una seed derivada de la fecha (igual para todos tus amigos). Recipiente fijo del día (rota). Una entrada por usuario en el marcador de amigos (por confianza). El pique: misma run, ¿quién puntúa más?
- **Semanal:** seed semanal con un **mutador especial** (ej. "todas las cartas son del mismo palo", "empiezas con 3 reliquias Malditas", "hand size 4"). Leaderboard semanal. Premia adaptarse a reglas raras.
- Razón: la gente vuelve cada día/semana. Competición social asíncrona.

## 12.6 Modo Infinito
§9.6. Leaderboards propios de "Profundidad alcanzada" y "Puntuación infinita". Es el endgame de optimización.

## 12.7 Desafíos / Mutadores (runs especiales, ~20)
Runs con reglas predefinidas, desbloqueables, con su propio leaderboard. Ejemplos:
1. **Manos de Hierro** — solo 1 mano por combate, descartes infinitos.
2. **El Avaro** — empiezas con 200 oro pero sin reliquia inicial.
3. **Mazo Mínimo** — empiezas con 20 cartas.
4. **Sin Tienda** — no hay tiendas, solo recompensas.
5. **Todo Maldito** — todas las reliquias del pool son Malditas.
6. **Cordura Cero** — empiezas con Cordura 1.
7. **Un Palo** — el mazo es de un solo palo.
8. **Escalera o Muerte** — solo puntúan Escaleras.
9. **Velocidad** — temporizador por mano (tensión).
10. **Espejo** — todas tus cartas son Espejo.
11–20. **(variantes)** — combinaciones que fuerzan builds extremas y dominio del sistema.

## 12.8 Modo Personalizado
Seed manual + toggles de reglas (velas iniciales, Cordura, manos/descartes, pool restringido, mutadores). Para experimentar y compartir seeds. **No puntúa en leaderboards oficiales** (marcado "custom").


---

# 13. ECONOMÍA, CURVAS DE BALANCEO Y OBJETIVOS NUMÉRICOS

## 13.1 Filosofía de balanceo
El balanceo no se "adivina": se mide. El paquete `packages/sim` (Bloque de balanceo) juega **miles de runs automatizadas** con políticas heurísticas por arquetipo y reporta win-rate por Velo, distribución de puntuación, frecuencia de uso de cada reliquia, y "reliquias muertas" (nunca elegidas) o "rotas" (siempre ganan). Los números de este documento son el **punto de partida**; se afinan con esos datos antes de lanzar.

## 13.2 Objetivos de win-rate (diseño)
| Velo | Win-rate objetivo (jugador medio) |
|---|---|
| 0-2 | 70-85% (aprendizaje, gratificante) |
| 3-5 | 55-70% |
| 6-9 | 40-55% |
| 10 | ~45% (muro intermedio) |
| 11-14 | 25-40% |
| 15-17 | 15-25% |
| 18-19 | 8-15% |
| 20 | <8% (logro de experto) |

## 13.3 Economía de oro
- Recompensa por combate: **+5** (Élite +8, Jefe +12). Skip de recompensa: +6 oro.
- **Interés:** +1 por cada 5 en mano al fin de combate (tope +5; vales/usurero suben).
- Vender reliquia: ~50% del coste.
- Coste medio de progreso: el jugador debería poder comprar ~1-2 piezas por tienda con economía normal; el arquetipo Usurero rompe esto a propósito.

## 13.4 Arquetipos de build y sus breakpoints (la diana del diseño)
El motor debe permitir que estos arquetipos sean **viables y distintos**. Cada uno tiene ≥5-6 reliquias de apoyo (entre las 60 generales + las 30 de Recipiente) y un "breakpoint" donde despega:
1. **Fichas puras** — Eclipse + Lastre de Plomo + Cerrajero + Igualador + El Coleccionista Supremo. Breakpoint: ×2 fichas (Eclipse) sobre una base inflada. Gana por fichas colosales, mult modesto.
2. **Mult plano** — Catalizador + Letanía + Gemelo/Trinidad + Corte Real. Breakpoint: apilar +mult hasta que cada figura sume decenas.
3. **Mult×Mult** — Espejo Negro + Monarca + Convergencia + Sístole. Breakpoint: encadenar ×mult (el orden de reliquias importa, §7.3). Explosivo y frágil.
4. **Retrigger** — Cámara de Ecos + sellos Sangre + Reverberación + Eternidad + Resonancia Espectral. Breakpoint: cada carta puntúa N veces × reliquias reactivas. Cuidado con el tope (§7.6).
5. **Economía** — Reliquia del Avaro + El Contable Perfecto + reliquias del Recipiente Usurero (§8.3). Breakpoint: oro alto → fichas/mult masivos; escala con la run.
6. **Escaladoras** — Sanguijuela + Crónica + Glotón + Devorador + Vendetta. Breakpoint: tiempo. Débil temprano, imparable tarde. El arquetipo "Infinito".
7. **Palo único** — Caleidoscopio + Osario Mayor/Corazón Negro/Cerrajero/Vigía + reliquias del Recipiente Coleccionista. Breakpoint: Color/Quinteto de color constante.
8. **Cordura-rota (Profano)** — Corazón del Abismo + Eco del Vacío + Luna Sangrante + sellos Violeta + reliquias del Recipiente Profano (§8.6). Breakpoint: Cordura baja → ×mult enorme, equilibrado por riesgo.

## 13.5 Duración objetivo de una run
- Run estándar (Umbrales 1-8): **30-50 min** según ruta y reflexión.
- Combate individual: 1-4 min.
- Infinito: ilimitado (sesiones de optimización largas).
Estos tiempos sirven a la tesis de longevidad: una run no es "2 horas y se acabó el juego", sino media hora × cientos de configuraciones × 120 cumbres de Velo × modos.

## 13.6 Anti-degeneración
- Tope de retrigger (§7.6) evita bucles infinitos que petan o trivializan.
- Límite de slots (ampliable con vales/reliquias) evita "tenerlo todo".
- Escalado exponencial de objetivos (§9.3) evita que cualquier build gane sin escalar.
- "Reliquias muertas/rotas" detectadas por `sim` se re-balancean por versión (INV-7).

---

# 14. GAME FEEL Y AUDIO

## 14.1 Feel — el vicio AAA (presupuesto alto aquí)
La "biblia del juice":
- **Al jugar una mano:** las cartas que puntúan se elevan en secuencia (stagger ~60ms); cada una dispara su pop (`+fichas` hueso, `+mult` sangre, `×mult` fósforo) con squash/stretch y arco; las reliquias que disparan se sacuden y emiten su número con chispa de su tag; el marcador grande cuenta hacia arriba con easing y "tick"; remate con **golpe de cámara** proporcional al salto.
- **Escala dramática:** puntuaciones grandes → más shake, sub-grave en audio, y **ralentí (time-scale)** en el último ×mult (el "crítico" se saborea). Zoom sutil en el marcador.
- **Cartas:** drag con inercia y rotación según velocidad; snap al soltar; hover-tilt (§6.6); selección con leve elevación + sonido.
- **Tienda:** ítems que "respiran"; reliquia comprada vuela al slot con arco y "clack".
- **Transición de Umbral:** la cámara "cae", la paleta vira a la Sima siguiente.
- **Jefe:** entrada cinematográfica (zoom, aberración cromática breve, sub-grave), la orla se infecta (§11.7).
- **Cordura baja:** viñeta que late, leve aberración, alucinaciones con tell sutil.
- **Toggle "Reducir efectos":** baja shake/partículas/ralentí sin tocar legibilidad (§18).

## 14.2 Audio (Howler) — música dinámica por capas
- **Capas por estado** con crossfade: drone ambiental de grimorio (siempre) + capa rítmica (combate) + capa coral disonante (jefe) + capa de fósforo/etérea (Cordura baja). Entran/salen según contexto.
- **Por Sima:** la paleta sonora vira (Vestíbulo: madera/polvo; Galerías: goteo/eco; Fondo: latido/coro; Infinito: casi silencio roto por fósforo).
- **SFX:** repartir carta, seleccionar (sutil), jugar (impacto), **cada tier de mult tiene su tono** (cuanto más alto, más agudo/satisfactorio el remate), comprar, error, reliquia dispara, retrigger (eco), destrucción, alucinación (susurro), apagar vela.
- **Jefe:** leitmotiv propio por jefe (o por Sima en MVP) + diegéticos (respiración, latido que acelera con la tensión del objetivo).
- **Mezcla:** ducking de la música cuando salta la puntuación; el "silencio" es una herramienta (El Silencio, jefe, apaga el audio).
- Música/SFX con licencia o producidos en pipeline (§17).

---

# 15. DATOS / SUPABASE

## 15.1 Esquema (migraciones aditivas, RLS estricto)
```sql
profiles ( id uuid pk refs auth.users, handle text unique not null, created_at timestamptz )
player_meta ( user_id uuid pk refs auth.users, schema_version int, blob jsonb )  -- unlocks, cosméticos, ajustes, guardado en nube
player_unlocks ( user_id uuid, unlock_id text, unlocked_at timestamptz, pk(user_id,unlock_id) )
player_achievements ( user_id uuid, achievement_id text, unlocked_at timestamptz, pk(user_id,achievement_id) )
-- Guardado de run en curso (para reanudar desde cualquier dispositivo)
run_saves ( user_id uuid pk refs auth.users, state jsonb, action_log jsonb, updated_at timestamptz )
-- Puntuaciones para el MARCADOR DE AMIGOS (por confianza; sin validación de servidor)
scores (
  id uuid pk default gen_random_uuid(),
  user_id uuid refs auth.users,
  vessel text not null,
  seed text not null,
  ruleset_version int not null,
  mode text not null,            -- 'carrera'|'diario'|'semanal'|'infinito'|'desafio'|'custom'
  veil int default 0,
  daily_date date, weekly_id text, challenge_id text,
  status text not null,          -- 'won'|'lost'|'abandoned'
  score bigint not null,         -- reportado por el cliente (confianza)
  depth int,                     -- Umbral alcanzado (para Infinito)
  action_log jsonb,              -- opcional, para poder ver/repetir la run del amigo
  created_at timestamptz default now()
)
daily_seeds ( date date pk, seed text, vessel text )
weekly_seeds ( week_id text pk, seed text, mutator text )
```
- **Marcadores:** VISTAS de ranking por modo sobre `scores` (`lb_carrera` por `score`, `lb_infinito` por `depth` + `score`, `lb_diario` por `daily_date`, `lb_semanal` por `weekly_id`, `lb_desafio`). Para el modo diario/semanal, unicidad `(user_id, daily_date)` / `(user_id, weekly_id)` (la mejor puntuación del día por persona).
- **RLS:** un usuario solo lee/escribe SUS `profiles/player_meta/unlocks/achievements/run_saves`, y solo inserta SUS `scores`. Los marcadores (vistas) son legibles por todos (es un grupo de amigos): muestran `handle + score/depth + seed + fecha`. **Sin re-simulación ni validación** (decisión §16): se confía en lo que reporta el cliente.
- **Opcional "círculo de amigos":** si se quiere acotar el marcador al grupo, una tabla `friends(user_id, friend_id)` filtra las vistas a tus amigos. (No imprescindible para v1.)

## 15.2 Auth
- Supabase Auth (`@supabase/ssr`), email magic link en MVP (OAuth opcional, decidir si se añade).
- Sin login: juego completo en local (IndexedDB), sin marcador de amigos ni guardado en nube. Login fusiona progreso local con servidor (merge no destructivo, INV-6) y sube tus puntuaciones al marcador.

---

# 16. DETERMINISMO, SEMILLAS COMPARTIDAS Y MARCADORES ENTRE AMIGOS

> **Decisión de diseño (Andreh):** UMBRAL es para ti y tus amigos. **No hay anti-trampas ni validación de servidor.** Nadie va a falsear puntuaciones en un grupo de colegas, y montar re-simulación servidor sería complejidad inútil. Lo que sí queremos del determinismo es lo divertido: **que todos juguéis la misma run desde una semilla y compitáis**.

## 16.1 Qué nos da el determinismo (y por qué lo conservamos)
El determinismo (INV-1) no está para vigilar; está para tres cosas buenas:
1. **Semillas compartidas (modo estrella entre amigos).** Una seed → la misma run en todos los dispositivos (mismas cartas, tienda, jefes, eventos). El reto diario/semanal (§12.5) reparte una seed común: jugáis la misma partida y veis quién la exprime mejor. Puro pique de grupo.
2. **Guardar / reanudar.** El estado serializa (INV-4); reanudas donde lo dejaste, incluso en otro dispositivo (guardado en nube, §15).
3. **Repetir / compartir una run.** Con `seed + action_log` se puede reproducir la partida exacta de un amigo (ver cómo consiguió ese pifostio de puntuación). Opcional, pero épico para el grupo.

## 16.2 Punto fijo: para que dos dispositivos coincidan
Para que una semilla compartida dé **exactamente** el mismo resultado en el móvil de uno y el portátil de otro, la puntuación NO puede depender de coma flotante (los `×1.5`, `×0.5` pueden diferir un epsilon entre motores/navegadores y romper la igualdad). Por eso la puntuación se calcula en **aritmética de punto fijo / enteros** (§7.3.1): el multiplicador se trabaja escalado (p.ej. ×1000 interno) y solo al final se hace el `floor`. Así, misma seed + mismas acciones = misma puntuación, bit a bit, en cualquier dispositivo. (Este era el único motivo técnico de peso para el punto fijo; con él, las semillas compartidas son sólidas.)

## 16.3 El marcador de amigos (por confianza)
- Al terminar, el cliente sube `{ vessel, seed, mode, veil, score, depth, status }` (y opcionalmente el `action_log` para poder ver la repetición) a la tabla `scores` (§15). **Se confía en el dato** — es un grupo de amigos.
- Marcadores por modo (carrera, infinito por profundidad, diario, semanal, desafíos). El diario/semanal guarda la **mejor** puntuación por persona y día.
- Si algún día abrieras el juego a desconocidos y quisieras competición seria, *entonces* tocaría re-simulación servidor; está descrito cómo encajaría (el engine es TS puro, INV-3, así que correría igual en una función servidor), pero **no se implementa ahora**. No añadas anti-trampas sin orden explícita.

## 16.4 Resumen
Determinismo + punto fijo = semillas compartidas robustas y guardado/repetición. Cero infraestructura de validación. Toda la diversión competitiva entre amigos, nada de fricción.

---

# 17. PRODUCCIÓN DE ASSETS: TEXTURAS PBR REALES, NORMAL MAPS, SHADER DE MATERIAL, GRADE Y LICENCIAS

> Esta es la sección que separa "premium" de "cutre". El usuario gestiona/provee licencias (uso personal, con posibilidad de licenciar). Aquí se define **cómo se produce el arte de verdad** (no a base de líneas, CSS ni primitivas), **qué mapas lleva cada pieza** (textura + relieve reales), **el shader que lo ilumina** y **cómo se unifica todo** para que parezca un solo juego. Lee §17.5–17.14 enteras antes de tocar arte o shaders.

## 17.1 Principios
- **Registro de licencias:** `ASSETS_LICENSES.md` en el repo lista cada asset (fuente, autor, tipo de licencia, ámbito de uso, atribución requerida). Ningún asset entra sin su entrada.
- **Atribución:** una pantalla "Créditos" en el shell lista atribuciones requeridas.
- **Formatos:** sprites en atlas (texture packing) para batching Pixi; audio como sprites Howler (un archivo + mapa de tiempos) para minimizar requests; fuentes self-hosted (woff2) con su licencia web.
- **Separación:** assets en `apps/web/public/assets/{cards,relics,bosses,ui,audio,fonts}` con manifest tipado en `packages/content`.

## 17.2 Categorías de asset
- **Cartas:** ilustraciones de rango/palo (estilo grabado, §6.1), dorsos (cosméticos), marcos por tipo/rareza.
- **Reliquias:** 90 láminas/íconos. La MAYORÍA comparten marco y material (tier icono, §17.6.b) y se componen con el kit PBR base; solo las piezas hero llevan render dedicado. Coherencia de estilo obligatoria.
- **Jefes:** lámina por jefe (24+2) + estados de "infección de orla".
- **Orla viva:** sprite/spritesheet de la orla con estados (calma/tensa/infectada por jefe).
- **UI:** marcos, botones, iconografía de recursos (velas, cordura, oro), tipografías.
- **Audio:** drones por Sima, capas de combate/jefe, leitmotivs, SFX completos (§14.2).
- **VFX:** texturas de partículas (polvo, esporas, ceniza, fósforo), shaders (GLSL en `game-render`).

## 17.3 Presupuesto de assets (orientativo, "no escatimar")
Calidad de estudio: coherencia estilística total, atlas optimizados, audio en capas con mezcla profesional. El cuello de botella creativo es el arte de los 24 jefes y las reliquias hero; planificar producción/licencia por tandas y permitir **placeholders estilizados** (composición por capas con la paleta) hasta tener el arte final, sin bloquear la jugabilidad. El motor y el feel NO dependen del arte final para ser jugables (se prueban con placeholders coherentes).

## 17.4 Regla de bloqueo
Si falta un asset con licencia clara, se usa un **placeholder premium** (§17.13, NUNCA una caja de color plana) y se marca en `ASSETS_LICENSES.md` como `PENDIENTE`. Nunca se incrusta un asset de origen/licencia dudosa (INV-5).

## 17.5 PRINCIPIO ANTI-CUTRE: materiales reales + cohesión, no PNGs planos sueltos

**INV-ARTE (innegociable):** en UMBRAL no hay modelos 3D en el juego final — el "parece 3D" sale de iluminar **sprites con material** mediante el shader (§17.11) y de la **cohesión** del conjunto. Una ilustración plana, suelta, sin material ni grade, está PROHIBIDA. Pero "material" no significa lo mismo para cada pieza: hay **dos tiers** (§17.6.b), y forzar PBR completo en las 90 reliquias sería un disparate de producción que tú, con tu equipo, no necesitas. La regla honesta:

- **Lo que el jugador toca de cerca y debe sentir físico** (cartas de juego, marcos, piezas hero, jefes, orla) lleva **material real**: albedo + **normal map** + roughness + (AO/height donde aporte). Aquí el normal map es obligatorio: es lo que hace que la luz "muerda" el grano del papel y el relieve del grabado, y que la carta parezca un objeto. Sin él, el especular resbala y se ve barato.
- **Las ilustraciones internas de las reliquias (tier icono)** comparten **marco y sustrato con material** (el pergamino, el oro del marco, el foil — todo del kit PBR base §17.8, que SÍ tiene normales reales), y la ilustración en sí va sobre ese material. No hace falta inventar un normal map por cada una de las 90 ilustraciones; lo que las hace premium es: el material compartido bajo ellas, el grade común (§17.10), el marco con relieve real, y el shader de carta que las ilumina a todas. Para dar profundidad a estas ilustraciones se usa **parallax de capas + luz de borde (rim) + emisivo** (§6.5), NO un normal map falso.

**Mapas que existen en el proyecto:** Albedo · Normal · Roughness/Specular · AO (opcional) · Height (opcional, parallax hero) · Máscara de foil/holo · Emisivo (lo arcano: fósforo).

**Por qué NO derivamos normal maps de cada ilustración:** derivar relieve a partir del brillo de un dibujo plano (height→normal) **adivina y se equivoca** a menudo; queda gomoso. Solo se usa donde funciona de verdad: el **kit de materiales tileables** (papel, foil, metal, hueso — §17.8), donde el surco es regular y predecible. Para las ilustraciones, mejor capas + rim + emisivo que un normal inventado. (Esto corrige la idea de "normal map en absolutamente todo": premium ≠ fingir relieve; premium = material real donde cuenta + cohesión brutal.)

### 17.5.1 El SUELO DE CALIDAD (qué hace que NO se vea barato)
Lo que separa un juego que parece de estudio de uno cutre no es "más mapas", es disciplina en estas seis cosas. Todas obligatorias:
1. **Cohesión total:** una sola paleta (§6.2), un solo estilo de grabado (§6.1), un solo grade (§17.10). Diez piezas perfectas pero dispares se ven peor que diez coherentes. El grade unificador es lo más importante de toda la sección de arte.
2. **Material compartido bajo todo:** el pergamino, el oro del marco y el foil son los mismos materiales reales en todas las cartas. Eso da unidad física aunque la ilustración cambie.
3. **El shader de carta (§17.11) bien pulido:** tilt, especular que recorre, foil/holo, rim, sombra de contacto. Esto es lo que vende el "objeto físico" y se aplica a TODA carta por igual.
4. **Tipografía impecable (§6.4):** mala tipografía hunde cualquier arte. Números tabulares, display con carácter, jerarquía clara.
5. **Restricción:** un solo color vivo (fósforo) para lo arcano; el resto contenido. La sobrecarga de efectos es lo que delata "AI-generated/cutre".
6. **Game feel (§14):** un juego se siente caro cuando responde —el peso de la carta, el conteo del crítico, el shake— más que por los píxeles. El feel es mitad de la percepción de calidad.

Regla práctica: **si una carta no reacciona a la luz al inclinarla, o desentona con sus vecinas, se rechaza** (§17.14).

## 17.6 Las 4 vías de producción REALES (cómo nace el arte)

El arte se produce con métodos reales, no se "improvisa con código". Cuatro vías, combinadas por tipo de pieza (tabla en §17.7):

**Vía A — Render 3D→2D en Blender (objetos físicos: reliquias y piezas hero).**
Se modela el objeto (un cáliz, una llave de hueso, un ojo, una corona de gusanos), se le aplican **materiales PBR reales** (metal, cera, hueso, oro viejo, piedra), se ilumina con un **HDRI de estudio** y se renderiza a sprite 2D. De Blender salen, automáticamente y alineados, el **albedo (beauty pass)**, el **normal map** (pase de normales en espacio de pantalla/tangente), el **roughness**, el **AO** y la **profundidad**. Textura y luz 100% reales. Es literalmente trabajar con modelos, pero el resultado final es 2D y encaja clavado con el shader del juego. **Vía preferente para piezas HERO** (§17.6.b): jefes con forma de objeto, reliquias legendarias/estrella, iconografía de recursos, y sobre todo el **kit de materiales** (§17.8). NO para las 90 ilustraciones de reliquia (eso es tier icono, vías B/C).
- Pipeline: escena Blender estandarizada (cámara ortográfica fija, HDRI fijo, tarima de render) → Compositor con nodos de salida por pase → export a `.png` 16-bit donde importe (normales) → al grade (§17.10) → al atlas (§17.12).
- Se entrega una **plantilla `.blend`** con la escena, luces y nodos de compositor ya montados, para que cada reliquia sea "meter el modelo y darle a render".

**Vía B — Generación por IA con estilo BLOQUEADO (volumen coherente).**
Para producir las reliquias (90) y láminas con un estilo de grabado victoriano consistente, generación dirigida (Midjourney / Flux / Stable Diffusion) usando **referencias de estilo o un fine-tune/LoRA propio entrenado con el moodboard de UMBRAL**, semillas controladas y **scaffolds de prompt fijos** (un prompt base inmutable + el sujeto variable). Esto garantiza que todas las piezas parezcan del mismo libro. La IA entrega el **albedo de la ilustración**, que se monta **sobre el marco y el material compartidos** (pergamino + oro + foil del kit, §17.8, que sí tienen normales reales); la profundidad se da con **parallax de capas + rim + emisivo** (§17.5), no con un normal derivado falso. La consistencia se remata en el grade (§17.10).
- Se entrega un archivo `PROMPTS_ARTE.md` con: el prompt base bloqueado, el negativo, los parámetros (aspect, stylize, seed strategy), y el sujeto por reliquia. (Tu metodología de doc maestro, aplicada al arte.)
- Licencia: varía por herramienta; para uso personal vas sobrado. Cada pieza generada se registra en `ASSETS_LICENSES.md` con la herramienta y la fecha.

**Vía C — Corpus de grabado de dominio público / con licencia (eficiencia + on-brand).**
El siglo XIX dejó un archivo enorme de grabados —botánica, anatomía, láminas ocultistas— que **es** exactamente esta estética y mucho está en dominio público (o licenciable). Se hace **photobash** (composición) + **recolor a la paleta UMBRAL** + el grade común. Ultra coherente con el concepto (§6.1) y ahorra trabajo. Ideal para **fondos, orlas, motivos de marco, e ilustraciones de reliquia tier icono**. Va sobre el material compartido + grade; la profundidad, por capas/rim/emisivo.
- Cada fuente se registra con su procedencia y licencia. Nada de origen dudoso (INV-5).

**Vía D — Comisión humana (donde más se nota).**
Para los **24 jefes** y las cartas estelares, ilustración humana (o IA + retoque humano fuerte) garantiza el punto "wow". Se mezcla con las vías anteriores para el grueso del contenido.

> **El secreto anti-asset-flip:** vengan de donde vengan (render, IA, grabado, comisión), **todas las piezas pasan por el mismo grade** (§17.10). Eso es lo que hace que parezca un solo juego y no un collage.

### 17.6.b Tiers de pieza (reparto de esfuerzo realista — no PBR en todo)

Para un proyecto tuyo + amigos, meter render PBR completo en 90 reliquias sería absurdo. Se reparte por tiers:

| Tier | Qué incluye | Material | Vía | Esfuerzo |
|---|---|---|---|---|
| **HERO** | Jefes (24), reliquias Legendarias (6), cartas de palo/rango (set base), marcos, orla viva, iconos de recurso | Material real completo (albedo+normal+rough, +AO/emisivo/height donde toque) | A (Blender) + D (comisión) | Alto, pocas piezas |
| **ICONO** | Las ~84 ilustraciones de reliquia no-legendaria, arcanos, vales, eventos | Ilustración sobre **marco+sustrato compartidos** (que sí son material real); profundidad por capas/rim/emisivo | B (IA estilo bloqueado) / C (grabado) | Medio, en lote, muy reutilizable |
| **SISTÉMICO** | Partículas, máscaras de foil, lookups, grano, viñeta | Texturas técnicas pequeñas | Generadas en pipeline | Bajo |

La calidad percibida del tier icono no viene de su propio relieve, sino de: (1) ir sobre el **mismo marco y material físico** que todo lo demás, (2) el **grade común**, (3) el **shader de carta** que las ilumina a todas igual, y (4) la **cohesión de estilo**. Por eso 84 ilustraciones "planas pero coherentes y bien enmarcadas" se ven de estudio, mientras que 84 ilustraciones dispares con normal map falso se verían peor. **Inviertes el músculo de PBR/render donde se nota (hero) y resuelves el volumen con cohesión.**

## 17.7 Mapas y resoluciones por tipo de pieza (tabla normativa)

Resoluciones a **@2x** (se sirve el doble y se escala; DPR techo 2). Formato de entrega: PNG (16-bit para normales); empaquetado final en atlas con compresión (§17.12).

| Pieza | Tier | Resolución base | Mapas que entrega | Vía |
|---|---|---|---|---|
| Carta (rango/palo) | hero | 512×768 | albedo, normal, roughness | A/C + grade; set cohesivo |
| Marco de carta (por tipo/rareza) | hero | 9-slice / 512×768 | albedo, normal, roughness | A/C (grabado) |
| Ilustración de reliquia (no legendaria) | **icono** | 400×400 | **solo albedo** (va sobre marco+material reales) | B/C + grade |
| Reliquia Legendaria / estrella | hero | 512×512 | albedo, normal, roughness, AO | **A (Blender)** |
| Arcano / Vale (ilustración) | icono | 360×360 | solo albedo | B/C |
| Jefe (lámina hero) | hero | 1024×1536 | albedo, normal, height (parallax), emisivo | **D** + A |
| Orla viva (firma §6.7) | hero | spritesheet / tileable | albedo, normal, emisivo | C + A; estados (calma/tensa/infectada) |
| Fondo por Sima | — | capas 2048 ancho | albedo por capa (parallax), grano | C/B |
| Iconografía de recursos (vela, cordura, oro) | hero | 128×128 | albedo, normal (o vector→MSDF) | A / vector |
| Kit de texturas base (papel, foil, oro, hueso, piedra) | sistémico | 1024² tileable | albedo, normal, roughness, (AO) | A / foto-escaneo |
| Máscara de foil/holo | sistémico | igual que la pieza | 1 canal (alfa) | derivada en pipeline |
| Lookup de interferencia (foil/holo) | sistémico | 256×16 | gradiente | generada (§17.11) |
| Partículas (polvo, esporas, ceniza, fósforo) | sistémico | 64–128² | albedo+alfa | C/B |

> Nota: la ilustración de reliquia tier icono entrega **solo albedo** porque el relieve/luz lo aportan el **marco y el sustrato compartidos** (que sí son material real) + el shader. Esto recorta el trabajo a una fracción sin perder cohesión.

## 17.8 Kit de texturas PBR base (el sustrato reutilizable)

Antes de las piezas concretas, se produce un **material kit** tileable que se reutiliza en todo el juego (y permite placeholders premium, §17.13):
- **Pergamino/papel viejo** (con grano, manchas, fibra) → sustrato de toda carta.
- **Foil metálico** (microrrelieve que difracta) → acabados de rareza.
- **Oro viejo / pan de oro** (rugoso, cálido) → acentos ocre.
- **Hueso** (poroso, mate) → palo `HUESO`, reliquias óseas.
- **Piedra/yeso** (mejora Piedra, marcos).
- **Metal oxidado / cardenillo** (Sima II, llaves).
- **Tinta** (para sellos de borde, el "sangrado" de las Malditas).
Cada uno con su set completo de mapas. Es el cimiento físico del look.

## 17.9 Normal maps: de dónde salen (y de dónde NO)

- **De geometría (Blender, vía A):** el normal es nativo y de máxima calidad. Es la fuente para todas las piezas **hero** (jefes-objeto, reliquias legendarias, iconos de recurso) y para el **kit de materiales** (papel, foil, metal, hueso, piedra — §17.8).
- **Del kit tileable:** el papel, el foil y el metal del kit tienen normal real (de foto-escaneo o Blender) y se **reutilizan** bajo todas las cartas. Así, hasta una ilustración tier icono "plana" se asienta sobre un sustrato con relieve físico real.
- **De ilustraciones planas (tier icono): NO se deriva un normal falso.** Derivar relieve del brillo de un dibujo (height→normal) adivina y queda gomoso. La profundidad de estas piezas se consigue con **parallax de capas + luz de borde (rim) + emisivo** (§6.5, §17.5), sobre el material compartido. (Excepción puntual: el grabado a buril, cuyo surco es regular, tolera un normal derivado *suave* si una pieza concreta lo pide; es la excepción, no la norma.)
- Reglas de calidad de cualquier normal: nada de azul uniforme "plano"; intensidad calibrada (ni hinchado ni invisible); sin costuras en tileables; canal verde con la convención de Pixi (Y+). Se valida moviendo la luz (§17.14).

## 17.10 El GRADE unificador (anti-asset-flip, obligatorio)

**Todas** las piezas, sea cual sea su origen, pasan por un mismo pipeline de acabado antes de entrar al atlas. Esto es lo que las hace "del mismo juego":
1. **Recolor a la paleta UMBRAL** (§6.2): mapear el rango tonal a los tokens (vacío/tinta/hueso/ocre/sangre/verdín/fósforo). Una LUT de color de proyecto.
2. **Inyección de grano de grabado** (textura de líneas/aguafuerte sutil multiplicada encima) → unifica texturas de orígenes dispares bajo el mismo "papel".
3. **Sello de tinta en bordes** (oscurecimiento entintado de los contornos, leve sangrado) → el look "lámina de grimorio".
4. **Viñeta + ajuste de contraste** por Sima (§6.3): la profundidad tiñe (saturación baja al descender).
5. **Desaturación selectiva** salvo lo arcano (el fósforo se respeta como único color "vivo").
Se entrega como **acciones/pasos reproducibles** (script de Photoshop/GIMP, o un mini-pipeline en código que aplica la LUT + grano + viñeta a un lote). Cada pieza graded se vuelve a registrar.

## 17.11 SHADER DE MATERIAL DE CARTA (spec de implementación)

El corazón técnico del "parece 3D". Un fragment shader (PixiJS v8 Filter / Mesh shader, WebGL2/WebGPU) que ilumina el sprite texturizado en tiempo real según el tilt/cursor. Lo implementa Claude Code en `packages/game-render` (Bloque 6). Pseudo-GLSL normativo:

```glsl
// Uniforms por carta
uniform sampler2D uAlbedo;     // color base
uniform sampler2D uNormal;     // relieve (tangent space)
uniform sampler2D uRough;      // rugosidad/especular
uniform sampler2D uFoilMask;   // dónde hay foil/holo (0..1)
uniform sampler2D uLut;        // gradiente de interferencia para foil/holo
uniform vec3  uLightDir;       // dirección de luz DERIVADA del tilt/cursor (clave)
uniform float uTime;           // animación de foil
uniform float uFoilStrength;   // por rareza
uniform float uHoloStrength;   // por rareza
uniform vec3  uAuraColor;      // fósforo (espectral) / sangre (maldita) / 0
uniform float uAuraPulse;      // latido del aura
uniform vec2  uTilt;           // inclinación actual (de hover)

void main() {
  vec3 albedo = texture(uAlbedo, vUV).rgb;
  vec3 N = normalize(texture(uNormal, vUV).rgb * 2.0 - 1.0); // relieve
  float rough = texture(uRough, vUV).r;
  float foil  = texture(uFoilMask, vUV).r;

  // 1) ILUMINACIÓN DIFUSA: la luz muerde el relieve del normal map
  vec3 L = normalize(uLightDir);
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  vec3 lit = albedo * (0.35 + 0.65 * ndl); // ambiente + difuso

  // 2) ESPECULAR: brillo que recorre la superficie con el tilt, modulado por rugosidad
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), mix(8.0, 64.0, 1.0 - rough));
  lit += spec * (1.0 - rough);

  // 3) FOIL: iridiscencia sólo donde la máscara, según ángulo de vista + tiempo
  float view = dot(N, V);
  float band = fract(view * 3.0 + uTime * 0.1 + uTilt.x * 2.0);
  vec3 foilCol = texture(uLut, vec2(band, 0.5)).rgb;
  lit = mix(lit, lit + foilCol, foil * uFoilStrength);

  // 4) HOLO: difracción fragmentada (patrón según UV + ángulo)
  float holo = fract((vUV.x + vUV.y) * 12.0 + view * 6.0);
  lit += texture(uLut, vec2(holo, 0.5)).rgb * foil * uHoloStrength;

  // 5) AURA (espectral/maldita): emisión que late en los bordes
  float edge = smoothstep(0.4, 0.0, min(min(vUV.x, 1.0-vUV.x), min(vUV.y, 1.0-vUV.y)));
  lit += uAuraColor * edge * (0.5 + 0.5 * sin(uTime * 3.0)) * uAuraPulse;

  gl_FragColor = vec4(lit, 1.0);
}
```

**Lo importante del spec:** `uLightDir` se deriva del **tilt/posición del cursor**, así que mover el ratón "mueve la luz" sobre el relieve → la carta se siente física. Cada parámetro (`uFoilStrength`, `uHoloStrength`, `uAuraColor`, `uAuraPulse`) se setea **por rareza/acabado** desde el content registry (§5.4) y el feel (§14.1) los modula. La sombra de contacto (§6.6) es un sprite aparte proyectado bajo la carta. El tilt y el parallax de capas (§6.5) van en el vertex/transform. WebGPU preferente, fallback WebGL2.

## 17.12 Pipeline técnico de assets (de archivo a juego)

- **Atlas:** empaquetado con TexturePacker (o `@assetpack/core`) en spritesheets; multipágina por categoría (cards, relics, bosses, ui). Los mapas (albedo/normal/rough) se empaquetan en atlas paralelos alineados por nombre.
- **Compresión:** Basis Universal / KTX2 si la ruta WebGPU/WebGL2 de Pixi v8 lo soporta en destino; si no, WebP (albedo) + PNG (normales, sin pérdida). Presupuesto de memoria de textura en §26.
- **Iconos/tipografía nítidos:** elementos vectoriales (iconos de recurso, glifos especiales) vía **MSDF** para nitidez a cualquier escala sin pesar.
- **Manifest tipado:** `packages/content` exporta un manifest TS que mapea `id → { albedo, normal, rough, foilMask, ... }`. El render pide materiales por id, nunca rutas sueltas.
- **Carga progresiva:** el shell carga primero UI + Sima actual; las láminas de jefe/Sima siguientes se precargan en background. Nada de un único bundle gigante de imágenes.
- **Hash en nombre** de cada asset (cache-busting + headers inmutables en Vercel, §23).

## 17.13 Placeholders PREMIUM (dignos, nunca cutres)

Mientras llega el arte final, los placeholders **no** son cajas de color: se generan por **composición del kit PBR base** (§17.8) + tipografía + paleta. Ejemplo: una carta placeholder = sustrato de pergamino (con su normal map real) + marco entintado del kit + la inicial del rango grabada en oro viejo, todo bajo el shader de material. Resultado: un placeholder que ya respeta el relieve, la luz y la paleta, y se ve **digno** en una demo. Reglas: todo placeholder usa materiales reales del kit; ninguno es un `fillRect` de color plano. Esto permite enseñar el juego (y subirlo a Vercel) con buena cara antes de tener todas las láminas finales.

## 17.14 Checklist de QA de arte (cada pieza debe pasarlo)

Una pieza no entra al juego hasta que:
1. ✔ Tiene **normal map** (nativo o derivado) y **reacciona a la luz** al inclinar la carta (test visual con el shader).
2. ✔ Está **graded** a la paleta UMBRAL (§17.10); no desentona con sus vecinas.
3. ✔ Tiene su **roughness** correcto (el oro brilla, el papel no).
4. ✔ Está **empaquetada en atlas** y dentro del **presupuesto de peso/memoria** (§26).
5. ✔ Es **legible al tamaño in-game** (no solo bonita al 100%).
6. ✔ Tiene **entrada en `ASSETS_LICENSES.md`** (fuente, licencia, atribución).
7. ✔ Si es de rareza, su **máscara de foil/holo** está bien delimitada.
8. ✔ Coherente de estilo con el concepto (§6.1): entintado, sagrado, equivocado.

---

# 18. ACCESIBILIDAD Y OPCIONES

- **Reducir efectos:** baja shake/partículas/ralentí/aberración; mantiene legibilidad y claridad de los números.
- **Daltonismo:** los palos se distinguen por **forma** (iconografía clara), no solo color; modo alternativo de paleta de palos.
- **Texto:** escala de tamaño de fuente; alto contraste opcional; las descripciones de reliquias siempre legibles (no solo en hover, también en un panel).
- **Audio:** sliders separados (música/SFX/ambiente); subtítulos para audio diegético relevante.
- **Teclado:** navegación completa del shell; atajos in-game (seleccionar cartas por número, jugar/descartar con teclas).
- **Velocidad:** opción de acelerar animaciones de puntuación (para veteranos que juegan rápido) — clave para sesiones largas de optimización.
- **`prefers-reduced-motion`** respetado en el shell por defecto.
- **Tutoriales:** opcionales, contextuales; el Codex explica cada sistema; nunca bloqueantes para quien ya sabe.


---

# 19. BLOQUES DE EJECUCIÓN (CON GATE HUMANO)

> Tras cada bloque: PARAS, resumes lo hecho, indicas cómo probarlo, esperas `OK`. Tag por bloque (`v0.X.0`). No encadenas. El orden es deliberado: **motor y feel antes que contenido masivo**; el contenido se vierte sobre cimientos probados.

**BLOQUE 0 — Andamiaje.** Monorepo pnpm+Turborepo; los 7 packages; TS strict (flags §0); Biome; Vitest; `sim` CLI vacío; app Next 16 que arranca; CI (typecheck+test+build); deploy "hola mundo" a Vercel. *DoD:* `pnpm build`/`pnpm test` verdes; URL Vercel viva.

**BLOQUE 1 — PRNG + tipos + streams.** `packages/shared`: mulberry32+cyrb128; streams por dominio (§5.3); helpers; tipos base; esquemas Zod; round-trip de estado PRNG. Tests de determinismo (misma seed→misma secuencia; streams independientes). *DoD:* tests de determinismo 100% verdes.

**BLOQUE 2 — Estado + acciones + event-sourcing.** `GameState` serializable y versionado; todas las `GameAction`; `reduce` esqueleto que valida legalidad y transiciona fases (sin scoring aún); action log; `schemaVersion` + 1ª migración trivial. Round-trip JSON (INV-4); "aplicar log reconstruye estado idéntico". *DoD:* re-aplicación de log determinista.

**BLOQUE 3 — MOTOR DE PUNTUACIÓN (núcleo).** Detección de tipo de mano (incl. manos especiales detectables); pipeline §7.3 con orden estricto y **aritmética de punto fijo (§7.3.1)** para que las semillas compartidas coincidan en todo dispositivo; niveles de mano; mejoras+sellos de carta; retriggers con tope (§7.6); hooks del DSL (§5.4 y Apéndice 22.5) con orden documentado. Suite exhaustiva: **ambos tests de oro (§7.8 = 787 y 1207)**, casos límite (As 1/11, color vs escalera, full/trío, Quinteto, orden de reliquias en ×mult, tope retrigger), y un **test de igualdad cross-device** (mismo seed+log → misma puntuación, ejecutado dos veces). *DoD:* >60 tests verdes; tests de oro exactos; puntuación 100% determinista en enteros.

**BLOQUE 4 — Estructura de run + mapa + Cordura.** Generación de mapa ramificada determinista (§9.2); nodos; objetivos §9.3; velas (§9.5); Cordura (§10) con sus umbrales y bono de mult; recompensas/draft; economía §13.3. Simulación end-to-end por acciones en Node (llega al jefe, gana/pierde). *DoD:* simular run completa sin render; Cordura afecta scoring correctamente.

**BLOQUE 5 — Content registry + DSL de efectos.** `packages/content` con el modelo de datos (§5.4); intérprete de efectos declarativos en el engine; primeras ~20 reliquias representativas (una por arquetipo) + augurios/sellos básicos como prueba del DSL; tests por efecto en aislamiento. *DoD:* las 20 reliquias dan efectos correctos vía data, sin `if` por id en el engine.

**BLOQUE 6 — Render del juego (PixiJS): tablero y cartas.** `packages/game-render`: escena de combate; cartas como sprites compuestos (capas §6.5); repartir/seleccionar/jugar/descartar leyendo snapshots; shaders 2.5D (tilt+especular) y acabados (foil/holo/espectral/polícromo §6.6); integración app/web (canvas + HUD React vía Zustand). *DoD:* jugar un combate completo con ratón, a 60fps, visualmente.

**BLOQUE 7 — Game feel + audio base.** Toda la §14.1: pops, shake escalado, ralentí de crítico, drag físico, transiciones; capas de audio Howler (§14.2) con crossfade; tonos por tier de mult; toggle "Reducir efectos". *DoD:* un crítico se *siente*; checklist de juice revisado; audio reacciona al estado.

**BLOQUE 8 — Los Recipientes.** Los 6 (§8) con mecánica única, mazo inicial, reliquia inicial, sesgo de pool; selección de Recipiente en el shell con lore/preview; sus 30 reliquias exclusivas. Tests de mecánica por Recipiente. *DoD:* cada Recipiente se juega distinto; mecánicas verificadas.

**BLOQUE 9 — CONTENIDO MASIVO I (reliquias).** Las 60 reliquias generales (§11.1) como data + efectos declarativos (DSL, Apéndice 22.5); pity/lástima de rareza (§2.2); pools por Sima/Recipiente; tests por reliquia. Verificar que los 8 arquetipos (§13.4) son viables. *DoD:* run jugable con pool completo; arquetipos viables; sin `if`-por-id.

**BLOQUE 10 — CONTENIDO MASIVO II (arcanos, vales, mejoras).** Augurios (§11.2), Sellos (§11.3), Conjuros (§11.4), Vales (§11.5), mejoras/sellos de carta completos (§11.6); tienda funcional (§11.10) con rerolls y sesgos. *DoD:* economía y modificación de mazo completas; tienda real.

**BLOQUE 11 — JEFES.** Los 24 jefes (§11.7) con modificador, tell, infección de orla (§6.7) y fases; preview de jefe (§9.4); pools por Sima con no-repetición; jefe final del Umbral 8 con sus fases. Tests de modificadores. *DoD:* enfrentar cada jefe; modificadores correctos; la orla reacciona.

**BLOQUE 12 — EVENTOS + ÉLITES + SANTUARIOS.** 40 eventos (§11.9) con copy de grimorio y efectos; 10 modificadores de élite (§11.8); Santuarios (§10.5); nodos Descanso. *DoD:* el mapa ofrece decisiones reales y variadas.

**BLOQUE 13 — Identidad visual + firma + pantallas.** Tokens §6.2, paletas por Sima §6.3, tipografía §6.4, **la orla que respira** §6.7, todas las pantallas del shell (§6.9), pantalla de jefe cinematográfica, fin de run con stats. Pase de pulido contra la skill de diseño (nada templado). *DoD:* captura de La Madre Pálida / El Fondo Mismo que dé escalofrío; revisión de identidad.

**BLOQUE 14 — Supabase: auth, persistencia, sync.** Esquema §15, RLS, login email-link, guardar/reanudar run (IndexedDB↔servidor), unlocks/logros sync (merge no destructivo), Codex/Grimorio (§12.4). Juego completo sin login en local. *DoD:* cerrar sesión y volver conserva progreso; local también funciona.

**BLOQUE 15 — Marcador de amigos + guardado en nube.** Subida de puntuación a `scores` (por confianza, §16), vistas de marcador por modo (§15), guardado/reanudar run desde la nube (`run_saves`), repetición opcional de una run desde `seed+action_log`. *DoD:* tu puntuación aparece en el marcador del grupo; reanudas una run en otro dispositivo; (opcional) ves la repetición de una run.

**BLOQUE 16 — Modos: diario, semanal, infinito, desafíos, custom.** Seeds diaria/semanal (§12.5) con mutadores (semilla compartida entre amigos); Modo Infinito (§9.6) con escalado y jefes corruptos; 20 desafíos (§12.7); modo personalizado (§12.8). Marcador de amigos por cada modo. *DoD:* todos los modos jugables; el pique de la seed del día funciona.

**BLOQUE 17 — Velos + desbloqueos + logros.** 20 Velos por Recipiente (§12.1); árbol de desbloqueos (§12.2); ~100 logros (§12.3) con notificación; cosméticos. *DoD:* escalera de dificultad funcional; desbloqueos y logros se conceden correctamente.

**BLOQUE 18 — Cordura visual + alucinaciones.** Efectos de Cordura (§6.8/§10.4): viñeta, aberración, alucinaciones (cartas falsas) con tells; integración con Recipiente Profano. *DoD:* el terror de Cordura baja se siente; alucinaciones deterministas y detectables.

**BLOQUE 19 — Balanceo basado en datos.** `packages/sim` juega miles de runs por arquetipo/Velo; reporta win-rate, distribución de score, reliquias muertas/rotas; ajuste de números (nueva `rulesetVersion`, INV-7); telemetría in-game (§15). *DoD:* win-rates dentro de objetivos §13.2; sin reliquias muertas evidentes; informe de balanceo.

**BLOQUE 20 — Accesibilidad + opciones + pulido.** Toda la §18; opciones de velocidad de animación; daltonismo; teclado; créditos/licencias (§17). *DoD:* checklist de accesibilidad; jugable cómodo en sesiones largas.

**BLOQUE 21 — Performance + lanzamiento.** Atlas de texturas, batching, DPR techo, audio sprites, code-splitting del shell; QA final; deploy productivo a Vercel + dominio; Supabase producción; monitorización. *DoD:* 60fps estables; build de producción sin warnings de tipo; checklist de lanzamiento.

**BLOQUE 22 — Contenido extendido (post-MVP, opcional).** Reliquias adicionales bien diseñadas si el grupo pide más variedad (manteniendo la regla de "personalidad, no relleno"), manos especiales completas, jefe El Huésped, El Que Mira Desde Fuera (Infinito), más eventos/desafíos, cosméticos. *DoD:* contenido nuevo equilibrado con los arquetipos existentes.

---

# 20. CRITERIOS GLOBALES DE "HECHO"
- INV-1..INV-7 + INV-ARTE respetados y verificables.
- El engine corre idéntico en Node y navegador (mismo resultado bit a bit → semillas compartidas).
- La puntuación es 100% determinista en punto fijo: misma seed+acciones = misma puntuación en cualquier dispositivo.
- Una run completa (8 Umbrales) es jugable, se siente bien; el marcador de amigos y el guardado en nube funcionan (sin validación de servidor, por diseño).
- Los 6 Recipientes se juegan distinto; los 8 arquetipos son viables; los 24 jefes funcionan.
- Modos diario/semanal/infinito/desafíos/custom operativos (con semilla compartida entre amigos); 20 Velos por Recipiente.
- Cero `any` implícito; build de producción sin warnings de tipo; Biome limpio.
- Suite de tests del engine + `sim` como red de seguridad del balanceo.
- Cobertura de contenido objetivo: **90 reliquias** (60 generales + 30 de Recipiente), ~60 arcanos/vales, 24+2 jefes, 40 eventos, ~100 logros, cientos de entradas de Codex.

---

# 21. ROADMAP POST-LANZAMIENTO
1. **Recipientes nuevos** (cada uno multiplica rejugabilidad × 20 Velos).
2. **Sima IV / actos adicionales** con jefes y eventos propios.
3. **Manos especiales** ampliadas y reliquias que las exploten.
4. **Eventos estacionales / mutadores semanales rotativos.**
5. **Modo "Ascensión semilla compartida"** competitivo (misma run para todos, ventana temporal).
6. **i18n** (la arquitectura ya lo soporta; activar idiomas).
7. **Móvil/táctil** nativo (rediseño de la mano para toque).
8. **Taller de la comunidad** (compartir seeds/desafíos custom).
9. **Cosméticos y temas de orla** adicionales.

---

# 22. APÉNDICES

## 22.1 Glosario
- **Umbral:** un "ante"; nivel de profundidad con su mapa y jefe.
- **Sima:** acto (grupo de Umbrales) con paleta y tono propios.
- **Recipiente:** clase jugable con mecánica única.
- **Reliquia:** objeto pasivo persistente (≈"joker") con efecto declarativo.
- **Augurio/Sello/Conjuro:** arcanos consumibles (modificar carta / subir nivel de mano / efecto espectral).
- **Vale:** mejora permanente de la run.
- **Cordura:** recurso de horror/riesgo global.
- **Vela:** vida; se apagan al fallar combates.
- **Velo:** nivel de dificultad ascendente.
- **Mejora/Sello de carta:** modificador permanente sobre una carta del mazo.
- **Retrigger:** re-disparo de una carta al puntuar.
- **Breakpoint:** umbral de sinergia donde un build "despega".

## 22.2 Fórmulas de referencia
- Puntuación: `floor(FICHAS_TOTAL × MULT_TOTAL)`; orden: sumas a fichas → sumas a mult → ×mult (reliquias izq→der). (§7.3)
- Bono mult por Cordura: `floor((100 − cordura) / 10)`. (§10.3)
- Interés: `min(tope, floor(oro / 5))`. (§13.3)
- Objetivo: tabla §9.3 × (1 ± 0.05 determinista) × modificadores de Velo (§12.1).
- Tope de retrigger por carta: 20 (salvo "Sin Fondo", §11.1.m). (§7.6)

## 22.3 Tablas maestras (referencia rápida)
- Tipos de mano y niveles: §7.4.
- Objetivos por Umbral: §9.3.
- Umbrales de Cordura: §10.2.
- Velos 0-20: §12.1.
- Win-rate objetivo: §13.2.
- Arquetipos y breakpoints: §13.4.

## 22.4 Preguntas que DEBES hacer antes de implementar (si aplica)
Si algo no está claro **al implementarlo**, PARA y pregunta. No asumas:
1. Versiones exactas de PixiJS v8 / Next 16 / Supabase si hay incompatibilidad de install.
2. Proveedor OAuth (si se añade además de email-link).
3. Dominio/proyecto Vercel y proyecto Supabase concretos.
4. Fuentes/arte/audio con licencia concretos (el arquitecto los provee, §17).
5. Cualquier número de balanceo que el arquitecto quiera mover respecto a este documento.

Todo lo demás está decidido aquí. Ejecuta **bloque a bloque, con gate**, empezando por el **Bloque 0**. Espera `OK`.

---

# 23. DESPLIEGUE EN VERCEL + SUPABASE

> El juego se sube a Vercel. Esta sección fija la topología exacta para que no haya sorpresas (especialmente cómo se sirven los atlas pesados). Como no hay anti-trampas (§16), la topología es simple.

## 23.1 Topología
```
Navegador ──► apps/web en VERCEL (Next 16: shell SSR + canvas Pixi cliente)
                 │  Route Handlers (/api/scores, /api/save)
                 ▼
            SUPABASE (gestionado)
            ├── Postgres + RLS (perfiles, scores, run_saves, unlocks…)
            ├── Auth (email magic link)
            └── Storage (atlas/audio pesados servidos por CDN)
```
**Sencillo a propósito.** Como NO hay anti-trampas (§16), no hay re-simulación ni Edge Functions. El cliente sube su puntuación y su guardado a Supabase a través de Route Handlers de Next (en Vercel) que solo autentican y validan el formato (Zod). Toda la lógica de juego corre en el cliente (engine + Pixi). Supabase es persistencia: auth, guardado en nube y el marcador de amigos.
> Si algún día abres el juego al público y quieres competición seria, el engine (TS puro, INV-3) podría re-simular en una función servidor. No se implementa ahora.

## 23.2 Configuración de Vercel (monorepo)
- **Proyecto Vercel** apunta a la raíz del monorepo; **Root Directory** del proyecto = `apps/web`.
- **Framework Preset:** Next.js. **Package manager:** pnpm (Corepack).
- **Build:** Turborepo (`turbo run build --filter=web...`) para construir `web` y sus dependencias (`engine`, `content`, `shared`, `game-render`).
- **Remote Cache de Turborepo** activado en Vercel → builds incrementales rápidos.
- **Ignored Build Step:** opcional, para no redeployar si solo cambian packages no usados por `web`.
- **Preview deployments** por rama (cada bloque/PR genera su preview para validar el gate visualmente). **Producción** en `main`.

## 23.3 Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → cliente (públicas, RLS protege).
- `SUPABASE_SERVICE_ROLE_KEY` → **solo** en Route Handlers/Server (NUNCA expuesta al cliente; nunca con prefijo `NEXT_PUBLIC_`). Se usa para escrituras controladas (marcador, guardado) si hiciera falta; en muchos casos basta la anon key + RLS.
- `RULESET_VERSION` → versión de contenido/balanceo activa (debe coincidir cliente/servidor, INV-7).
- Separar entornos: Preview vs Production con sus propias claves/proyecto Supabase si se quiere staging.
- Validar todas con Zod en arranque (falla rápido si falta alguna).

## 23.4 Assets pesados (atlas/audio) y CDN
- Atlas de cartas/UI ligeros → `apps/web/public/assets/...` (servidos por la CDN de Vercel, con hash + headers inmutables).
- **Láminas de jefes, atlas grandes y audio** pueden superar lo cómodo para el bundle de despliegue → servir desde **Supabase Storage** (o Vercel Blob) por CDN, cargados bajo demanda por Sima (§17.12). Evita inflar el despliegue de Vercel y mejora el TTI.
- Headers: `Cache-Control: public, max-age=31536000, immutable` para todo asset con hash en el nombre.

## 23.5 SSR-safety del juego
- El canvas Pixi y todo `game-render` se montan **solo en cliente**: `next/dynamic` con `{ ssr: false }`. Pixi nunca se importa en código que corra en el servidor (rompería el build).
- El shell (menús, leaderboard, codex) sí es SSR/PPR para SEO y carga rápida; el juego es una isla cliente.
- `'use client'` acotado a los componentes que tocan Pixi/Zustand/efectos.

## 23.6 Base de datos y CI
- **Migraciones** versionadas en `supabase/migrations`; se aplican vía Supabase CLI en un paso de CI (no `migrate dev` a mano en prod; aditivas, INV-6).
- **RLS** verificada con tests antes de exponer (un usuario no puede leer/escribir datos de otro; los marcadores-vista sí son públicos para el grupo).
- CI (GitHub Actions o Vercel): `typecheck → test (engine/content/shared) → build`. El deploy a producción solo si verde.

## 23.7 Checklist de "subible a Vercel"
✔ `apps/web` build local y en Vercel verde · ✔ env vars en Vercel (Preview+Prod) · ✔ Supabase proyecto con migraciones + RLS · ✔ Pixi en isla cliente (no SSR) · ✔ atlas pesados en Storage/CDN · ✔ headers inmutables en assets · ✔ dominio asignado · ✔ marcador y guardado escriben vía Route Handler (Zod) con RLS.

---

# 24. MANUAL DE OPERACIÓN PARA CLAUDE CODE

> Reglas de trabajo para que la ejecución sea impecable y no se rompan invariantes. Esto complementa §0.

## 24.1 Las reglas de oro (recordatorio operativo)
1. **No decides diseño.** Falta algo → PARAS y preguntas (§22.4). No inventas.
2. **Gate por bloque.** Cierras bloque → resumes + cómo probarlo + esperas `OK`. No encadenas.
3. **Invariantes (§0.1) y INV-ARTE (§17.5) jamás se violan.** Si una tarea los contradice, paras y avisas.
4. **Tests antes de seguir.** El motor (Bloque 3) pasa su suite antes de dibujar; cada bloque cumple su DoD.
5. **Todo contenido es data (§5.4).** Cero `if (id === ...)` en el engine.

## 24.2 Convenciones de repositorio
- **Estructura:** la de §4 (7 packages). Nada de lógica de juego fuera de `engine`; nada de Pixi fuera de `game-render`; nada de contenido fuera de `content`.
- **Naming:** ficheros `kebab-case`; tipos/Interfaces `PascalCase`; funciones/vars `camelCase`; ids de contenido `dominio.nombre_snake` (`relic.espejo_negro`, `boss.madre_palida`).
- **Imports:** absolutos por package (`@umbral/engine`, `@umbral/shared`…). El engine NO importa de `web`/`game-render`/`react`/`pixi` (INV-3, comprobable con un lint rule de imports prohibidos).
- **Sin efectos secundarios en módulos:** nada de estado global mutable; el PRNG vive en el estado (§5.3).

## 24.3 Estilo y calidad
- TS strict (flags §0). Cero `any` implícito. `@ts-expect-error` solo con comentario.
- **Biome** para lint+format (no ESLint/Prettier). Pre-commit: typecheck + biome + test rápido.
- Funciones puras donde se pueda; `reduce` siempre puro y síncrono (§5.2).
- Comentarios solo donde el "por qué" no es obvio; el código se explica solo.

## 24.4 Testing
- **Vitest** en `engine`, `content`, `shared`. El engine es el que más cobertura exige (es la red de seguridad del balanceo).
- Obligatorios: los **dos tests de oro** (§7.8), casos límite de manos (§7.8), un test por reliquia de efecto (§19 Bloque 9), tests de determinismo/streams (§19 Bloque 1), round-trip de estado (Bloque 2), simulación end-to-end (Bloque 4), **igualdad cross-device** (mismo seed+log → misma puntuación en punto fijo, Bloque 3).
- **`packages/sim`**: el CLI de balanceo (Bloque 19) corre miles de runs y reporta; no es test unitario pero su salida se versiona.
- **Playwright**: smoke E2E del shell (arranca, navega, inicia run, juega una mano). No exhaustivo.

## 24.5 Git y entrega
- **Rama por bloque** (`block/03-scoring-engine`), PR con descripción de qué cubre y cómo probar.
- **Merge `--no-ff`**, **tag por bloque** (`v0.3.0`). Commits atómicos y descriptivos en español o inglés consistente.
- Nada de "WIP" mezclado entre bloques: cada bloque entra completo y verde.

## 24.6 Manejo de errores y robustez
- Bordes con Zod (red/saves/env): fallo claro, nunca estado corrupto.
- Carga de save: si `schemaVersion` < actual → migrar (§5.5); si falla migración → no romper, avisar y ofrecer empezar de cero sin perder otros datos.
- Render: si falta un asset → placeholder premium (§17.13), no crash.
- Audio: si Howler falla, el juego sigue (audio es no-crítico).
- Red: submit de leaderboard con reintento + cola offline; el progreso local nunca depende de la red (INV-6).

## 24.7 Orden de ejecución y pistas transversales
- El **orden de bloques (§19)** es deliberado: motor y feel antes que contenido masivo.
- **Producción de arte (§17)** corre como **pista paralela**: el kit PBR base (§17.8) y el shader de material (§17.11) se necesitan en Bloque 6; las láminas finales entran por tandas mientras los placeholders premium (§17.13) sostienen el resto. No bloquees jugabilidad esperando arte final.
- Cuando dudes entre dos implementaciones con impacto de diseño/balanceo/coste, **PARA y pregunta** con una recomendación.

## 24.8 Qué NO hacer (errores a evitar)
- ❌ `Math.random()` en cualquier ruta de estado (rompe INV-1 y las semillas compartidas entre amigos).
- ❌ Coma flotante en la puntuación (rompe la igualdad cross-device; usa punto fijo, §7.3.1).
- ❌ Importar Pixi/DOM en `engine` (rompe INV-3 y la reproducción/repetición por seed).
- ❌ Lógica de reglas en `game-render` o en el store Zustand.
- ❌ `if` por id de contenido en el engine (rompe la escalabilidad, §5.4).
- ❌ PNG planos sin normal map para cartas/reliquias/jefes (rompe INV-ARTE, §17.5).
- ❌ Exponer `SERVICE_ROLE_KEY` al cliente.
- ❌ Añadir anti-trampas / validación de servidor sin orden explícita (es un juego entre amigos; no hace falta, §16).
- ❌ `DROP` destructivo de datos de jugador sin migración (rompe INV-6).
- ❌ Encadenar bloques sin gate.

---

# 25. MODELO DE DATOS CANÓNICO (TIPOS TYPESCRIPT — NO REINVENTAR)

> Formas canónicas para que Claude Code no improvise el estado. Se afinan en implementación pero la estructura es esta. Todo serializable (INV-4).

```ts
// ---- Cartas ----
type Suit = 'CALIZ' | 'LLAVE' | 'HUESO' | 'OJO';
type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14; // 11=J,12=Q,13=K,14=A
type Enhancement = 'grabado'|'marca'|'untado'|'dorado'|'cristal'|'piedra'|'espejo'|null;
type Seal = 'ocre'|'sangre'|'verdin'|'violeta'|'dorado'|null;
type CardId = string; // único por instancia en el mazo

interface Card {
  id: CardId;
  suit: Suit | null;   // null si Piedra
  rank: Rank | null;   // null si Piedra
  enhancement: Enhancement;
  seal: Seal;
  crystalCharges?: number; // para fragilidad de Cristal
}

// ---- Contenido (registry) ----
type Rarity = 'comun'|'pococomun'|'rara'|'espectral'|'maldita'|'legendaria';
type VesselId = 'heraldo'|'vidente'|'usurero'|'coleccionista'|'bestia'|'profano';

interface RelicInstance { defId: string; state?: Record<string, number>; } // escaladoras guardan su acumulado aquí
interface ConsumableInstance { defId: string; }

// ---- PRNG (streams) ----
interface RngState { s0: number; s1: number; s2: number; s3: number; } // mulberry32 x streams
interface RngStreams {
  deal: RngState; shop: RngState; map: RngState; boss: RngState;
  event: RngState; reward: RngState; halluc: RngState;
}

// ---- Mapa ----
type NodeType = 'combate'|'elite'|'tienda'|'evento'|'tesoro'|'descanso'|'santuario'|'jefe';
interface MapNode { id: string; type: NodeType; row: number; next: string[]; visited: boolean; }
interface UmbralMap { umbral: number; nodes: MapNode[]; currentNodeId: string | null; }

// ---- Combate ----
interface CombatState {
  objective: number;
  accumulated: number;
  handsLeft: number;
  discardsLeft: number;
  handSize: number;
  hand: CardId[];          // cartas en mano
  selected: CardId[];      // seleccionadas
  drawPile: CardId[];      // resto del mazo barajado
  bossId?: string;         // si es nodo jefe/élite
  bossState?: Record<string, number>; // fases, contadores del modificador
  combatRelicState?: Record<string, number>; // bonos temporales del combate (Eco, Frenesí…)
}

// ---- Run ----
type RunPhase = 'mapa'|'combate'|'tienda'|'evento'|'recompensa'|'descanso'|'santuario'|'jefe'|'fin';
interface GameState {
  schemaVersion: number;
  rulesetVersion: number;
  seed: string;
  vessel: VesselId;
  veil: number;            // nivel de dificultad
  mode: 'carrera'|'diario'|'semanal'|'infinito'|'desafio'|'custom';
  rng: RngStreams;
  phase: RunPhase;
  umbral: number;          // 1..8, 9+ = infinito
  sima: 1|2|3|4;           // 4 = bajo el fondo (infinito)
  candles: number;         // velas (vidas)
  maxCandles: number;
  sanity: number;          // 0..100
  maxSanity: number;
  gold: number;
  deck: Card[];
  relics: RelicInstance[]; // ORDEN importa (§7.3)
  relicSlots: number;
  consumables: ConsumableInstance[];
  consumableSlots: number;
  handLevels: Record<string, { level: number }>; // por tipo de mano
  vouchers: string[];      // vales activos (permanentes)
  map: UmbralMap | null;
  combat: CombatState | null;
  shop?: ShopState;
  pendingReward?: RewardState;
  pendingEvent?: { eventId: string };
  log: GameAction[];       // action log (sin TICK) — para guardar/reanudar y repetir/compartir la run
  result?: { status: 'won'|'lost'|'abandoned'; depth: number; score: number };
}

// ---- FeelEvents (cosméticos, ignorables sin perder corrección) ----
type FeelEvent =
  | { t: 'cardScored'; cardId: CardId; chips: number; mult: number; retrigger?: boolean }
  | { t: 'relicFired'; relicId: string; value: number; kind: 'fichas'|'mult'|'xmult' }
  | { t: 'scorePop'; total: number }
  | { t: 'shake'; intensity: number }
  | { t: 'slowmo'; ms: number }
  | { t: 'sanityShift'; delta: number }
  | { t: 'cardDestroyed'; cardId: CardId }
  | { t: 'bossReact'; bossId: string; cue: string }
  | { t: 'error'; reason: string };
```
(GameAction ya definido en §5.2. ShopState/RewardState siguen el mismo patrón serializable.)

---

# 26. PRESUPUESTOS DE RENDIMIENTO Y CHECKLIST DE LANZAMIENTO

## 26.1 Números duros (objetivos de rendimiento)
- **60 fps estables** en hardware medio durante el combate (frame budget 16.6 ms). 120 fps si el dispositivo lo permite y el ajuste lo pide.
- **Draw calls:** minimizados por **batching** y atlas; objetivo < ~150 por frame en combate típico. Sprites del mismo atlas se batchean.
- **DPR techo = 2** (no renderizar a 3x en móviles retina; mata el rendimiento sin ganancia perceptible).
- **Memoria de textura:** presupuesto objetivo < ~256 MB de VRAM de texturas activas; carga por Sima (no todo a la vez), atlas comprimidos (§17.12).
- **Bundle JS inicial del shell:** objetivo < ~200 KB gzip para el shell; `game-render` (Pixi + shaders) se **lazy-load** al entrar a una run (no penaliza el menú/leaderboard).
- **TTI del shell:** < 2.5 s en conexión media; el menú (SSR/PPR) pinta casi instantáneo, el juego carga al pulsar "descender".
- **Audio:** sprites Howler (un archivo + mapa) por categoría; nada de decenas de requests; descompresión perezosa.

## 26.2 Técnicas obligatorias
- Atlas + batching + culling de lo no visible.
- Object pooling de sprites de carta y de partículas (no crear/destruir por frame).
- Shaders compartidos (un programa de material parametrizado por uniforms, §17.11), no un shader por carta.
- `requestAnimationFrame` con time-scale para el ralentí; nunca lógica de juego en el tick de render (la lógica es `reduce`, §5.2).
- Code-splitting del shell por ruta (menú/leaderboard/codex/juego).
- Precarga en background de la siguiente Sima mientras se juega la actual.

## 26.3 Checklist de lanzamiento (Definition of Done global)
✔ INV-1..7 + INV-ARTE verificados · ✔ engine idéntico Node/navegador (puntuación en punto fijo) · ✔ semillas compartidas dan la misma run en todo dispositivo · ✔ run completa (8 Umbrales) jugable y con feel · ✔ 6 Recipientes distintos · ✔ 8 arquetipos viables (informe `sim`) · ✔ 24+2 jefes funcionando · ✔ modos diario/semanal/infinito/desafíos/custom (pique entre amigos) · ✔ 20 Velos por Recipiente · ✔ marcador de amigos + guardado en nube · ✔ Cordura + alucinaciones · ✔ **90 reliquias** + arcanos/vales · ✔ ~100 logros + Codex · ✔ todo el arte hero con normal map y reaccionando a la luz; lo plano con parallax+emisivo digno (§17.14) · ✔ 60 fps / presupuestos §26.1 · ✔ accesibilidad §18 · ✔ desplegado en Vercel + Supabase (§23.7) · ✔ cero warnings de tipo · ✔ Biome limpio · ✔ créditos/licencias completos.

— Fin de la Biblia + Prompt Maestro UMBRAL (v2.1) —
