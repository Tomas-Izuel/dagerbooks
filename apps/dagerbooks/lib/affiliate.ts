import type { AsinByMarketplace } from "@estantes/catalog";
import { amazonUrl as kitAmazonUrl, asinFor as kitAsinFor } from "@estantes/kit";
import config from "@/creator.config";

/** Tienda y tag de afiliado: salen de creator.config.ts. */
const MARKETPLACE = config.affiliate?.marketplace ?? "es";

/** ASIN del libro en la tienda del sitio (undefined si no tiene en esa tienda). */
export const asinFor = (asin: AsinByMarketplace | undefined): string | undefined => kitAsinFor(asin, MARKETPLACE);

/** Solo el tag de afiliado; sin otros parámetros de tracking. */
export const amazonUrl = (asin: string) => kitAmazonUrl(MARKETPLACE, asin, config.affiliate?.tag);
