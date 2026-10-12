# Verificar una sugerencia de lector

Un lector de {{site.name}} sugirió un libro (issue #{{issue.number}} del repo de sugerencias):

```yaml
{{issue.yaml}}
```

Tu trabajo es confirmar o descartar que {{creator.name}} lo recomienda, con evidencia. {{creator.bio}}.

1. Si hay link, identificá la fuente (id de video o reel) y su transcripción en `{{dataDir}}/txt/`. Si no está, avisá: hay que correr `pnpm pipeline fetch-subs` o `transcribe` para esa fuente.
2. Leé la transcripción alrededor del minuto indicado (±3 minutos) y, si no aparece, el resto completo. No uses grep como único método: el reconocimiento de voz deforma nombres (deformaciones conocidas: {{asrHints}}).
3. Si no hay link, buscá en `{{knownBooks}}` si ya está y, si no, devolvé `no-encontrado` explicando que hace falta una fuente.

Postura (`stance`):
{{stanceDefinitions}}

Respondé con JSON válido en `{{out}}`. Usa el formato de una extracción, así los libros confirmados entran al mismo cruce que el resto de la tanda:
```json
{"batch":"issue-{{issue.number}}","issue":{{issue.number}},"verdict":"confirmado|ya-esta|no-encontrado|no-recomienda",
 "comment":"una o dos frases en {{language}} para responder en el issue, en la voz de {{site.name}}",
 "books":[{"title":"Título original","authors":["Autor"],"knownId":null,"stance":"recommends","identificationConfidence":"high",
   "notes":"qué dice y en qué tono","sources":[{"videoId":"...","videoTitle":"...","timestamp":"m:ss","quote":"cita textual","stance":"recommends"}]}]}
```
`books` va vacío salvo que el veredicto sea `confirmado` (o `ya-esta` con una fuente nueva, con su `knownId`). No modifiques ningún otro archivo.
