---
name: DagerBooks
description: Midnight transit diagram of Dager's reading — twelve lettered lines out of Km 0, every book a station.
colors:
  enamel-950: "#070c22"
  enamel-900: "#0b1230"
  enamel-850: "#0f1838"
  enamel-800: "#142045"
  enamel-700: "#1e2c5a"
  enamel-600: "#2c3d73"
  porcelain-50: "#f3f1ea"
  porcelain-200: "#d6d9e8"
  porcelain-400: "#a9b3d6"
  porcelain-600: "#6f7aa3"
  ink-a-celeste: "#3ec6e0"
  ink-b-escarlata: "#f0484e"
  ink-c-verde: "#2dbe5a"
  ink-d-violeta: "#b07cf0"
  ink-e-ambar: "#ffc20e"
  ink-f-cobalto: "#5b86ff"
  ink-g-magenta: "#f05aa8"
  ink-h-lima: "#b5e03a"
  ink-i-naranja: "#ff8a2b"
  ink-j-cobre: "#d9976a"
  ink-k-lavanda: "#c9c2f5"
  ink-l-salmon: "#f7a8b8"
typography:
  display:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "clamp(2.25rem, 8vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Big Shoulders, Arial Narrow, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.12em"
  body:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-lead:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  label-sm:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  data:
    fontFamily: "Overpass Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sign: "2px"
  disc: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "72px"
components:
  button-solid:
    backgroundColor: "{colors.porcelain-50}"
    textColor: "{colors.enamel-950}"
    typography: "{typography.label}"
    rounded: "{rounded.sign}"
    padding: "8px 16px"
    height: "44px"
  button-solid-hover:
    backgroundColor: "{colors.enamel-900}"
    textColor: "{colors.porcelain-50}"
  button-ghost:
    backgroundColor: "{colors.enamel-900}"
    textColor: "{colors.porcelain-50}"
    typography: "{typography.label}"
    rounded: "{rounded.sign}"
    padding: "8px 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.porcelain-50}"
    textColor: "{colors.enamel-950}"
  ticket-punch:
    backgroundColor: "{colors.ink-e-ambar}"
    textColor: "{colors.enamel-950}"
    rounded: "{rounded.sign}"
    padding: "8px 16px"
    height: "48px"
  ticket-punch-hover:
    backgroundColor: "{colors.porcelain-50}"
    textColor: "{colors.enamel-950}"
  ticket-punch-done:
    backgroundColor: "{colors.enamel-900}"
    textColor: "{colors.porcelain-50}"
  line-disc:
    textColor: "{colors.enamel-950}"
    rounded: "{rounded.disc}"
    size: "28px"
  search-field:
    backgroundColor: "{colors.enamel-900}"
    textColor: "{colors.porcelain-50}"
    rounded: "{rounded.sign}"
    padding: "12px"
  station-panel:
    backgroundColor: "{colors.enamel-950}"
    textColor: "{colors.porcelain-50}"
    width: "360px"
  route-station:
    backgroundColor: "{colors.porcelain-50}"
    textColor: "{colors.enamel-950}"
    rounded: "{rounded.disc}"
    size: "56px"
  status-tag:
    textColor: "{colors.porcelain-50}"
    typography: "{typography.label-sm}"
    padding: "1px 8px"
---

# Design System: DagerBooks

## Overview

**Creative North Star: "The Midnight Transit Diagram"**

DagerBooks is drawn as a city subway map at night. A deep midnight enamel owns every pixel of ground; porcelain-white stations, rules and signage sit on it like enamel plates in a Buenos Aires station; and twelve saturated line inks, each lettered A–L on a round disc, carry the topics outward from Km 0. Nothing on the surface is a card, a gradient or a glow. Information is posted the way transit authorities post it: square-cornered signs, 2px rules, tracked capitals, numbered stops.

The world has two scales. On the map (radial Grafo and horizontal Subte) lines are thin strokes, stations are porcelain rings, fare zones are dotted rings, and the chosen line burns while the rest drop to a third of their ink. On reading surfaces (book, topic and route pages) the same vocabulary is enlarged: a route becomes a thick vertical track in its ink with porcelain stations the size of a thumb, and gaps in the catalog are walked, not ridden. Personality comes from the transit metaphor carried all the way down (the "Lo leí" button is a ticket you punch, progress is "Leíste 2 de 3"), not from ornament.

