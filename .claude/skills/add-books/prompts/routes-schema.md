# Formato de `content/routes.yaml`

```yaml
- id: una-ruta                    # slug, único; URL /rutas/una-ruta
  name: "Nombre"                  # ≤ 40
  kind: corriente                 # corriente | objetivo
  line: un-tema                   # tema de topics.yaml que da el color de la ruta
  promise: "Al final vas a poder …"   # ≤ 140, en la voz del sitio
  summary: "Arranca por …"        # ≤ 320: de qué va la ruta y para quién
  steps:                          # 4 a 10 pasos, en orden de lectura
    - book: un-libro              # id de content/books/
      why: "Por qué va acá."      # ≤ 160
      source: 0                   # índice en book.sources de la cita que respalda el paso (obligatorio si el libro tiene sources)
      order?:                     # opcional: evidencia de que el creador dictó este orden
        url: "https://www.youtube.com/watch?v=XXXXXXXXXXX&t=2133s"
        timestamp: "0:35:33"
        quote: "primero esto, después aquello…"
      optional?: true             # paso optativo (desvío): se puede saltear
      gap?:                       # tramo a pie ANTES de este paso (entre el paso anterior y este)
        severity: fuerte          # fuerte | muy-fuerte
        bridge: ["…", "…"]        # 1–5 temas cortos (≤ 80), sin libros ni recursos
        note?: "…"                # ≤ 200
```

Reglas:
- Solo libros del catálogo. Ningún libro se repite dentro de una ruta.
- El primer paso no lleva `gap` ni `optional`.
- Una ruta puede cruzar temas. El nivel puede no crecer en cada paso, pero el orden tiene que tener sentido de lectura.
- Si el creador dictó un orden (en un video o stream), se respeta y se cita en `order`.
