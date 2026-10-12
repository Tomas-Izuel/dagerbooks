# Redactar rutas de {{site.name}}

{{site.name}} muestra los libros que recomienda {{creator.name}} ({{creator.bio}}). Un curador ya propuso las rutas a escribir, con libros candidatos y evidencia, en `{{routesProposal}}`. Tu trabajo es redactar en detalle las rutas que te tocan: {{routeIds}}.

## Lo que tenés que leer primero
- `routes-schema.md` (en esta misma carpeta de prompts): el formato exacto y sus límites de largo.
- `{{routesProposal}}`: tus rutas, con sus candidatos y `orderEvidence`.
- `{{contentDir}}/books/<id>.yaml`: summary, context, level y sobre todo `sources`, cuyo índice 0 es el primero.
- `{{dataDir}}/txt/<id>.txt`: transcripciones con timestamps. Usalas para verificar las citas de orden y buscar más evidencia.

## Estándar del sitio (no negociable)
{{standard}}
- Solo libros del catálogo. Elegí de los candidatos, aunque podés sumar otros del catálogo si encajan mejor. No metas un libro solo para llenar.
- `source` es el índice, dentro de `book.sources`, de la cita que mejor respalda POR QUÉ ese libro está en la ruta. Si el libro no tiene sources, omitilo.
- `why` explica por qué este libro va ACÁ, en este punto del recorrido: qué aporta respecto del anterior y qué prepara. Una frase de hasta 160 caracteres, en la voz del sitio ({{voice}}) y sin marketing. No inventes lo que {{creator.name}} no dijo; si le atribuís algo, que esté en la cita.
- `order` solo va cuando {{creator.name}} dictó ese orden. Lleva la URL de la fuente (en YouTube, con `&t=<segundos>s`), el timestamp y la cita textual copiada de la transcripción. Si no hay evidencia, el orden lo justifica la lógica de lectura (nivel y prerrequisitos), no una cita inventada.
- Usá `optional: true` para desvíos que suman pero que se pueden saltear.
- Un `gap` (tramo a pie) va antes de un paso cuando el salto es tan grande que el lector se va a chocar con cosas que ningún libro anterior le dio. Los niveles son {{levelLabels}}. Que un libro sea más denso no alcanza. El `bridge` lleva de 2 a 4 temas concretos para investigar, sin nombrar libros.
- La ruta tiene entre 4 y 10 pasos. Si con libros del catálogo una ruta no llega a 4 pasos que formen una progresión real, descartala y explicá por qué.
- Una ruta hecha mayormente de menciones es débil: que tenga al menos la mitad de libros `fuerte` o `interesante`. Si no, descartala.

## Salida
Por cada ruta escribí `{{outDir}}/<id>.json` con JSON válido.
```json
{"id":"...","name":"...","kind":"corriente|objetivo","line":"<topic id>","promise":"...","summary":"...","steps":[{"book":"...","why":"...","source":0,"order":{"url":"...","timestamp":"...","quote":"..."},"optional":true,"gap":{"severity":"fuerte","bridge":["..."],"note":"..."}}],"discarded":false,"notes":"dudas para el revisor"}
```
Omití las claves opcionales que no uses. Si descartás una ruta: `{"id":"...","discarded":true,"notes":"por qué"}`.

No modifiques ningún otro archivo. Al terminar respondé con una línea por ruta: id, cantidad de pasos, cuántos llevan `order`, gaps, y si la descartaste.
