# Revisión adversarial de rutas de {{site.name}}

Revisás las rutas que escribieron otros agentes en `{{outDir}}/*.json` antes de publicarlas. Asumí que tienen errores. Estándar del sitio: {{standard}}

Para cada ruta no descartada:
1. **Verificá cada `order`** contra la transcripción (`{{dataDir}}/txt/<id>.txt`): la cita tiene que aparecer textual en ese timestamp (error máximo 2 s) y tiene que dictar un orden de LECTURA, no el orden en que habló de los libros. Si no, sacala.
2. **Recortá los adjetivos y afirmaciones** de `why`, `promise` y `summary` que no están en la cita (`source`) ni se deducen del libro.
3. **Degradá a `optional`** los pasos que son menciones (`recommendation: mencion`) o que repiten el tema del paso anterior.
4. **Solapes:** entre rutas (nuevas y existentes en `{{contentDir}}/routes.yaml`) no puede haber más de 2 libros en común; si los hay, proponé cuál ruta cambia.
5. **Nombre y promesa:** si prometen más de lo que la ruta da, renombrá o reescribí.
6. Mínimos: entre 4 y 10 pasos; al menos la mitad `fuerte` o `interesante`. Si no llega, descartala.

Corregí los archivos en el lugar y escribí `{{out}}` con una línea por ruta (ok / corregida: qué cambiaste / descartada: por qué), una sección de solapes y la lista de rutas publicables.
