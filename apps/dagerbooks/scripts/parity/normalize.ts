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
      // RSC (crudo o embebido en el HTML como string): 2:I[47314,[...],"default"]
      .replace(/([0-9a-f]+):I\[\d+,/g, "$1:I[[module],")
      // Qué archivos JS carga cada componente es decisión del bundler (cambia al mover código a un paquete):
      // las listas de chunks y los <script src> de chunks se comparan como un todo, no uno por uno.
      .replace(/\[(?:\\?"\/_next\/static\/chunks\/\[chunk\]\.js\\?",?)+\]/g, "[chunks]")
      .replace(/<script src="\/_next\/static\/chunks\/\[chunk\]\.js" async=""><\/script>/g, "")
      .replace(/<link rel="preload" as="script" fetchPriority="low" href="\/_next\/static\/chunks\/\[chunk\]\.js"\/>/g, "")
      // Igual con el CSS: cuántas hojas de chunk carga una página depende de cómo Turbopack agrupa los módulos.
      .replace(/<link rel="stylesheet" href="\/_next\/static\/chunks\/\[chunk\]\.css" data-precedence="next"\/>/g, "")
      .replace(/(^|\n):HL\["\/_next\/static\/chunks\/\[chunk\]\.css","style"\]/g, "")
      .replace(/,?\["\$","link","\d+",\{"rel":"stylesheet","href":"\/_next\/static\/chunks\/\[chunk\]\.css","precedence":"next","crossOrigin":"\$undefined","nonce":"\$undefined"\}\]/g, "")
      // Cache-buster de las imágenes OG: cambia con el código de la ruta; la imagen se compara aparte.
      .replace(/(opengraph-image|twitter-image)\?[0-9a-f]{16}/g, "$1?[hash]")
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

const CHUNK_SCRIPT = /\["\$","script","script-\d+",\{"src":"\/_next\/static\/chunks\/\[chunk\]\.js","async":true,"nonce":"\$undefined"\}\]/;

/** Filas del payload: `<id>:<json>\n`, o `<id>:T<largo hex>,<texto>` delimitada por bytes, sin salto. */
function parseRscRows(text: string): { id: string; body: string }[] {
  const buf = Buffer.from(text, "utf8");
  const rows: { id: string; body: string }[] = [];
  let i = 0;
  while (i < buf.length) {
    const colon = buf.indexOf(0x3a, i); // ":"
    const id = colon > i ? buf.subarray(i, colon).toString("utf8") : "";
    if (!/^[0-9a-f]+$/.test(id)) {
      // Fila sin id (hints como `:HL[...]`) o texto suelto: hasta el fin de línea.
      const nl = buf.indexOf(0x0a, i);
      const end = nl < 0 ? buf.length : nl;
      rows.push({ id: "", body: buf.subarray(i, end).toString("utf8") });
      i = end + 1;
      continue;
    }
    const t = /^T([0-9a-f]+),/.exec(buf.subarray(colon + 1, colon + 20).toString("latin1"));
    if (t) {
      const start = colon + 1 + t[0].length;
      const end = start + parseInt(t[1], 16);
      rows.push({ id, body: `T,${buf.subarray(start, end).toString("utf8")}` });
      i = end;
    } else {
      const nl = buf.indexOf(0x0a, colon);
      const end = nl < 0 ? buf.length : nl;
      rows.push({ id, body: buf.subarray(colon + 1, end).toString("utf8") });
      i = end + 1;
    }
  }
  return rows;
}

/**
 * Payload RSC (`<id>:<fila>` por línea). Cuántos chunks carga una página cambia la cantidad de filas
 * y con eso la numeración de todas las siguientes. Se sacan los <script> de chunks (filas y elementos
 * sueltos) y se renumeran las filas por orden de aparición, para comparar solo el contenido.
 */
export function normalizeRsc(text: string): string {
  const rows = parseRscRows(text);
  const dropped = new Set(rows.filter((r) => r.id && new RegExp(`^${CHUNK_SCRIPT.source}$`).test(r.body)).map((r) => r.id));
  const kept = rows.filter((r) => !dropped.has(r.id));
  // Número canónico por orden de primera aparición (definición o referencia).
  const order = new Map<string, string>();
  const see = (id: string) => {
    if (!order.has(id)) order.set(id, order.size.toString(36));
  };
  for (const r of kept) {
    if (r.id) see(r.id);
    for (const m of r.body.matchAll(/"\$(?:L|@|)([0-9a-f]+)(?::[^"]*)?"/g)) if (!dropped.has(m[1])) see(m[1]);
  }
  const ref = (body: string) =>
    body
      // referencias a filas sacadas, dentro de un array
      .replace(/,?"\$L([0-9a-f]+)"/g, (all, id: string) => (dropped.has(id) ? "" : all))
      // <script> de chunks sueltos dentro de arrays
      .replace(new RegExp(`,?${CHUNK_SCRIPT.source.replace(/script-\\d\+/, "script-\\d+")}`, "g"), "")
      .replace(/"\$(L|@|)([0-9a-f]+)((?::[^"]*)?)"/g, (all, kind: string, id: string, rest: string) =>
        order.has(id) ? `"$${kind}#${order.get(id)}${rest}"` : all,
      )
      // keys "script-N" que se corren al sacar uno
      .replace(/"script-\d+"/g, '"script-#"');
  return kept.map((r) => (r.id ? `#${order.get(r.id)}:${ref(r.body)}` : ref(r.body))).join("\n");
}

/** HTML: el payload RSC incrustado (self.__next_f) se saca; se compara en los .rsc. */
export function normalizeHtml(text: string): string {
  return text.replace(/<script>self\.__next_f\.push\([\s\S]*?\)<\/script>/g, "");
}

/** Normalización completa según el tipo de archivo. */
export function normalizeFile(name: string, text: string, buildId: string): string {
  const base = normalizeText(text, buildId);
  if (name.endsWith(".rsc")) return normalizeRsc(base);
  if (name.endsWith(".html")) return normalizeHtml(base);
  return base;
}
