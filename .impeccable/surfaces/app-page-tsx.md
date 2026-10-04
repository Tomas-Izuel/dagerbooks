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
82 books, 10 sectors, levels 0–4, 68 leadsTo, 25 implicit root spokes, 14 related. Layout comes from `lib/catalog/layout.ts` (radial; angle 0 = +x, clockwise). Not official: no Dager imagery. Must not feel corporate/SaaS. Voice: rioplatense, with personality, borrowing subte vocabulary.

## Direction contract
THESIS: DagerBooks is the subway network of Dager's reading: ten lines leave Kilómetro 0 (Tom Sawyer Abroad) and every book is a station. It refuses the dark Obsidian-style node graph and the grid of covers.
OWN-WORLD: Midnight-enamel ground (#0B1230 family) owns the whole page; porcelain-white stations, labels and rules; ten line inks, each with a lettered disc A–J like the Buenos Aires subte; fare-zone rings dotted for levels 1–4; interchanges as paired white rings; Big Shoulders for signage display, Overpass for wayfinding labels in tracked caps and body; rectangular 2px-ruled buttons with an arrow; the chosen line burns, the rest drop to a third of their ink.
STORY: In seconds the visitor sees this is the map of what Dager recommends, picks a line (topic), sees its first station flagged "Acá arrancás", follows the route outward, opens a station to read what Dager said and marks "Lo leí".
FIRST VIEWPORT: Full-bleed network at 1440: the radial map centred right, filling ~70% width. Left: a 360px station board: DagerBooks mark, display "¿Dónde arrancás?", search "¿A qué libro vas?", the ten lines as disc + name + first station. Zoom/centre controls bottom-right. Primary action: choosing a line. Selecting a station slides the station panel in from the right.
FORM: Midnight transit diagram (dealt challenger, user-chosen over the assigned Fileteado porteño); seed key 03f4b265. Signature interaction: selecting a station draws the route from Km 0 like a train run (stroke draw, ease-out-expo, instant under reduced motion).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
Light (porcelain) variant deferred; dark enamel is the v1 commitment because the use scene is a desk at night with the stream on a second monitor.
