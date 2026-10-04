---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/libros/[slug]/page.tsx","app/temas/[slug]/page.tsx"]
---

## Scope
Home (`/`): the reading network map. Visitor mode: Experience — the map leads from the first viewport. Desktop first (1280–1600), phone must still work by touch.

## Audience and job
Dager's community (junior devs, CS students, mostly Argentine). Job: find where they start in a topic and follow the route. Remember after 10 seconds: "acá arranco yo".

## Constraints
199 books, 12 lines (A–L), levels 0–4. Layout comes from `lib/catalog/layout.ts` (radial; angle 0 = +x, clockwise). Not official: no Dager imagery. Must not feel corporate/SaaS. Voice: rioplatense, with personality, borrowing subte vocabulary.

## Direction contract
THESIS: DagerBooks is the subway network of Dager's reading: twelve lines leave Kilómetro 0 (Tom Sawyer Abroad) and every book is a station. It refuses the dark Obsidian-style node graph and the grid of covers.
OWN-WORLD: Midnight-enamel ground (#0B1230 family) owns the whole page; porcelain-white stations, labels and rules; twelve line inks, each with a lettered disc A–L like the Buenos Aires subte; fare-zone rings dotted for levels 1–4; interchanges as paired white rings; Big Shoulders for signage display, Overpass for wayfinding labels in tracked caps and body; rectangular 2px-ruled buttons with an arrow; the chosen line burns, the rest drop to a third of their ink.
STORY: In seconds the visitor sees this is the map of what Dager recommends, picks a line (topic), sees its first station flagged "Acá arrancás", follows the route outward, opens a station to read what Dager said and marks "Lo leí".
FIRST VIEWPORT: Full-bleed network at 1440: the radial map centred right, filling ~70% width. Left: a 360px station board: DagerBooks mark, display "¿Dónde arrancás?", search "¿A qué libro vas?", the twelve lines as disc + name + first station. Zoom/centre controls bottom-right. Primary action: choosing a line. Selecting a station slides the station panel in from the right.
FORM: Midnight transit diagram (dealt challenger, user-chosen over the assigned Fileteado porteño); seed key 03f4b265. Signature interaction: selecting a station draws the route from Km 0 like a train run (stroke draw, ease-out-expo, instant under reduced motion).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Addendum: views (Grafo | Subte)
The view selector (Grafo | Subte) shares one sign, top right, with the density control: stacked sections "Vista" and "Densidad", footnote at the bottom. State lives in `?vista=` (`grafo` is the default and is omitted); the home keeps its canonical at `/`. On a phone the selector is two icon-only buttons of at least 44px.

The Subte view keeps the identity: midnight enamel, porcelain stations, twelve line inks with lettered discs, dotted fare zones, interchanges as paired rings, Big Shoulders and Overpass. Geometry: one horizontal band per line, stacked A–L, leaving Km 0 (a long vertical pill on the left); levels are zones in aligned columns (an HTML zone strip stays on top while panning); branches at 45°; labels always horizontal; the full view is vertical and fits to width, with line focus as the main way to read. The chosen line burns and the rest drop to a third of their ink. Switching view cross-fades in 240 ms (instant under reduced motion) and keeps `libro`, `tema`, `rec` and `q`. Line heads with no children are drawn on a faint header rail (no order between them), never as a sequence.

## Unresolved
Light (porcelain) variant deferred; dark enamel is the v1 commitment because the use scene is a desk at night with the stream on a second monitor.
