/**
 * Tipos y schemas del catálogo de Dager. El modelo vive en @estantes/catalog; este archivo lo liga
 * a la definición de la app (catalog.ts) y conserva los nombres que usa el resto del código.
 */
import type { BookOf, RawBook as PackageRawBook } from "@estantes/catalog";
import { catalog } from "@/catalog";

export {
  GAP_SEVERITIES,
  GapSchema,
  KINDS,
  LeadsToItemSchema,
  RelatedSchema,
  ROUTE_KINDS,
  ROUTE_LIMITS,
  RouteOrderSchema,
  RouteSchema,
  RoutesFileSchema,
  RouteStepSchema,
  SLUG_RE,
  UPDATE_LIMITS,
  UpdateSchema,
  UpdatesFileSchema,
  leadsToId,
} from "@estantes/catalog";
export type {
  Gap,
  GapSeverity,
  LeadsToItem,
  MissingField,
  Route,
  RouteKind,
  RouteStep,
  SiteUpdate,
  Source,
  Topic,
} from "@estantes/catalog";

export const RECOMMENDATION_LEVELS = catalog.recommendations;
export type Recommendation = (typeof RECOMMENDATION_LEVELS)[number];

export const BookSchema = catalog.schemas.Book;
export const BooksFileSchema = catalog.schemas.BooksFile;
export const TopicSchema = catalog.schemas.Topic;
export const TopicsFileSchema = catalog.schemas.TopicsFile;
export const SourceSchema = catalog.schemas.Source;

export type RawBook = PackageRawBook<Recommendation>;
export type Book = BookOf<typeof catalog>;