Density is a reader setting (compacta, media, aireada), applied as one multiplier over list rows, gaps and line-height. The use scene is a desk at night with a stream on a second monitor; the dark enamel is the v1 commitment, a porcelain variant is deferred.

**Key Characteristics:**
- Midnight enamel ground, porcelain foreground, twelve line inks as the only saturated color.
- Lettered line discs A–L wherever a topic is named.
- Big Shoulders signage in uppercase; Overpass wayfinding labels in tracked caps.
- Square, 2px-ruled rectangles for every interactive sign; circles only for discs and stations.
- Dashed and dotted strokes carry meaning: fare zones, optional detours, the next stop, tramos a pie.
- Motion is a train run: ease-out-expo, stroke-draw from Km 0, instant under reduced motion.

## Colors

A two-material palette (dark enamel, light porcelain) with twelve transit inks reserved for lines and their state.

### Primary
- **Line Inks A–L** (Celeste, Escarlata, Verde, Violeta, Ámbar, Cobalto, Magenta, Lima, Naranja, Cobre, Lavanda, Salmón): one per topic sector, in the fixed order of `topics.yaml`. They paint map strokes, line discs, the route track, read-state fills, progress segments and the band under a station sign. A component never picks an ink; it receives the line's ink through a local `--ink` variable and uses it.

### Secondary
- **Ámbar Signal** (ink E): doubles as the system's functional signal. It is the focus ring, the text caret and selection, the "B" of the wordmark, the reading-progress fill, the "por completar" dashed border and, above all, the face of the unpunched "Lo leí" ticket. It is the one ink allowed to act outside its line.
- **Escarlata Notice** (ink B): besides line B, the semantic accent for service notices: the 8px left band of the update notice ("aviso de servicio"), the newest stop on /novedades, and a failed copy action. It announces; it never marks a book, a route or a walked gap.

### Neutral
- **Midnight Enamel** (enamel-900): the page and map ground.
- **Deep Enamel** (enamel-950): sunken bars and boards: the station board, station panel, header, progress rail, walk sign; also the dark text color on porcelain and ink ("fg-on-ink").
- **Raised Enamel** (enamel-850 / enamel-800): quote blocks, sign heads and hover fills on rows.
- **Track Enamel** (enamel-700): empty progress tracks and pressed rows.
- **Rule Enamel** (enamel-600): hairline dividers, board edge rules, scrollbar thumb.
- **Porcelain** (porcelain-50): primary text, stations, strong rules around signs and panels, tramo-a-pie footsteps.
- **Porcelain Haze** (porcelain-400): muted text and hairline tag borders.
- **Porcelain Dust** (porcelain-600): faint text, disabled ticket text, zone ring strokes.

### Named Rules
**The Third-of-Ink Rule.** When a line is chosen it burns at full ink and active stroke width; every other line drops to a third of its ink (opacity 0.32). Selection is never shown with a glow or a new color.

**The Ink Belongs to the Line Rule.** Line inks color only line-owned things (tracks, discs, read fills, sign bands, tags of that route). Only two inks hold a second job: ámbar (focus, progress, ticket) and escarlata (service notices).

## Typography

**Display Font:** Big Shoulders (with Arial Narrow, sans-serif), variable optical size
**Body Font:** Overpass (with system-ui, sans-serif)
**Data Font:** Overpass Mono (with ui-monospace), for timestamps only

**Character:** Big Shoulders is the station sign: condensed, uppercase, set tight (0.95 leading) and heavy. Overpass, descended from highway signage, does the wayfinding: tracked uppercase labels and plain, generous body copy.

### Hierarchy
- **Display** (800, clamp up to 5rem, 0.95): page titles — "¿Dónde arrancás?", route names, book and topic names. Uppercase.
- **Headline** (800, 2.25rem, 1): stop titles on a route, station panel title, terminal "fin de línea".
- **Title** (800, 1.1875rem, 0.12em, uppercase): line names in the board, section titles with a 2px porcelain underline, the "Lo leí" ticket label, sign zone names.
- **Body** (400, 1rem, 1.55 + density): reading copy; "por qué acá" and leads step up to 1.1875rem. Measure capped at 62–65ch.
- **Label** (700, 0.875rem / 0.75rem, 0.08–0.12em, uppercase): buttons, nav, tags, field labels, stop labels like "Por qué acá". Never below 0.75rem on new work.
- **Data** (Overpass Mono 700, 0.75rem): source timestamps, printed as a porcelain stamp.

