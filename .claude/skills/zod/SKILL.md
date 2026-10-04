---
name: zod
description: Zod v4 for validating the dagerbooks content catalog (books.yaml / topics.yaml) at build time, deriving types, graph-invariant checks, and generating the editor JSON Schema. Covers v3→v4 API changes.
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

## Content schemas (dagerbooks)

7. `lib/catalog/schema.ts` is the single source of truth for `content/books.yaml` and `content/topics.yaml`; export schemas and inferred types from there.
8. Parse the YAML at build time with `parse()` — a bad entry must fail `next build` (and the Vercel deploy) with `z.prettifyError(err)` naming the book id and field.
9. Graph invariants that Zod alone cannot express (referenced ids exist, prerequisite level <= book level, no cycles in `leadsTo`) run in a `superRefine` over the whole catalog, each issue with a `path` pointing at the offending book.
10. Generate the editor JSON Schema from the same Zod schema (`z.toJSONSchema()`) into `content/books.schema.json`, referenced by a `# yaml-language-server: $schema=` comment, so hand-edits get autocompletion.
