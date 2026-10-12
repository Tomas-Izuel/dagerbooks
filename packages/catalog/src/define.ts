/**
 * `defineCatalog()` arma el modelo de una app: el núcleo (libro, menciones, temas, nivel) más los
 * módulos que la app active. El loader, los tipos, las invariantes y el JSON Schema salen de acá.
 */
import * as z from "zod";
import { LeadsToItemSchema, type LeadsToItem } from "./modules/progression";
import { RouteSchema, RoutesFileSchema, type Route } from "./modules/routes";
import { UpdateSchema, UpdatesFileSchema, type SiteUpdate } from "./modules/updates";
import {
  AsinByMarketplaceSchema,
  KINDS,
  RECOMMENDATION_LEVELS,
  RelatedSchema,
  STANCES,
  Slug,
  type AsinByMarketplace,
  type Gap,
  type Recommendation,
  type Related,
  type Stance,
} from "./primitives";

export interface ModuleFlags {
  /** Nivel 0 con un único libro raíz, `leadsTo` y tramos a pie. */
  progression: boolean;
  /** Rutas de lectura curadas (`routes.yaml`). */
  routes: boolean;
  /** Novedades del sitio. */
  updates: boolean;
}

/** Cómo se guarda una colección: un archivo con una lista, o una carpeta con un archivo por entrada. */
export type ContentLayout = { file: string } | { dir: string };

export interface CatalogOptions<M extends ModuleFlags, R extends readonly Recommendation[]> {
  modules: M;
  /** Niveles de recomendación que usa la app (subconjunto ordenado de RECOMMENDATION_LEVELS). */
  recommendations?: R;
  /** Si cada mención debe declarar su postura. Creadores nuevos: "required". */
  stance?: "required" | "optional";
  content?: { books?: ContentLayout; updates?: ContentLayout };
}

export interface Source {
  url: string;
  title?: string;
  timestamp?: string;
  quote?: string;
  confidence?: "low" | "high";
  stance?: Stance;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  /** Tema padre (árbol de dos niveles). */
  parent?: string;
}

export interface RawBook<R extends string = Recommendation> {
  id: string;
  /** Orden editorial: desempata el layout cuando cada libro vive en su propio archivo. */
  seq?: number;
  title: string;
  titleEs?: string;
  authors?: string[];
  year?: number;
  kind?: (typeof KINDS)[number];
  topics: string[];
  level: number;
  summary?: string;
  context?: string;
  sources?: Source[];
  leadsTo?: LeadsToItem[];
  related?: Related[];
  isbn?: string;
  coverId?: number;
  asin?: AsinByMarketplace;
  recommendation?: R;
  confidence?: "low" | "high";
}

export type MissingField = "authors" | "summary" | "context" | "sources";

export type Book<R extends string = Recommendation> = Omit<RawBook<R>, "seq" | "confidence" | "recommendation" | "leadsTo"> & {
  /** Ids destino (normalizado desde `leadsTo`). */
  leadsTo?: string[];
  /** Tramos a pie por id destino (solo las aristas anotadas). */
  gaps: Record<string, Gap>;
  confidence: "low" | "high";
  /** Juicio del creador; si el YAML no lo declara se deriva de las menciones. No cuenta para "por completar". */
  recommendation: R;
  /** Campos faltantes que causan confidence "low" (vacío si se forzó). */
  missing: MissingField[];
  /** Primer tema = sector; null para la raíz. */
  primaryTopic: string | null;
};

export interface CatalogDef<M extends ModuleFlags = ModuleFlags, R extends readonly Recommendation[] = readonly Recommendation[]> {
  modules: M;
  recommendations: R;
  stance: "required" | "optional";
  content: { books: ContentLayout; updates: ContentLayout };
  schemas: {
    Source: z.ZodType<Source>;
    Book: z.ZodType<RawBook<R[number]>>;
    Topic: z.ZodType<Topic>;
    Route: typeof RouteSchema;
    Update: typeof UpdateSchema;
    BooksFile: z.ZodType<RawBook<R[number]>[]>;
    TopicsFile: z.ZodType<Topic[]>;
    RoutesFile: typeof RoutesFileSchema;
    UpdatesFile: typeof UpdatesFileSchema;
  };
}

