# Revisión manual del preview

La paridad compara el HTML y los payloads RSC, pero no ejecuta el cliente. En cada PR de la migración,
abrí el preview y revisá estas URLs (diez minutos):

- `/` con el grafo, en las tres densidades (compacta, media, aireada)
- `/?vista=subte`, en las tres densidades
- `/?libro=meditations` (panel abierto, cadena resaltada)
- `/?q=hayek` (búsqueda) y `/?tema=economia` (filtro)
- `/libros/the-pragmatic-programmer`
- `/temas/filosofia`
- `/rutas` y `/rutas/escuela-austriaca` (seguir la ruta y volver al mapa)
- `/novedades` (y el aviso de novedad en la home)
- `/estaciones`
- `/sumar-un-libro`

Con progreso guardado desde producción ("Lo leí", rutas seguidas, densidad, panel colapsado),
el preview tiene que mostrar el mismo estado.

## Comandos

```bash
# base: el commit del que sale la rama
pnpm build && pnpm parity snapshot --out research/parity/base
# head: la rama
pnpm build && pnpm parity snapshot --out research/parity/head
pnpm parity diff research/parity/base research/parity/head   # exit 0 = idéntico
pnpm parity golden                                            # mensajes de validación
```
