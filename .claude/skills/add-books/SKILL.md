---
name: add-books
description: Incorpora libros nuevos al catálogo de un creador (apps/<creador>). Procesa las sugerencias abiertas del repo de sugerencias y el contenido nuevo de sus canales (videos, streams, reels), extrae los libros con agentes, cruza todo en una propuesta que revisa el dueño, completa metadata, escribe los libros, ajusta progresión y rutas si el sitio las usa, escribe la novedad y abre un PR por tanda. Usala cuando el usuario pida "/add-books <creador>", sumar libros, procesar sugerencias o ponerse al día con un creador.
---

# /add-books <creador>

Todo lo determinístico lo hace la CLI (`pnpm pipeline <cmd> --creator <creador>`, ver `packages/pipeline/src/cli.ts`). Lo que pide juicio lo hacen agentes con las plantillas de `prompts/`, que se rellenan con `pnpm pipeline prompt <plantilla> --creator <creador> [--source id] [--batch f] --set clave=valor … --out <archivo>` (falla si falta una variable). El dueño revisa en dos compuertas antes de que algo llegue al catálogo.

## 0. Antes de empezar

- Leé `apps/<creador>/CLAUDE.md` y `creator.config.ts` (módulos, canales, voz, estándar).
- `pnpm pipeline state --creator <creador>`: qué hay descubierto, transcripto y extraído.
- Datos fuera de git en `PIPELINE_DATA_DIR` (por defecto `research/<creador>/` del clon). **Desde un worktree, exportá `PIPELINE_DATA_DIR` al clon principal**: los worktrees no ven archivos sin trackear.
- Herramientas: `uvx` (yt-dlp), `mlx-whisper` (solo Apple Silicon, se baja con uvx), `gh` con acceso al repo de sugerencias.
- Trabajá en una rama nueva desde `origin/main` (`main` está protegida).

## 1. Sugerencias de lectores

```bash
gh issue list --repo "$SUGGESTIONS_REPO" --label "creator:<creador>" --state open --json number,title,body
```

Por cada issue, el bloque `yaml` del cuerpo trae `title`, `link`, `minute` y `comment`.
1. Si el link es de una fuente sin transcripción: `pnpm pipeline discover` (si no está en el estado) y `fetch-subs`/`transcribe`.
2. Un agente por issue con `pipeline prompt verify-suggestion --set issue.number=<n> --set "issue.yaml=<bloque>" --set out=<datos>/extractions/issue-<n>.json`.
3. Según el veredicto:
   - `confirmado`: entra a la tanda (el archivo ya está en formato de extracción).
   - `ya-esta`, `no-encontrado`, `no-recomienda`: **mostrale al dueño la lista** y, con su ok, respondé y cerrá con `gh issue close <n> --repo … --comment "<comment>"`. Anotalo en el estado (`issues` en `packages/pipeline/state/<creador>.yaml`).

## 2. Contenido nuevo

```bash
pnpm pipeline discover   --creator <c>            # canales de YouTube de la config
pnpm pipeline discover   --creator <c> --from-export <dir>   # export oficial de Instagram
pnpm pipeline fetch-subs --creator <c>            # subtítulos → txt (transcribed)
pnpm pipeline transcribe --creator <c> [--ids …]  # Whisper para lo que no tiene subtítulos
pnpm pipeline batch      --creator <c>            # tandas de ~600 KB de texto
```
- Avisale al dueño cuántas fuentes nuevas hay y cuánto tardaría transcribir antes de correr Whisper sobre muchas horas.
- Lo que no tiene libros por título obvio (música, gameplay) se puede saltear con `mark --status skipped --reason …`, con el ok del dueño.

## 3. Extracción (agentes)

