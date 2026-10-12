# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, TypeScript) deployed on Vercel. Content lives in `content/books.yaml` and `content/topics.yaml`, validated with Zod at build time; no database, no auth, no API routes. Book and topic pages are statically generated for SEO.

## Users

Primary: Dager's community — mostly Spanish-speaking (largely Argentine) junior programmers, CS students and self-taught devs who follow his YouTube channels (DotDager, DagerClips) and streams. They come to decide what to read next and in what order, across programming and the other subjects he talks about (philosophy, economics, history, self-improvement). Secondary: readers arriving from search for a specific book or topic.

## Product Purpose

DagerBooks turns everything Dager has recommended (scattered across videos, streams, Reddit comments and his GitHub README) into one navigable map. Each book is placed by topic and depth, so a reader can see a route: what to read first, what a book unlocks, and how distant subjects connect. Success: a follower finds their entry point in a topic, follows a chain of prerequisites, and marks books as read over time.

## Positioning

It is not a generic reading list. Every book is traced to where Dager actually recommends it, with a timestamped link and his own words, and the catalog is organised as a skill tree (rings of depth, sectors of topic, prerequisite chains) rather than a ranked list. Dager's own cross-disciplinary taste — systems theory next to Hayek, Stoics next to software architecture — is the structure.

## Operating Context

- Readers explore on desktop and phone; the map must pan and zoom with mouse and touch.
- "Lo leí" progress is personal and stored only in the reader's browser (localStorage); there are no accounts.
- New books are added by editing `content/books.yaml` and opening a GitHub PR; the Vercel preview build validates it.

## Capabilities and Constraints

- Radial skill-tree graph: center = the root book (*Tom Sawyer Abroad*, the first book Dager read); rings = level 1–4 (introductorio → especialista); 12 topic sectors (lines A–L) in a fixed circular order defined in `topics.yaml`.
- Second view, **Subte**, chosen with a Grafo | Subte selector (state in `?vista=`, Grafo is the default): one horizontal band per line stacked from Km 0, levels as fare-zone columns, branches at 45°. Same stations, selection, filters and read progress as the radial.
- Click a book → highlight its prerequisite chain and what it unlocks; side panel with summary, Dager's context and sources.
- Topic filter (dims other sectors), accent-insensitive search, shareable URL state.
- Per-book and per-topic static pages with metadata, JSON-LD and OG images.
- Books with missing authors, summary, context or sources are flagged "por completar".
- UI language: Spanish. Book titles in their original language, Spanish edition title as secondary when it exists.
- Scale today: 199 books across 12 lines; must stay usable as the catalog grows toward a few hundred.

## Brand Commitments

- Name: **DagerBooks**.
- Fan-made project the user intends to show to Dager, who may endorse it later. Until he does, it must not present itself as official: no implied endorsement, no use of his face, logo or channel artwork. His name, quotes and links to his videos are used as attribution.
- Voice: delegated to the design pass, with an explicit preference for personality over neutrality. Context: the community and Dager's quotes are rioplatense Spanish (voseo, irreverent).

## Evidence on Hand

- `content/books.yaml`: 199 books with verified metadata (Open Library/WebSearch), Spanish summaries, Dager's context and sources.
- Sources are real: YouTube links with timestamps and verbatim quotes from auto-transcripts, his Reddit comments (u/DagerDotCSV) and his GitHub README. Three books come only from the user's own notes and have no public source.
- Open Library cover IDs for 65 books.
- `research/catalog-review.md`: excluded books (mentioned or criticised, not recommended).
- No testimonials, usage numbers, or statements from Dager about this site exist; none may be invented.

## Product Principles

1. Every recommendation is traceable: show where and how Dager said it, or mark it "por completar".
2. The route matters more than the list: depth and prerequisites are first-class, not decoration.
3. Honor his cross-disciplinary range; programming is one line among twelve, not the whole map.
4. Personal and private: progress lives in the reader's browser, no sign-up.
5. Maintainable by one person through a single YAML file.

## Accessibility & Inclusion

The graph must be keyboard-navigable with visible focus, respect `prefers-reduced-motion`, and every book must also be reachable as plain HTML (list and static pages) for screen readers and search engines.
