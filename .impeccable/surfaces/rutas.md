---
version: 1
slug: "rutas"
primary_target: "app/rutas/[slug]/page.tsx"
related_targets: ["app/rutas/page.tsx","components/explorer/StationBoard.tsx","app/page.tsx"]
---

## Scope
Rutas: curated reading itineraries (12–20) mixing currents ("Liberalismo") and goals ("Backend desde cero"), crossing map lines. Surfaces: `/rutas/[slug]` (itinerary), `/rutas` (index), a "Tus rutas" block in the home station board (visible even when the board is collapsed), and "Ver en el mapa" (route stations lit, rest dimmed). Visitor mode: Operate (follow and track), with Read sections.

## Audience and job
A follower who arrives with a goal and is lost among 204 books. Job: know what to read next and why, and pick it back up on every visit.

## Constraints
Only catalog books (Dager's). Every step is defensible with what Dager said: a source with timestamp and a one-line "por qué acá". Where Dager dictated an order, that order wins. Missing pieces are tramos a pie (bridge topics, no third-party books). Following is per-browser (localStorage), several routes at once; progress reuses "Lo leí". Routes deleted from YAML are ignored silently.

## Direction contract
THESIS: A ruta is a real subway line you ride top to bottom — a thick vertical track in the route's ink with numbered stops — not a list, not the changelog timeline. It refuses card grids and generic step-wizards.
OWN-WORLD: The incumbent midnight-enamel world: porcelain stations and type, line inks with lettered discs A–L for each book's home line (transfers), Big Shoulders signage, Overpass labels in tracked caps, 2px-ruled rectangular buttons with arrow, tramos a pie as a broken track with porcelain dotted footsteps.
STORY: The reader sees the route's promise and length, presses "Seguir esta ruta", reads each stop's "por qué acá" and Dager's quote, marks "Lo leí", and next visit finds it in "Tus rutas" with the next station named.
FIRST VIEWPORT: Header with route name at display scale, kind (Corriente/Objetivo), promise, stop count and the primary action "Seguir esta ruta"; below, the vertical track begins at stop 1 with its station sign. A sticky progress rail on the side shows read/remaining and where you are; on phones it collapses to a thin top bar.
FORM: Itinerario vertical — position 2 of 7 on the ordered list; seed key be9a3c08.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
