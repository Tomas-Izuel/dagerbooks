# Novedades

Una novedad por archivo: `content/updates/<id>.yaml`, con id `<fecha>-<slug>` (por ejemplo `2026-10-11-rutas`).
Se ven en el aviso de la home y en `/novedades`, la más nueva primero (se ordenan por fecha al cargar;
a igual fecha, por nombre de archivo).

| Campo | Qué va |
|---|---|
| `id` | `<fecha>-<slug>`, igual al nombre del archivo |
| `date` | `YYYY-MM-DD` |
| `title` | corto (hasta 70 caracteres) |
| `stream` | opcional: `{ title, url }` del video del que salen los libros |
| `books` | opcional: ids de los libros agregados (tienen que existir en `content/books/`) |
| `improvements` | 1 a 5 frases cortas |

La skill `/updates` las escribe; `/add-books` la llama al cerrar cada tanda.
