@AGENTS.md

# dagerbooks

Sitio de los libros que recomienda Dager: mapa radial (grafo) y de subte, rutas de lectura y novedades.
Producto y marca en `PRODUCT.md`; sistema visual en `DESIGN.md`; estado de diseño en `.impeccable/`.

- Los comandos se corren desde esta carpeta (`pnpm build`, `pnpm validate`, `pnpm parity …`) o desde la raíz con `pnpm --filter dagerbooks <script>`.
- El contenido vive en `content/`; `loadCatalog()` lo lee desde `process.cwd()/content`.
- Los datos de research quedan en `research/`, sin commitear.
