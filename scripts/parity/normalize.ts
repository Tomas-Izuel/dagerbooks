/**
 * Normalización de la salida de `next build` para comparar dos builds.
 * Quita lo que cambia sin que cambie el producto: buildId, hashes de chunks y fuentes,
 * hashes de CSS Modules e ids de módulo del payload RSC.
 */

export function normalizeText(text: string, buildId: string): string {
  let out = text;
  if (buildId) out = out.split(buildId).join("[BUILD_ID]");
  return (
    out
      // /_next/static/chunks/0nfmomnt2h3q6.js · .css
      .replace(/\/_next\/static\/chunks\/[\w.-]+?\.(js|css)/g, "/_next/static/chunks/[chunk].$1")
      // /_next/static/media/8c686831cca8fbc0-s.p.07m19b7gifklb.woff2
      .replace(/\/_next\/static\/media\/[\w.-]+?\.(woff2?|png|jpe?g|svg|webp|avif)/g, "/_next/static/media/[asset].$1")
      // big_shoulders_eecbd55c-module__ge7cWa__variable
      .replace(/_[0-9a-f]{8}-module__/g, "-module__")
      // PageShell-module__9arEHa__shell
      .replace(/-module__[\w-]{6}__/g, "-module__[h]__")
      // RSC: 2:I[47314,[...],"default"]
      .replace(/(^|\n)([0-9a-f]+):I\[\d+,/g, "$1$2:I[[module],")
      // .meta: "key": "/route-cache/APP_PAGE/<hash>"
      .replace(/(\/route-cache\/[A-Z_]+\/)[0-9a-f]+/g, "$1[hash]")
  );
}

/** `.body` de rutas de archivo (sitemap.xml, robots.txt, icon.svg) son texto; las imágenes OG no. */
export function isText(file: string): boolean {
  if (/\.(html|rsc|meta)$/.test(file)) return true;
  return /\.(xml|txt|svg|json)\.body$/.test(file);
}

/** JSON con claves ordenadas: el orden de claves depende del schema, no del contenido. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value), null, 2) + "\n";
}
