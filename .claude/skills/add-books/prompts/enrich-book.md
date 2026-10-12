# Completar los libros nuevos de la propuesta

Trabajás sobre `{{proposal}}`: la propuesta de una tanda de {{site.name}} (libros que recomienda {{creator.name}}). {{creator.bio}}.

Para cada libro de `newBooks` con `include: true`, completá los campos del catálogo. `enrich` y `asin` ya pusieron lo que encontraron en Open Library y Amazon (`year`, `coverId`, `isbn`, `titleEs`, `asin`, `asinCandidates`); revisalos y corregí lo que esté mal.

- `id`: slug en kebab-case, corto y estable (título original; agregá el autor solo si hace falta desambiguar). Que no choque con `{{knownBooks}}`.
- `title`: título en su idioma original, forma corta sin subtítulo largo. `titleEs` si hay edición conocida en {{language}} y el título cambia.
- `authors`, `year` (primera publicación), `kind`: book | essay | paper | course | textbook.
- `topics`: ids de temas (hojas) de la taxonomía; el primero es el principal:
{{taxonomy}}
- `level`: {{levelLabels}}. Pensá a quién apunta el libro y qué presupone, no cuánto lo admira {{creator.name}}.
- `recommendation`: uno de {{recommendations}}, según cómo lo recomienda en las citas:
{{recommendationLabels}}
- `summary`: una o dos frases en {{language}} sobre de qué trata el libro (no sobre {{creator.name}}).
- `context`: una o dos frases sobre qué dice {{creator.name}} y por qué lo recomienda, en la voz del sitio ({{voice}}). Solo lo que está en las citas.
- `asin`: si hay `asinCandidates`, elegí el que sea el mismo libro (mejor la edición en {{language}}) y ponelo en `asin`; si ninguno coincide, dejalo vacío.

Estándar del sitio (no negociable): {{standard}}

Si al revisar un libro ves que no es una recomendación real, poné `include: false` y `excludeReason`. Editá solo `{{proposal}}`. Al terminar respondé con una línea por libro: id, nivel, tema principal, recommendation.
