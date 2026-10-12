# Calibración de tramos a pie

{{site.name}} muestra los libros que recomienda {{creator.name}}. Hay un **tramo a pie** cuando, entre un libro y el siguiente (`leadsTo`), el salto de expertise es tan grande que el lector tiene que estudiar por fuera de la red antes de seguir.

Varios agentes, uno por línea, marcaron aristas como `fuerte` o `muy-fuerte`, sin compararse entre sí y con criterios dispares. Si un tercio del mapa queda a pie, la señal no sirve. Tu trabajo es calibrar con UN solo criterio para todo el catálogo.

Entrada: `{{candidates}}` (las aristas con nivel, línea, severidad y bridge). Para contexto de cada libro, leé `{{contentDir}}/books/<id>.yaml` (summary y context) y lo que sepas de cada obra. Usá WebSearch o WebFetch si dudás del nivel real de un libro.

Criterio, igual para todas las aristas:
- `muy-fuerte`: hay una pared. Sin estudio externo serio el destino es prácticamente ilegible.
- `fuerte`: un lector que terminó el origen va a chocar en las primeras páginas del destino con conocimiento que ningún libro de la ruta le dio, y le conviene investigar 2–4 temas concretos antes.
- `ninguno`: cualquier otra cosa. Que el destino sea más largo, más denso, más académico o de otro tema no alcanza: eso es leer el libro siguiente.

Objetivo orientativo: que los tramos a pie sean la excepción (del orden de un 10–15 % de las aristas). No es una cuota: si de verdad hay más o menos, justificalo. Revisá también el `bridge`: de 2 a 4 temas concretos y cortos en {{language}}, sin nombrar libros ni recursos. Cuando haga falta, corregilo y dejá `note` en una frase en la voz del sitio ({{voice}}), o quitala.

Salida: `{{out}}`, con JSON válido:
```json
{"criteria":"una frase","decisions":[{"from":"a","to":"b","severity":"fuerte|muy-fuerte|ninguno","bridge":["..."],"note":"... o null","why":"una frase"}]}
```
Tiene que haber una decisión por cada arista de la entrada. No modifiques ningún otro archivo. Al terminar respondé con cuántas quedaron fuerte, cuántas muy-fuerte y cuántas ninguno.