All numerals are tabular.

### Named Rules
**The Signage Rule.** Display and title text is Big Shoulders uppercase; anything the reader acts on (buttons, tags, nav) is Overpass bold in tracked caps. Body text is never tracked and never uppercase.

## Layout

Two layout families. The **explorer** (home) is full-bleed: a 360px station board pinned left on a sunken ground with a 2px right rule, the map filling the rest, floating signs (route banner, view/density sign, zoom controls) pinned to its corners, and a 360px station panel sliding in from the right. Under 900px the board collapses and the station panel becomes a bottom sheet capped at 55dvh with a grab handle.

**Reading pages** (book, topic, routes, novedades) sit in a centered column up to 76rem under a sunken header with breadcrumbs. The route itinerary adds a 15rem sticky progress rail on the right from 64rem; below that the rail becomes a thin sticky top bar of segments. Breakpoints in use: 40rem (phone), 48rem, 64rem, and 900px for the explorer.

Spacing is a 4px-based scale (4, 8, 12, 16, 24, 32, 48, 72). Rows, in-block gaps, block gaps, section rhythm and card padding are derived from it through the density multiplier (×1, ×1.25, ×1.5), and body leading grows with it. Stops on a route are separated by the largest step (72px) so the track reads as distance.

### Named Rules
**The Density Dial Rule.** Vertical rhythm in lists and panels reads the density-derived spacing, never a fixed step, so compacta / media / aireada stay one setting.

## Elevation & Depth

The system is flat and ruled. Depth comes from enamel tone (ground, sunken, raised) and 2px porcelain rules, not from shadows. The single shadow is reserved for things that float over the map or page: the station panel, map controls, route banner, update notice and the book cover plaque.

### Shadow Vocabulary
- **Panel float** (`box-shadow: 0 18px 48px -12px rgb(3 6 20 / 0.7), 0 2px 6px rgb(3 6 20 / 0.5)`): enamel-tinted, soft and deep; only on floating signs.
- **Ground halo** (`box-shadow: 0 0 0 3px var(--bg)`): a ring of the background color that lifts a disc or station off a track it sits on (transfer discs, interchange marks). It is a cut, not a shadow.

### Named Rules
**The Float-Only Shadow Rule.** If it does not float over the map or page, it gets a rule, not a shadow.

## Shapes

Signage is square. Every interactive rectangle (button, field, ticket, sign, panel) has a barely-softened 2px corner and a 2px rule; dividers inside lists are 1px hairlines. The circle is reserved for transit marks: line discs, stations, the mini-diagram dots, footsteps. Stations are porcelain discs ringed in their ink; read stations invert (ink fill, porcelain ring); the next stop wears a dashed porcelain ring offset outside it, like a platform marker.

Stroke patterns are a vocabulary, not decoration:
- **Solid** — the line, the route's main track.
- **Dotted rings** (2 10) — fare zones, levels 1–4.
- **Dashed, thinner** — an optional detour (desvío) leaving the main track.
- **Dotted porcelain footsteps on a cut track** — a tramo a pie.

## Components

### Buttons (ruled signs with an arrow)
- **Shape:** rectangle, 2px corner, 2px rule in the button's ink (porcelain by default, the route's ink when inside a route), minimum 44px tall.
- **Solid:** ink fill, deep-enamel text. Hover empties it to a ruled outline in the ink.
- **Ghost:** transparent with the rule; hover fills with the ink.
- **Label:** Overpass bold, 0.875rem, tracked uppercase, followed by an inline SVG arrow that nudges 2px on hover.
- **Follow ("Seguir esta ruta"):** the solid sign at 48px in the route's ink; once followed it settles into a ruled "Siguiendo" outline with a quiet underlined "Dejar de seguir" beside it.
- **Focus:** 2px ámbar outline, 2–3px offset, everywhere.

### "Lo leí" ticket
The primary personal action, drawn as a fare ticket. Unpunched: ámbar fill with an inline ticket glyph, a Big Shoulders "LO LEÍ" title and a small state line ("Sin picar"). Hover turns it porcelain. Punched (`aria-pressed`): it settles into a transparent porcelain-ruled sign reading "Picado". Same component in the station panel and on route stops.

