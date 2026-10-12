# Replanteo de la ruta de una línea de {{site.name}}

{{site.name}} es el sitio con los libros que recomienda {{creator.name}} ({{creator.bio}}). Cada **línea** es un tema (`{{contentDir}}/topics.yaml`), cada **zona** es un nivel ({{levelLabels}}), y `leadsTo` dice qué conviene leer después de cada libro.

## Tu línea

Te toca la línea `{{topic}}`. Leé todos los archivos de `{{contentDir}}/books/` (o `{{knownBooks}}` para el índice) y `{{contentDir}}/topics.yaml`. Tus libros son los que tienen `{{topic}}` como primer tema. También importan los libros de otras líneas que apuntan a los tuyos y los que los tuyos apuntan, porque son trasbordos.

Para cada libro tuyo averiguá de qué trata realmente, a quién apunta y qué presupone. Usá WebSearch y WebFetch (índices, reseñas, prefacios, el "prerequisites" del autor). No te alcanza con la memoria: verificá los casos dudosos. Leé también el `context` y las `sources`, porque reflejan por qué {{creator.name}} lo recomienda.

## Qué entregás

1. **Diagnóstico:** decí si la ruta actual tiene sentido o no, y por qué, arista por arista.
2. **Ruta propuesta:** el `leadsTo` nuevo de CADA libro de tu línea (podés dejarlo igual). Reglas duras:
   - Solo ids que existan en el catálogo.
   - El destino tiene que tener nivel MAYOR que el origen.
   - Sin ciclos.
   - Una arista `A → B` significa "después de A, B es un buen próximo paso natural": B aprovecha o presupone lo de A. Que sean del mismo tema amplio no alcanza.
   - Todo libro de nivel ≥2 de tu línea necesita al menos una arista entrante, sea de tu línea o de otra. Si no hay un prerequisito natural, elegí el menos malo y marcá el gap.
   - Podés proponer aristas desde libros de OTRAS líneas hacia los tuyos, cuando el trasbordo tiene sentido real. Listalas aparte.
   - Podés proponer cambiar el `level` de un libro si está mal calibrado. Justificalo.
   - Las aristas desde el libro raíz (nivel 0) no son tu problema. Todo libro de nivel 1 cuelga de la raíz automáticamente.
3. **Gaps:** para CADA arista de tu propuesta, estimá el salto de expertise entre origen y destino: `suave`, `fuerte` o `muy-fuerte`. Puede haber un salto fuerte dentro de la misma zona y uno suave entre zonas.
   - `fuerte`: el lector va a tener que aprender por su cuenta un par de cosas que ningún libro de la ruta le da.
   - `muy-fuerte`: hay una pared; sin estudio externo el libro siguiente es casi ilegible.

   Para `fuerte` y `muy-fuerte` agregá `bridge`: de 2 a 4 temas concretos y cortos en {{language}} para investigar antes, sin nombrar libros ni recursos. Opcionalmente sumá `note`: una frase corta en la voz del sitio ({{voice}}).

## Salida

Escribí `{{out}}` con JSON válido:
```json
{"topic":"{{topic}}","verdict":"coherente|mejorable|sin-sentido","diagnosis":"párrafo corto",
 "edgeReview":[{"from":"a","to":"b","keep":true,"why":"..."}],
 "levelChanges":[{"id":"x","from":2,"to":3,"why":"..."}],
 "leadsTo":{"book-id":[{"id":"target","gap":"suave|fuerte|muy-fuerte","bridge":["..."],"note":"...","why":"por qué este paso"}]},
 "incomingFromOtherLines":[{"from":"otro-id","to":"tu-id","gap":"suave","bridge":[],"why":"..."}],
 "booksResearched":[{"id":"x","presupposes":"...","audience":"..."}]}
```
`leadsTo` lleva una entrada por CADA libro de tu línea, aunque la lista quede vacía. No modifiques ningún otro archivo. Al terminar respondé solo con el veredicto, cuántas aristas cambiaron y cuántos gaps fuertes o muy fuertes encontraste.
