import { defineCatalog } from "@estantes/catalog";
import config from "./creator.config";

/** Modelo del catálogo de Dager: núcleo + progression, rutas y novedades. */
export const catalog = defineCatalog({
  modules: config.modules,
  recommendations: ["fuerte", "interesante", "mencion"],
  // Las menciones de Dager todavía no declaran postura (backfill pendiente).
  stance: "optional",
});
