import type { AsinByMarketplace } from "@estantes/catalog";
import config from "@/creator.config";

const MARKETPLACE = config.affiliate?.marketplace ?? "es";

/** Afiliado de Amazon: tag y tienda salen de creator.config.ts. */
export const AMAZON_HOST = `https://www.amazon.${MARKETPLACE}`;

/** ASIN del libro en la tienda del sitio (undefined si no tiene en esa tienda). */
export const asinFor = (asin: AsinByMarketplace | undefined): string | undefined => asin?.[MARKETPLACE];

/** Solo el tag de afiliado; sin otros parámetros de tracking. */
export const amazonUrl = (asin: string) =>
  config.affiliate ? `${AMAZON_HOST}/dp/${asin}?tag=${config.affiliate.tag}` : `${AMAZON_HOST}/dp/${asin}`;
