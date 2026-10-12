---
name: updates
description: Escribe las novedades ("novedades" / content/updates) de los sitios afectados por un cambio. Usala antes de abrir un PR que cambie algo visible en un sitio, al cerrar una tanda de /add-books, o cuando el usuario pida "/updates". Detecta qué apps cambian, decide si el cambio se ve para el lector y escribe una entrada por app en la voz de ese creador.
---

# /updates

Cada sitio tiene sus novedades en `apps/<creador>/content/updates/<fecha>-<slug>.yaml` (una por archivo; se ven en el aviso de la home y en `/novedades`). Esta skill decide qué sitios necesitan una entrada y la escribe.

## Cuándo

- Antes de abrir un PR que cambie algo que un lector ve (copy, UI, datos, una capacidad nueva).
- Al final de cada tanda de `/add-books` (libros nuevos del lote).
- A pedido: `/updates [--base <ref>]` (por defecto `origin/main`).

## Pasos

1. **Sitios afectados (determinístico).** Corré `pnpm pipeline affected --base <ref>`. Devuelve `[{ app, reasons: [{ file, capability }] }]`:
   - `apps/<x>/**` afecta solo a `<x>` (salvo `research/`, `scripts/`, `.impeccable/` y `.md`);
   - un módulo del catálogo (`module:routes`, …) solo a las apps que lo activan;
   - `affiliate` solo a las apps con afiliado; `suggestions` solo a las que usan el formulario;
   - el resto de `packages/catalog` y `packages/kit` a todas; tests, `packages/pipeline` y tooling a ninguna.
2. **¿Se ve? (juicio).** Por cada app, mirá el diff de sus `reasons` (`git diff <base> -- <files>`). Sin entrada si es refactor, tests, tipos, tooling, CI o un cambio que el lector no nota (por ejemplo, una paridad idéntica). Ante la duda, preguntale al usuario. Si ninguna app necesita entrada, decilo y poné `updates: none` en la descripción del PR.
3. **Escribí una entrada por app**, cada una pensada para ese sitio:
   - Leé `apps/<x>/creator.config.ts` (`site.name`, `voice`, `name`) y `apps/<x>/PRODUCT.md`. Escribí en **su** idioma y **su** voz (por ejemplo, rioplatense con voseo para dagerbooks).
   - **Nunca** menciones a otro creador, a otra app, "monorepo", "paquete", "kit" ni detalles técnicos. Hablale al lector: qué puede hacer ahora que antes no.
   - El texto es propio de cada sitio: no copies la misma frase a todas las apps.
   - Límites (`UPDATE_LIMITS`): `title` hasta 70 caracteres, cada mejora hasta 140, de 1 a 5 mejoras, `stream.title` hasta 120.
   - Slug: `libros` para una tanda de libros (con `books` y, si salen de un solo video o stream, `stream`); para una función, un slug corto de la función.
4. **Guardala con la CLI**, que crea o extiende sin duplicar. Escribí el JSON en el scratchpad y corré:
   ```bash
   pnpm pipeline update-entry --creator <x> --file <entry.json>
   ```
   ```json
   { "slug": "libros", "title": "…", "books": ["id-1", "id-2"], "stream": { "title": "…", "url": "…" }, "improvements": ["…"] }
   ```
   - Si ya hay una entrada con la misma fecha y slug, la extiende: une `books`, conserva `stream` solo si es el mismo y suma mejoras nuevas.
   - Si quedarían más de 5 mejoras, falla: condensá frases parecidas y volvé a correr; si no se puede, usá `--split` (crea `<fecha>-<slug>-2`).
   - La CLI valida el catálogo después de escribir.
5. Mostrale al usuario cada entrada (app, título, mejoras) antes de commitear.
