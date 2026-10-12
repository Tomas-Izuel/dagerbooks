# Extracción de libros: {{video.title}}

Sos un agente de research. {{creator.bio}}. Esta fuente es un video largo o un stream: "{{video.title}}" ({{video.url}}).

La transcripción está partida en `{{dataDir}}/parts/{{video.id}}/partN.txt`, en líneas `[h:mm:ss] texto`. Te toca `{{part}}`. Leela COMPLETA con Read (offset/limit de a ~400 líneas). No uses grep ni búsquedas por palabra clave como atajo: {{creator.name}} nombra libros sin decir "libro", y leer todo es el trabajo.

Contexto: en un stream {{creator.name}} lee el chat, reacciona a videos y lee textos en voz alta. Distinguí qué dice él de lo que lee de otros (chat, videos, artículos). Si el libro lo nombra otro y {{creator.name}} no opina, la postura es `mentions`. El reconocimiento de voz deforma nombres; deformaciones ya conocidas:
{{asrHints}}
Reconstruí el título y el autor reales. Si no podés identificarlo con seguridad, registralo igual con `identificationConfidence: "low"`.

Tramos a ignorar (no cuentan como recomendación nueva, por ejemplo cuando lee el propio sitio en voz alta): {{video.ignoreWindows}}. Sí cuenta cuando opina por su cuenta.

`{{knownBooks}}` lista los libros que ya están en el catálogo (id, nivel, tema, título, autores). Si un libro ya está ahí, registralo igual con su id en `knownId`, porque sumamos la fuente nueva.

Postura (`stance`):
{{stanceDefinitions}}

Ignorá películas, series, videojuegos y videos de YouTube. Un autor sin libro concreto solo va si queda claro a qué obra se refiere. Ignorá los chistes obvios.

Además, anotá en `routeOpinions` todo lo que {{creator.name}} diga sobre el ORDEN en que conviene leer: qué va antes, qué es más denso o avanzado, qué ruta tiene o no tiene sentido. También cualquier crítica al sitio {{site.name}}.

Salida: escribí `{{out}}`. Tiene que ser JSON válido:
```json
{"part":"{{part}}","videoId":"{{video.id}}","books":[{"title":"Título original","authors":["Autor"],"knownId":null,
  "stance":"recommends","identificationConfidence":"high|medium|low",
  "notes":"contexto breve en {{language}}: qué dice y en qué tono",
  "sources":[{"timestamp":"h:mm:ss","quote":"cita textual corta de la transcripción","speaker":"creador|chat|video|lectura"}]}],
 "routeOpinions":[{"timestamp":"h:mm:ss","quote":"...","summary":"..."}]}
```
Cada libro aparece una sola vez, con todas sus fuentes. No modifiques ningún otro archivo. Al terminar respondé solo con la cantidad de libros, cuántos no están en el catálogo y cuántos tienen `recommends` o `mixed`.
