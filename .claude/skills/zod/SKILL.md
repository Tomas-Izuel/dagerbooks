---
name: zod
description: Zod v4 for the estantes content catalog (@estantes/catalog: one YAML file per book, topics, routes, updates) validated at build time — composing the core with optional modules, deriving types, cross-entity invariants, golden validation messages, and per-app editor JSON Schemas. Covers v3→v4 API changes.
---

# Zod (content validation)

Zod is the single source of truth for the book catalog contract. Current major is **Zod 4** — several v3 APIs changed, so don't code from v3 memory. Verify via Context7 (`zod.dev/v4`) when unsure.

## v3 → v4 changes that bite

- **Error formatting**: `.format()` / `.flatten()` are deprecated. Use top-level `z.treeifyError(err)` (nested tree), `z.prettifyError(err)` (human-readable string), `z.flattenError(err)` (`{ formErrors, fieldErrors }`). `err.errors` removed → use **`err.issues`**.
- **Top-level string formats**: `z.email()`, `z.uuid()`, `z.url()`, `z.iso.datetime()`, etc. The chained `z.string().email()` is deprecated.
- **Error customization unified under `error`**: `{ error: "..." }` or `error: (issue) => ...` replaces `message` / `errorMap` / `invalid_type_error` / `required_error`.
- **`z.coerce.*` input type is now `unknown`** (was the primitive in v3).
- **`.merge()` deprecated** → use `.extend(Other.shape)` or object spread `z.object({ ...A.shape, ...B.shape })` (best tsc perf). `.pick`/`.omit`/`.partial`/`.extend` remain.
- Import: `import * as z from "zod"` (v4 docs style; `import { z } from "zod"` still works). Mini variant: `zod/mini`.

## Schema design & inference

1. Define with `z.object({...})`; derive types with `type T = z.infer<typeof Schema>` — never hand-write the interface.
2. Distinguish `z.input<>` vs `z.output<>` when you use transforms/coercion (input ≠ output type).
3. `parse()` when a throw is acceptable (a server boundary you wrap); `safeParse()` when you want `{ success, data | error }` (forms, graceful handling).
4. Compose with `.extend(Other.shape)` / object spread and `.pick`/`.omit`/`.partial`; avoid deprecated `.merge()`.
5. Use `z.coerce.number()/.boolean()/.date()` for string-sourced inputs (query params, form fields).
6. Cross-field rules via `.refine()` / `.superRefine()` — always set a `path` so the issue maps to the right field, and an `error` message.

## Content schemas (@estantes/catalog)

7. `packages/catalog` is the single source of truth. Each app calls `defineCatalog({ modules, recommendations, stance, content })` in `apps/<x>/catalog.ts`; the loader, types (`BookOf<typeof catalog>`, `CatalogOf<…>`), invariants, CLI and JSON Schemas all come from that object. Apps re-export what they need from thin shims (in dagerbooks, `lib/catalog/schema.ts`).
8. Compose by **shape spread** into one `z.strictObject({...})` and add `.check()` at the end. In Zod 4.6, `.extend()` on an object with refinements throws if keys overlap, so never extend a refined schema.
9. Content lives in `apps/<x>/content/`: `books/<id>.yaml` (one object per file; the id must match the file name; order by `seq`), `topics.yaml` (optional `parent`, two levels max), `routes.yaml`, `updates/<id>.yaml`. The loader validates each entry with `safeParse` and reports every problem at once as `CatalogError`; `next build` fails through `pnpm validate`.
10. Messages name the entity and field: `libro "x" › leadsTo[0]: …`, `ruta "x" › steps[1] › source: …`, `catálogo › level: …` (see `src/report.ts`). They are the interface for whoever edits YAML: changing wording is a deliberate change, recorded in the app's golden (`pnpm parity golden --record`).
11. Cross-entity rules (ids exist, topic leaves, `leadsTo` to a higher level, no cycles, one root, route sources in range) live in `checkCore` and each module's check function, not in Zod refinements over the whole file.
12. Editor JSON Schemas come from the same Zod schemas (`z.toJSONSchema(…, { io: "input" })`) with id enums filled from the loaded catalog: `pnpm schema` writes them, `pnpm validate` fails if they are stale. Each YAML file starts with `# yaml-language-server: $schema=../book.schema.json` (or the matching schema).
