# Proponer rutas de lectura para {{site.name}}

{{site.name}} muestra los libros que recomienda {{creator.name}} ({{creator.bio}}). Las **rutas** son itinerarios de lectura curados y en orden, de 4 a 10 pasos, que pueden cruzar temas. Ya existen las de `{{contentDir}}/routes.yaml`. Tu trabajo es decidir qué cambia con la tanda nueva.

Entradas:
- el catálogo (`{{knownBooks}}` como índice; `{{contentDir}}/books/<id>.yaml` para summary, context, level, recommendation y sources);
- las rutas actuales (`{{contentDir}}/routes.yaml`);
- los libros nuevos de esta tanda: {{newBooks}};
- las opiniones de {{creator.name}} sobre el orden de lectura (`routeOpinions` de la propuesta `{{proposal}}`).

Criterios:
- **Ajustar una ruta existente** cuando un libro nuevo cubre un hueco marcado como tramo a pie, o cuando {{creator.name}} dictó un orden nuevo con cita.
- **Proponer una ruta nueva** solo si la tanda lo justifica: al menos 4 libros reales del catálogo que formen una progresión, y al menos la mitad `fuerte` o `interesante`. No metas un libro solo para llenar.
- `kind`: `corriente` (una escuela o tradición) u `objetivo` (llegar a poder hacer o entender algo).
- `line`: el tema que da el color de la ruta.
- Evitá solapes: dos rutas comparten como mucho 2 libros.

Salida: `{{out}}`, JSON válido:
```json
{"routes":[{"id":"slug","name":"...","kind":"corriente|objetivo","line":"<tema>","change":"nueva|ajuste","promise":"Al final vas a poder …","audience":"para quién","candidates":["book-id"],"orderEvidence":[{"source":"<id de video>","timestamp":"h:mm:ss","quote":"cita textual","about":"qué orden dicta"}],"risks":"dudas"}]}
```
Si la tanda no justifica cambios, devolvé `{"routes":[]}`. No modifiques ningún otro archivo.
