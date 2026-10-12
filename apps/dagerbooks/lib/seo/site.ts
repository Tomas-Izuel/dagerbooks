import { createSite } from "@estantes/kit";
import config from "@/creator.config";

export { openLibraryCover } from "@estantes/kit";

/** El sitio de Dager: nombre, descripción, locale y origen canónico (ver resolveSiteUrl en kit). */
export const site = createSite(config.site);

export const SITE_NAME = site.name;
export const SITE_DESCRIPTION = site.description;
export const SITE_LOCALE = site.locale;
export const SITE_URL = site.url;

export const absoluteUrl = site.absoluteUrl;
export const bookPath = (id: string) => `/libros/${id}`;
export const topicPath = (id: string) => `/temas/${id}`;
