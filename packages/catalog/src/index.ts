/**
 * @estantes/catalog: modelo de datos del catálogo de un creador. Este entry es puro (sin fs ni yaml)
 * y se puede importar desde componentes de cliente; la carga desde disco está en "@estantes/catalog/node".
 */
export * from "./primitives";
export * from "./define";
export * from "./graph";
export * from "./queries";
export { checkCore, deriveBook, deriveRecommendation } from "./core";
export { Reporter, type Noun } from "./report";
export {
  LeadsToItemSchema,
  checkProgression,
  gapsByTarget,
  leadsToId,
  withImplicitRootEdges,
  type LeadsToItem,
} from "./modules/progression";
export {
  ROUTE_KINDS,
  ROUTE_LIMITS,
  RouteOrderSchema,
  RouteSchema,
  RouteStepSchema,
  RoutesFileSchema,
  checkRoutes,
  type Route,
  type RouteKind,
  type RouteStep,
} from "./modules/routes";
export { UPDATE_LIMITS, UpdateSchema, UpdatesFileSchema, checkUpdates, sortUpdates, type SiteUpdate } from "./modules/updates";
