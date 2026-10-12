@AGENTS.md

# dagerbooks

Sitio de los libros que recomienda Dager: mapa radial (grafo) y de subte, rutas de lectura y novedades.
Producto y marca en `PRODUCT.md`; sistema visual en `DESIGN.md`; estado de diseño en `.impeccable/`.
Identidad, etiquetas, afiliado y canales en `creator.config.ts`; modelo del catálogo en `catalog.ts`.

## Comandos

Desde esta carpeta (o desde la raíz con `pnpm --filter dagerbooks <script>`):

- `pnpm dev`, `pnpm build` (valida el contenido antes de compilar)
- `pnpm validate`: valida `content/` y que los JSON Schema del editor estén al día; `pnpm schema` los regenera
- `pnpm test`: fija las claves de localStorage
- `pnpm check:subway`: invariantes del layout del subte
- `pnpm parity snapshot|diff|golden`: paridad del build para refactors (ver `scripts/parity/URLS.md`)

`loadCatalog()` lee `process.cwd()/content`. Los datos de research quedan en `research/`, sin commitear.

## Decisiones acordadas (no reabrir)

- **Contenido**: un archivo por libro en `content/books/<id>.yaml` (ver `content/books/README.md`), ordenados por `seq`; el layout desempata por ese orden, así que un libro nuevo va con el `seq` más alto + 1. Novedades en `content/updates/`, rutas en `content/routes.yaml`, temas (líneas) en `content/topics.yaml`, en orden circular.
- **Modelo**: módulos `progression`, `routes` y `updates` activos; tres niveles de recomendación (`fuerte`, `interesante`, `mencion`); `stance` opcional hasta el backfill. `level` 0 es la raíz única (`tom-sawyer-abroad`, el primer libro que leyó Dager, sin temas); los demás van de 1 (introductorio) a 4 (especialista). `confidence` se calcula: `low` si faltan `authors`, `summary`, `context` o `sources` ("por completar").
- **Invariantes** (en el build): ids referenciados existen, un `leadsTo` apunta a un nivel estrictamente mayor, sin ciclos, exactamente una raíz.
- **Grafo radial**: centro = raíz; anillos = nivel 1–4; sectores angulares = tema primario en el orden de `topics.yaml`, con ángulo mínimo. Posiciones calculadas en build en `lib/catalog/layout.ts` (puro, determinista). SVG + `d3-zoom` (no React Flow): aristas `leadsTo` hacia afuera, `related` como arcos tenues que se encienden al pasar.
- **Vista subte** (`?vista=subte`): una banda por línea desde el Km 0, niveles como zonas tarifarias, ramas a 45°; mismas estaciones, selección, filtros y progreso que el radial. Lógica en `lib/catalog/subway*.ts`.
- **Interacción**: click en un libro → resalta su cadena de prerrequisitos y lo que desbloquea, y abre el panel. El filtro de tema atenúa (no oculta). Búsqueda sin acentos que centra el resultado. Estado en la URL (`?tema=&libro=&q=&rec=&vista=&ruta=`).
- **Progreso**: "Lo leí", rutas seguidas, densidad y panel colapsado en localStorage con prefijo `dagerbooks:` (claves fijadas en `scripts/storage-keys.test.ts`).
- **Idioma y voz**: UI en español rioplatense; títulos en su idioma original, `titleEs` como subtítulo.
- **SEO**: `/libros/[slug]`, `/temas/[slug]`, `/rutas/[slug]` estáticas, con JSON-LD (`Book`, `ItemList`), sitemap, robots y OG por página.
- **Afiliado**: Amazon España con el tag de `creator.config.ts` (autorizado por Dager).
