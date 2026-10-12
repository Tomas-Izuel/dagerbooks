/** Formatos que la pipeline lee y escribe. Todo lo versionado (estado, registro) se valida al cargar. */
import { GapSchema, MARKETPLACES, STANCES } from "@estantes/catalog";
import * as z from "zod";

// ── Estado de ingesta (packages/pipeline/state/<creador>.yaml) ─────────────────────────────

export const SOURCE_STATUSES = ["discovered", "transcribed", "extracted", "merged", "skipped"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const PLATFORMS = ["youtube", "twitch", "instagram", "tiktok", "podcast", "reddit", "github", "web"] as const;

export const StateSourceSchema = z.strictObject({
  /** Id en la plataforma (videoId de YouTube, shortcode de Instagram…). */
  id: z.string().min(1),
  platform: z.enum(PLATFORMS),
  channel: z.string().optional(),
  title: z.string().optional(),
  /** Duración en segundos. */
  duration: z.number().nonnegative().optional(),
  url: z.string().optional(),
  status: z.enum(SOURCE_STATUSES),
  /** Fecha del último cambio de estado (YYYY-MM-DD). */
  at: z.string().optional(),
  /** Por qué se salteó (sin transcripción, no tiene libros…). */
  reason: z.string().optional(),
  /** Tramos a ignorar en la extracción ("0:32:00-0:36:00"). */
  ignoreWindows: z.array(z.string()).optional(),
});
export type StateSource = z.infer<typeof StateSourceSchema>;

export const StateSchema = z.strictObject({
  sources: z.array(StateSourceSchema),
  issues: z
    .array(
      z.strictObject({
        number: z.number().int().positive(),
        status: z.enum(["open", "resolved", "rejected"]),
        pr: z.number().int().positive().optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  /** Correcciones típicas del reconocimiento de voz para este creador ("Haslid" → "Hazlitt"). */
  asrHints: z.record(z.string(), z.string()).default({}),
  /** Id de obra del registro → id de libro en la app, cuando difieren. */
  aliases: z.record(z.string(), z.string()).default({}),
});
export type State = z.infer<typeof StateSchema>;

// ── Registro bibliográfico (packages/pipeline/registry/works/<id>.yaml) ────────────────────

export const WorkSchema = z.strictObject({
  /** Convención: id de obra = id de libro en las apps. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  year: z.number().int().optional(),
  kind: z.string().optional(),
  openLibrary: z.strictObject({ work: z.string().optional(), coverId: z.number().int().optional() }).optional(),
  editions: z
    .array(
      z.strictObject({
        isbn: z.string(),
        lang: z.string().optional(),
        title: z.string().optional(),
        publisher: z.string().optional(),
        year: z.number().int().optional(),
      }),
    )
    .optional(),
  asin: z.partialRecord(z.enum(MARKETPLACES), z.string()).optional(),
  /** Título de la edición en español, si la hay. */
  titleEs: z.string().optional(),
  url: z.string().optional(),
});
export type Work = z.infer<typeof WorkSchema>;

// ── Extracciones (salida de los agentes, en <datos>/extractions/*.json) ────────────────────

export const ExtractionSourceSchema = z.object({
  videoId: z.string().optional(),
  videoTitle: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
  quote: z.string().optional(),
  stance: z.enum(STANCES).optional(),
  speaker: z.string().optional(),
});

export const ExtractedBookSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  knownId: z.string().nullable().optional(),
  rawMentions: z.array(z.string()).optional(),
  stance: z.enum(STANCES),
  identificationConfidence: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().optional(),
  sources: z.array(ExtractionSourceSchema).default([]),
});
export type ExtractedBook = z.infer<typeof ExtractedBookSchema>;

export const ExtractionFileSchema = z.object({
  batch: z.string().optional(),
  part: z.string().optional(),
  /** Para extracciones de un solo video largo: su id, si las sources no lo traen. */
  videoId: z.string().optional(),
  videosRead: z.array(z.string()).optional(),
  videosWithoutBooks: z.array(z.string()).optional(),
  books: z.array(ExtractedBookSchema),
  routeOpinions: z.array(z.object({ timestamp: z.string().optional(), quote: z.string(), summary: z.string().optional() })).optional(),
});
export type ExtractionFile = z.infer<typeof ExtractionFileSchema>;

// ── Progresión: planes por línea y calibración de tramos a pie ─────────────────────────────

// Los agentes escriben `null` en los opcionales: se aceptan y se tratan como ausentes.
const PlannedEdgeSchema = z.object({
  id: z.string(),
  gap: z.enum(["ninguno", "suave", "fuerte", "muy-fuerte"]).nullish(),
  bridge: z.array(z.string()).nullish(),
  note: z.string().nullish(),
  why: z.string().nullish(),
});

export const RoadmapSchema = z.object({
  topic: z.string(),
  verdict: z.string(),
  diagnosis: z.string().optional(),
  edgeReview: z.array(z.object({ from: z.string(), to: z.string(), keep: z.boolean(), why: z.string().optional() })).default([]),
  levelChanges: z.array(z.object({ id: z.string(), from: z.number().optional(), to: z.number().int().min(0).max(4), why: z.string().optional() })).default([]),
  /** Origen → aristas. Acepta objeto o lista de pares. */
  leadsTo: z.union([z.record(z.string(), z.array(PlannedEdgeSchema)), z.array(z.tuple([z.string(), z.array(PlannedEdgeSchema)]))]),
  incomingFromOtherLines: z.array(PlannedEdgeSchema.omit({ id: true }).extend({ from: z.string(), to: z.string() })).default([]),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type PlannedEdge = z.infer<typeof PlannedEdgeSchema>;

export const CalibrationSchema = z.object({
  decisions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      severity: z.enum(["ninguno", "fuerte", "muy-fuerte"]),
      bridge: z.array(z.string()).nullish().transform((b) => b ?? []),
      note: z.string().nullish(),
      why: z.string().nullish(),
    }),
  ),
});

// ── Rutas: propuesta y rutas escritas por los agentes ──────────────────────────────────────

export const RouteProposalSchema = z.object({
  routes: z.array(z.object({ id: z.string(), kind: z.string() }).passthrough()),
});

export const WrittenRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["corriente", "objetivo"]),
  line: z.string(),
  promise: z.string(),
  summary: z.string(),
  discarded: z.boolean().optional(),
  steps: z.array(
    z.object({
      book: z.string(),
      why: z.string(),
      source: z.number().int().nullable().optional(),
      optional: z.boolean().optional(),
      gap: GapSchema.optional(),
      order: z.object({ url: z.string(), timestamp: z.string().optional(), quote: z.string() }).optional(),
    }),
  ),
});
export type WrittenRoute = z.infer<typeof WrittenRouteSchema>;

/** Archivo de ruta: completa, o solo `{ id, discarded: true, … }` si el agente la descartó. */
export const WrittenRouteFileSchema = z.union([z.object({ id: z.string(), discarded: z.literal(true) }).passthrough(), WrittenRouteSchema]);
