/** Afiliado de Amazon: retribución autorizada por Dager por la web. */
export const AMAZON_TAG = "ti05ab-21";
export const AMAZON_HOST = "https://www.amazon.es";

/** Solo el tag de afiliado; sin otros parámetros de tracking. */
export const amazonUrl = (asin: string) => `${AMAZON_HOST}/dp/${asin}?tag=${AMAZON_TAG}`;
