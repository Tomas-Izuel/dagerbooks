import type { AsinByMarketplace, Marketplace } from "@estantes/catalog";

export interface Affiliate {
  tag: string;
  marketplace: Marketplace;
}

export const amazonHost = (marketplace: Marketplace) => `https://www.amazon.${marketplace}`;

/** ASIN del libro en una tienda (undefined si no tiene en esa tienda). */
export const asinFor = (asin: AsinByMarketplace | undefined, marketplace: Marketplace): string | undefined => asin?.[marketplace];

/** Link a la ficha del libro; solo con el tag de afiliado, sin otros parámetros de tracking. */
export const amazonUrl = (marketplace: Marketplace, asin: string, tag?: string | null) =>
  tag ? `${amazonHost(marketplace)}/dp/${asin}?tag=${tag}` : `${amazonHost(marketplace)}/dp/${asin}`;
