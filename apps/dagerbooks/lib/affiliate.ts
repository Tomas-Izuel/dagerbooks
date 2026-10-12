import config from "@/creator.config";

/** Afiliado de Amazon: tag y marketplace salen de creator.config.ts. */
export const AMAZON_HOST = `https://www.amazon.${config.affiliate?.marketplace ?? "es"}`;

/** Solo el tag de afiliado; sin otros parámetros de tracking. */
export const amazonUrl = (asin: string) =>
  config.affiliate ? `${AMAZON_HOST}/dp/${asin}?tag=${config.affiliate.tag}` : `${AMAZON_HOST}/dp/${asin}`;