export type CatalogOf<D extends CatalogDef> = {
  books: Book<D["recommendations"][number]>[];
  topics: Topic[];
  warnings: string[];
} & (D["modules"]["progression"] extends true ? { root: Book<D["recommendations"][number]> } : { root?: undefined }) &
  (D["modules"]["routes"] extends true ? { routes: Route[] } : { routes?: undefined }) &
  (D["modules"]["updates"] extends true ? { updates: SiteUpdate[] } : { updates?: undefined });

export type BookOf<D extends CatalogDef> = Book<D["recommendations"][number]>;

export function defineCatalog<const M extends ModuleFlags, const R extends readonly Recommendation[] = typeof RECOMMENDATION_LEVELS>(
  opts: CatalogOptions<M, R>,
): CatalogDef<M, R> {
  const progression = opts.modules.progression;
  const stance = opts.stance ?? "required";
  const recommendations = (opts.recommendations ?? RECOMMENDATION_LEVELS) as R;

  const Source = z.strictObject({
    url: z.url({ error: "url inválida" }),
    title: z.string().min(1).optional(),
    timestamp: z.string().min(1).optional(),
    quote: z.string().min(1).optional(),
    confidence: z.enum(["low", "high"]).optional(),
    stance:
      stance === "required"
        ? z.enum(STANCES, { error: `stance debe ser ${STANCES.map((s) => `"${s}"`).join(", ")}` })
        : z.enum(STANCES, { error: `stance debe ser ${STANCES.map((s) => `"${s}"`).join(", ")}` }).optional(),
  });

  const Book = z
    .strictObject({
      id: Slug,
      seq: z.number().int().min(0).optional(),
      title: z.string().min(1, { error: "title es obligatorio" }),
      titleEs: z.string().min(1).optional(),
      authors: z.array(z.string().min(1)).optional(),
      year: z.number().int().min(-1000).max(2100).optional(),
      kind: z.enum(KINDS).optional(),
      topics: z.array(Slug),
      level: progression
        ? z.number({ error: "level es obligatorio y debe ser un número" }).int().min(0).max(4)
        : z
            .number({ error: "level es obligatorio y debe ser un número" })
            .int()
            .min(1, { error: "level va de 1 (introductorio) a 4 (especialista)" })
            .max(4, { error: "level va de 1 (introductorio) a 4 (especialista)" }),
      summary: z.string().min(1).optional(),
      context: z.string().min(1).optional(),
      sources: z.array(Source).optional(),
      ...(progression ? { leadsTo: z.array(LeadsToItemSchema).optional() } : {}),
      related: z.array(RelatedSchema).optional(),
      isbn: z.string().regex(/^\d{9}[\dXx]$|^\d{13}$/, { error: "isbn inválido" }).optional(),
      coverId: z.number().int().positive().optional(),
      /** Código de Amazon (10 caracteres) por tienda, para el link de compra. */
      asin: AsinByMarketplaceSchema.optional(),
      recommendation: z.enum(recommendations as unknown as [R[number], ...R[number][]]).optional(),
      // Se calcula en build; solo se declara a mano para forzarlo.
      confidence: z.enum(["low", "high"]).optional(),
    })
    .check((ctx) => {
      const b = ctx.value;
      if ((!progression || b.level !== 0) && b.topics.length === 0) {
        ctx.issues.push({
          code: "custom",
          input: b.topics,
          path: ["topics"],
          message: progression ? "debe tener al menos un tema (solo el nivel 0 puede no tenerlo)" : "debe tener al menos un tema",
        });
      }
      if (new Set(b.topics).size !== b.topics.length) {
        ctx.issues.push({ code: "custom", input: b.topics, path: ["topics"], message: "hay temas repetidos" });
      }
    });

  const Topic = z.strictObject({
    id: Slug,
    name: z.string().min(1),
    description: z.string().min(1),
    parent: Slug.optional(),
  });

  return {
    modules: opts.modules,
    recommendations,
    stance,
    content: {
      books: opts.content?.books ?? { file: "books.yaml" },
      updates: opts.content?.updates ?? { file: "updates.yaml" },
    },
    schemas: {
      Source: Source as z.ZodType<Source>,
      Book: Book as unknown as z.ZodType<RawBook<R[number]>>,
      Topic: Topic as z.ZodType<Topic>,
      Route: RouteSchema,
      Update: UpdateSchema,
      BooksFile: z.array(Book) as unknown as z.ZodType<RawBook<R[number]>[]>,
      TopicsFile: z.array(Topic) as z.ZodType<Topic[]>,
      RoutesFile: RoutesFileSchema,
      UpdatesFile: UpdatesFileSchema,
    },
  };
}
