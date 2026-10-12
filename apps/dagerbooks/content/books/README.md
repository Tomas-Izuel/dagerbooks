# Libros

Un archivo por libro: `content/books/<id>.yaml`. El nombre del archivo es el `id`.
Cada archivo empieza con `# yaml-language-server: $schema=../book.schema.json` para tener autocompletado.

## Campos

Obligatorios: `id`, `title`, `topics`, `level`.

| Campo | Qué va |
|---|---|
| `id` | slug en kebab-case, único, igual al nombre del archivo (ej. `atomic-habits`) |
| `seq` | orden editorial: el layout del mapa desempata por este orden. Un libro nuevo va con el más alto + 1; si falta, queda al final |
| `title` | título en el idioma original (forma corta, sin subtítulo largo) |
| `topics` | ids de `topics.yaml`; el primero es el sector donde se dibuja el libro |
| `level` | 1 introductorio · 2 intermedio · 3 avanzado · 4 especialista (0 = raíz, solo Tom Sawyer Abroad) |

Opcionales: `titleEs`, `authors`, `year`, `kind` (book | essay | paper | course | textbook), `summary`, `context`,
`sources` [{url, title, timestamp, quote, stance}], `leadsTo`, `related` [{id, reason}], `isbn`, `coverId`, `asin`,
`recommendation`.

- `asin`: código de Amazon (10 caracteres) para el link de compra.
- `recommendation`: cuánto lo recomienda Dager, para filtrar en el sitio. Si falta vale `interesante` y no cuenta como "por completar".
  - `fuerte`: lo recomienda con énfasis: lectura imprescindible o favorita, insiste en que lo lean.
  - `interesante`: lo valora o lo recomienda con tibieza o reservas; tiene ideas que le sirven.
  - `mencion`: lo cita o lo nombra sin recomendarlo.
- Si faltan `authors`, `summary`, `context` o `sources`, el sitio muestra "por completar".
- `leadsTo`: ids de libros que conviene leer después de este (el nivel del destino debe ser mayor).
- Tramo a pie: un `leadsTo` puede ser un id o `{ id, gap: { severity: fuerte | muy-fuerte, bridge: [1 a 5 temas], note? } }`.
  Se usa cuando el salto de nivel es grande y Dager no tiene libro para el medio; `bridge` son temas a investigar, no recomendaciones.
- `related`: puentes entre sectores, con una razón corta; declará cada par una sola vez.

`pnpm validate` (desde `apps/dagerbooks`) valida todo y nombra el libro y el campo de cada problema.
