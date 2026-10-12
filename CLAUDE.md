# estantes

Monorepo con un sitio por creador de contenido. Cada sitio muestra los libros que recomienda un creador,
con la fuente de cada recomendación. Hoy: `apps/dagerbooks`.

## Estructura

- `apps/<creador>/`: un sitio Next.js, con su `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/`, `creator.config.ts`, `catalog.ts` y `content/`. Un proyecto de Vercel por app (Root Directory = `apps/<creador>`).
- `packages/catalog` (`@estantes/catalog`): modelo de datos, validación y carga del catálogo (núcleo + módulos `progression`, `routes`, `updates`).
- `packages/kit` (`@estantes/kit`, `@estantes/kit/react`): lógica headless (búsqueda, SEO, afiliado, filtros en la URL, progreso, stores de localStorage).
- `tools/migrations/`: scripts únicos e idempotentes sobre el contenido.

## Reglas

- **Una app nunca importa otra app**, y nada de una app menciona a otro creador. La UI de cada sitio es propia.
- **Los paquetes no tienen marca ni UI**: ni nombres, handles, dominios o colores de creadores, ni markup ni textos de interfaz. Reciben identidad y textos desde `creator.config.ts`.
- Leé el `CLAUDE.md` de la app antes de tocarla.
- Las claves de localStorage de un sitio publicado no cambian (cada app las fija en un test).
- Un refactor que no debería cambiar un sitio se verifica con la paridad de esa app (`pnpm parity`).
- **`main` está protegida:** todo va por rama + PR.
- Los datos pesados (audio, transcripciones, snapshots) van en `apps/<creador>/research/` o en el SSD, nunca en `/tmp` ni en git.

## Comandos (raíz)

`pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm validate`, `pnpm test` corren con Turborepo en todas las apps y paquetes; `pnpm --filter <app> <script>` para una sola.
