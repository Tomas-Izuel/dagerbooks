# estantes

Monorepo con un sitio por creador de contenido. Cada sitio muestra los libros que recomienda un creador,
con la fuente de cada recomendación. Hoy: `apps/dagerbooks`.

## Reglas

- **Una app por creador** en `apps/<creador>/`, con su propio `CLAUDE.md`, `PRODUCT.md` y `DESIGN.md`. Leé el de la app antes de tocarla.
- **Una app nunca importa otra app**, y nada de una app menciona a otro creador. La UI de cada sitio es propia.
- **`main` está protegida:** todo va por rama + PR.
- Los datos pesados (audio, transcripciones, snapshots) van en `apps/<creador>/research/` o en el SSD, nunca en `/tmp` ni en git.
- El plan de la migración a monorepo está en `docs/plan-monorepo.md` (sin commitear).