Un agente por tanda o parte, en paralelo, cada uno con su prompt:
- Videos cortos: `prompt extract-batch --batch <datos>/batches/bNN.tsv --set out=<datos>/extractions/bNN.json`.
- Videos largos o streams (más de ~1 h): `pipeline split --id <id>` y `prompt extract-long --source <id> --set part=partN --set out=<datos>/extractions/<id>-partN.json`, un agente por parte.
- Reels: `prompt extract-reel --batch … --set out=…`.

Después: `pnpm pipeline mark --creator <c> --ids <ids leídos> --status extracted`.

## 4. Propuesta → Compuerta 1

```bash
pnpm pipeline merge-extractions --creator <c> --name <fecha> [--video <id> si son partes de un solo video]
```
Escribe `<datos>/proposals/<fecha>.json` y `.md`. **Mostrale al dueño el `.md`**: nuevos incluidos, excluidos por motivo, fuentes nuevas para libros existentes y opiniones sobre el orden. Que confirme o corrija (`include`, `excludeReason`) antes de seguir.

## 5. Metadata y textos → Compuerta 2

```bash
pnpm pipeline enrich --creator <c> --proposal <json>   # Open Library
pnpm pipeline asin   --creator <c> --proposal <json>   # Amazon (tienda de la config)
```
Después, un agente con `prompt enrich-book --set proposal=<json>` completa `id`, `topics`, `level`, `recommendation`, `summary`, `context` y elige el ASIN entre los candidatos. **Mostrale al dueño una línea por libro** (id, nivel, tema, recommendation) y los `summary`/`context` dudosos.

```bash
pnpm pipeline write-books --creator <c> --proposal <json> --dry   # revisar
pnpm pipeline write-books --creator <c> --proposal <json>         # escribe, valida, registro y estado
```

## 6. Progresión (solo con `modules.progression`)

Solo para las líneas de los libros nuevos:
1. Un agente por línea con `prompt plan-progression --set topic=<línea> --set out=<datos>/roadmaps/<línea>.json`.
2. `pnpm pipeline apply-roadmaps --creator <c> --dir <datos>/roadmaps --dry`, revisá los errores y aplicá sin `--dry`.
3. Si hay tramos a pie nuevos (`fuerte`/`muy-fuerte`), juntalos en `<datos>/roadmaps/gap-candidates.json` y corré un agente con `prompt calibrate-gaps --set candidates=… --set out=<datos>/roadmaps/calibration.json`; después `apply-calibration --file …`.

## 7. Rutas (solo con `modules.routes`)

1. `prompt routes-propose --set proposal=<json> --set "newBooks=<ids>" --set out=<datos>/routes/propuesta.json`. Si no hay cambios, seguí.
2. `pnpm pipeline routes-export --creator <c> --out-dir <datos>/routes/out` (las rutas actuales, para no perderlas).
3. Un agente por ruta nueva o ajustada con `prompt routes-write --set routesProposal=… --set routeIds=<ids> --set outDir=<datos>/routes/out`.
4. Un agente con `prompt routes-review --set outDir=… --set out=<datos>/routes/review.md`.
5. `pnpm pipeline routes-assemble --creator <c> --out-dir <datos>/routes/out --proposal <datos>/routes/propuesta.json`.

Las rutas van en un commit aparte del de libros.

## 8. Cierre

1. `pnpm --filter <c> validate` y `pnpm --filter <c> build`.
2. `/updates`: entrada `libros` con los ids nuevos y, si salen de un solo video o stream, ese `stream`.
3. Commits: libros (+ registro y estado), rutas, novedad. Abrí un PR (nunca mergees) con:
   - resumen de la tanda (nuevos, fuentes sumadas, progresión, rutas);
   - `Closes <owner>/<repo-sugerencias>#N` por cada issue confirmado. Si el cierre entre repos no funciona, cerralos con `gh` después del merge.

## Modo programado (futuro)

El mismo flujo sin compuertas interactivas corre como rutina en modo "solo propuesta": se detiene en la Compuerta 1, abre el PR como **draft** con la propuesta y nunca escribe libros sin revisión.