### Line disc
A round disc in the line's ink with its letter (A–L) in Big Shoulders 800 at 62% of the disc, deep-enamel text. Sizes 20, 28 and 44px. Appears beside every line name, in tags, as the transfer badge on route stations, and as map labels.

### Inputs / Fields
- **Search ("¿A qué libro vas?"):** 2px porcelain-ruled rectangle on the ground, magnifier glyph in muted porcelain, Overpass 600 tracked text, ámbar caret.
- **Focus:** the whole field takes the 2px ámbar outline (`:focus-within`); hover raises the fill to the raised enamel.

### Station board and station panel
- **Board:** 360px sunken column, wordmark ("DAGER" porcelain, "BOOKS" ámbar), display heading, search, the line list (disc + Big Shoulders name + first station), and a ruled trip card "Leíste N de M" with an ámbar progress bar. The chosen line lays a 6px track of its ink under its row.
- **Panel:** 360px sunken sign with a 2px porcelain rule and the panel float shadow. Its head is the station sign: raised enamel with an 8px band of the line's ink along the bottom. Sections are titled in Big Shoulders over a 2px porcelain rule. Slides in 2rem from the right in 260ms.

### Route itinerary (la vía gruesa)
The signature reading component. A thick vertical track in the route's ink (20px desktop, 16px phone) runs through porcelain stations 56px across (44px on phones) with their stop number in Big Shoulders; each station carries a small transfer disc of the book's home line. Read stations fill with ink inside a porcelain ring; the next stop gets a dashed porcelain ring. The terminal has a heavier ring and a buffer bar across the track. Beside each stop: status tags, display title, "Por qué acá", Dager's quote on raised enamel, and the ticket.

### Desvíos (optional detours)
An optional stop leaves the main track on a thinner siding (8px) offset to the right, drawn with a dashed edge; its station is ringed in dashes over the ground and turns solid when read. Its tag is a dashed ink outline ("Desvío optativo"). On the map, a route's detour is a thin dashed spur (3.5 units, 10/7 dash) under the main route stroke.

### Tramos a pie
A missing piece in a chain is walked. On the itinerary the track is cut by a slot of ground color and porcelain footstep dots alternate down the gap, beside a walk sign. On the map the line keeps two ink stubs at the stations and the bare middle carries porcelain dots; "muy fuerte" gaps have shorter stubs and heavier steps. The walk sign is a porcelain *dotted* 2px border on sunken enamel with a severity tag; it carries no line ink and no red, because it is wayfinding, not an error.

### Progress rail
Sticky. On desktop a 15rem porcelain-ruled sign: "2 DE 3 LEÍDOS" with the count in ink, a mini track of the route with porcelain dots, and "Ir a la próxima parada". On phones a sunken top bar with the count and a row of 8px segments (ink when read, dashed ink for next, track enamel for remaining).

### Map marks
Line strokes 5 units, 8 when active; stations are porcelain rings (r 7, stroke 3); interchanges are paired porcelain rings; Km 0 is a double ring at the center (radial) or a tall pill on the left (Subte). A selected route draws as a 9-unit ink stroke over a 15-unit ground halo, traced from Km 0 with ease-out-expo over 700ms.

## Do's and Don'ts

### Do:
- **Do** pass a line's color to components as `--ink` and let them paint tracks, discs, fills and tags from it.
- **Do** drop unchosen lines to the shared dim opacity (0.32) instead of recoloring them.
- **Do** rule interactive rectangles with a 2px line and a 2px corner, 44px minimum hit area.
- **Do** show optional and incomplete things with dashes (detours, "por completar" in ámbar) and walked gaps with porcelain dots.
- **Do** set signage in Big Shoulders uppercase and actions in Overpass tracked caps.
- **Do** route every animation through ease-out-expo and the fast/base/route durations, which collapse to 0 under reduced motion.

### Don't:
- **Don't** introduce colors outside enamel, porcelain and the twelve inks, and don't use gradients as fills.
- **Don't** round signs past 2px or turn rectangles into pills; circles are for discs and stations only.
- **Don't** put shadows on anything that does not float.
- **Don't** give a tramo a pie a line ink or warning color; it is porcelain on sunken enamel.
- **Don't** set new text below 0.75rem.
