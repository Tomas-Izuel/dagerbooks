---
name: new-creator
description: Crea el sitio de un creador de contenido nuevo en el monorepo (apps/<slug>) y define todo su mundo visual con una pasada intensiva de impeccable, con dos compuertas de aprobación del dueño antes de escribir UI. Usala cuando el usuario pida "/new-creator", sumar un creador, o arrancar el sitio de alguien nuevo.
---

# /new-creator <slug>

Un sitio por creador, con una UI propia que no se parece a ninguna otra del monorepo. Esta skill arma el esqueleto (datos, config, contexto) y conduce la pasada de diseño. **No se escribe UI hasta la Compuerta 2.**

## 1. Entradas (preguntale al dueño lo que falte)

- Slug, nombre del creador y nombre del sitio.
- Canales donde recomienda libros (YouTube, Instagram, Twitch, TikTok) y su idioma y registro (por ejemplo, español peninsular con tuteo).
- **El acuerdo**: ¿es oficial? ¿afiliado de Amazon, de quién y en qué tienda? ¿se pueden usar su nombre, su cara, su logo, sus colores? (`brand.assets`). Nada de marca propia sin acuerdo explícito.
- Módulos: `progression` (rutas de prerrequisitos con nivel 0 raíz: solo si el creador piensa en caminos de lectura), `routes` (itinerarios curados), `updates` (novedades; casi siempre sí).
- Referencias visuales que el dueño quiera dar (sitios, revistas, objetos). **Nunca** otra app de este repo.

## 2. Esqueleto

```bash
pnpm new-creator <slug> --name "…" --site "…" --language es --locale es_ES \
  --modules updates[,routes][,progression] [--affiliate-tag … --marketplace es] [--official] \
  --channel youtube:@handle --channel instagram:handle
pnpm install && pnpm --filter <slug> schema && pnpm --filter <slug> validate
```
Completá los `TODO` de `apps/<slug>/creator.config.ts` (bio, voz, etiquetas de nivel y de recomendación en la voz del sitio) con el dueño. El esqueleto trae una página provisoria sin diseño, solo para que compile.

## 3. Pasada de impeccable (estado aislado por app)

Corré impeccable **siempre con cwd en `apps/<slug>`** o con `--target apps/<slug>`: resuelve `apps/<slug>/PRODUCT.md`, `DESIGN.md` y `.impeccable/` de esa app (verificado con `impeccable doctor --target apps/dagerbooks --json`). En la raíz del repo **no puede haber** `PRODUCT.md`, `DESIGN.md` ni `.impeccable/`, porque se heredarían. Antes de cada ronda: `impeccable doctor --target apps/<slug> --json` y confirmá que `productPath` y `designPath` apuntan a la app.

Entradas de impeccable, y solo esas: `apps/<slug>/PRODUCT.md`, los assets que permite el acuerdo y las referencias del dueño. **Prohibido** pasarle `apps/<otra-app>/**`, el `DESIGN.md` de otra app o capturas de otros sitios del repo, y reusar sus metáforas (por ejemplo, un mapa de subte).

1. **`init` → `PRODUCT.md`**: identidad, audiencia, propósito y acuerdo de marca del creador. Sin decisiones visuales.
2. **Dirección (varias rondas)**: exploración de mundos visuales a partir de quién es el creador, cómo habla y para quién. Comps de decisión.
3. **Compuerta 1: el dueño aprueba una dirección.** Con eso se escriben los tokens (`app/styles/tokens.css`) y un `DESIGN.md` semilla (modo seed de `document` + el contrato de dirección).
4. **Comps de superficies clave**: la vista principal (mapa, estantería, timeline… lo que corresponda a este creador), la página de libro, la de tema, `/novedades`, el formulario de sugerencias, las imágenes OG y, si el módulo está activo, las rutas. **La vista principal y la navegación son decisiones del dueño, no defaults.**
5. **Compuerta 2: el dueño aprueba los comps y la navegación.** Recién acá se escribe UI.

## 4. Construcción

- `impeccable-asset-producer`: rasters limpios de los mocks aprobados (fondos OG, texturas, ilustraciones; logotipo solo si el acuerdo lo permite).
- Superficies en PRs chicos con el agente `frontend-engineer`, usando `@estantes/catalog` y `@estantes/kit` (búsqueda, SEO, progreso, sugerencias) y nada de otra app. El formulario de sugerencias reusa la lógica del kit (`createSuggestion`) con su propia UI; las claves de localStorage se fijan en `scripts/storage-keys.test.ts` apenas existan.
- `impeccable-finish-reviewer` contra el contrato de dirección y los comps; se aplican sus arreglos.
- `impeccable-documenter` regenera `DESIGN.md` y el sidecar desde lo construido.
- `impeccable-manual-edit-applier` solo en sesiones `live` en las que el dueño corrige copy en el navegador.

## 5. Contenido y publicación

- Libros: `/add-books <slug>` (para Instagram, con el export oficial de la cuenta: `pnpm pipeline discover --creator <slug> --from-export <dir>`; verificá primero que el export traiga el link de cada reel).
- Etiqueta `creator:<slug>` en el repo de sugerencias.
- Proyecto de Vercel nuevo con Root Directory `apps/<slug>`, su dominio y `NEXT_PUBLIC_SITE_URL` (lo hace el dueño).
- Novedad de lanzamiento con `/updates`.
