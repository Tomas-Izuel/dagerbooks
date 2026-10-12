import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  amazonUrl,
  asinFor,
  buildSearchDocs,
  createEnumSetCodec,
  createSearcher,
  createSite,
  itemListJsonLd,
  jsonLdString,
  normalize,
  pageMetadata,
  resolveSiteUrl,
  routeProgress,
  sameSpot,
  seconds,
} from "../src";

describe("búsqueda", () => {
  const docs = buildSearchDocs({
    books: [
      { id: "meditaciones", title: "Meditaciones", authors: ["Marco Aurelio"], topics: ["filo"] },
      { id: "cosmos", title: "Cosmos", titleEs: "Cosmos", authors: ["Carl Sagan"], topics: ["fisica"], summary: "El universo." },
    ],
    topics: [
      { id: "filo", name: "Filosofía" },
      { id: "fisica", name: "Física" },
    ],
  });

  it("normaliza sin acentos ni mayúsculas", () => {
    assert.equal(normalize("  Filosofía   Clásica "), "filosofia clasica");
    assert.equal(docs[0].topics, "filosofia");
  });

  it("encuentra por título, autor y tema, y no busca con menos de 2 letras", () => {
    const s = createSearcher(docs);
    assert.equal(s.search("sagan")[0].id, "cosmos");
    assert.equal(s.search("filosofia")[0].id, "meditaciones");
    assert.deepEqual(s.search("c"), []);
  });
});

describe("filtros en la URL", () => {
  const codec = createEnumSetCodec(["a", "b", "c"]);

  it("parsea tolerante y serializa en orden canónico", () => {
    assert.deepEqual(codec.parse("c,x,a,a"), ["a", "c"]);
    assert.deepEqual(codec.parse(""), ["a", "b", "c"]);
    assert.equal(codec.serialize(["c", "a"]), "a,c");
    assert.equal(codec.serialize(["a", "b", "c"]), null);
  });

  it("alterna sin quedar nunca en cero", () => {
    assert.deepEqual(codec.toggle(["a", "c"], "c"), ["a"]);
    assert.deepEqual(codec.toggle(["a"], "a"), ["a"]);
    assert.deepEqual(codec.toggle(["c"], "a"), ["a", "c"]);
  });
});

describe("fuentes y rutas", () => {
  it("pasa minutos a segundos y reconoce la misma cita", () => {
    assert.equal(seconds("1:02:03"), 3723);
    assert.equal(seconds("x"), null);
    const v = "https://www.youtube.com/watch?v=abc";
    assert.equal(sameSpot({ url: `${v}&t=10`, timestamp: "0:10" }, { url: v, timestamp: "0:35" }), true);
    assert.equal(sameSpot({ url: v, timestamp: "0:10" }, { url: v, timestamp: "1:10" }), false);
  });

  it("cuenta el progreso sin que los desvíos bloqueen el final", () => {
    const steps = [{ id: "a", title: "A" }, { id: "b", title: "B", optional: true }, { id: "c", title: "C" }];
    const p = routeProgress(steps, new Set(["a", "c"]));
    assert.equal(p.complete, true);
    assert.equal(p.detoursDone, 0);
    assert.equal(routeProgress(steps, new Set(["b"])).next, 0);
  });
});

describe("afiliado y SEO", () => {
  it("arma el link de la tienda con tag, o sin tag si no hay afiliado", () => {
    assert.equal(asinFor({ es: "A123456789" }, "es"), "A123456789");
    assert.equal(asinFor({ es: "A123456789" }, "com"), undefined);
    assert.equal(amazonUrl("es", "A123456789", "tag-21"), "https://www.amazon.es/dp/A123456789?tag=tag-21");
    assert.equal(amazonUrl("com", "A123456789", null), "https://www.amazon.com/dp/A123456789");
  });

  it("resuelve el origen canónico y arma metadata y JSON-LD", () => {
    assert.equal(resolveSiteUrl({ VERCEL_URL: "x.vercel.app" }), "https://x.vercel.app");
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://a.com/", VERCEL_URL: "x" }), "https://a.com");
    const site = createSite({ name: "Sitio", description: "D", locale: "es_ES" }, "https://a.com");
    const m = pageMetadata(site, { title: "T", description: "x".repeat(200), path: "/p" });
    assert.equal(m.alternates.canonical, "https://a.com/p");
    assert.equal(m.description.length, 160);
    assert.equal(m.openGraph.title, "T | Sitio");
    const list = itemListJsonLd(site, { name: "L", path: "/l" }, [{ name: "<b>", path: "/b" }]);
    assert.equal(list.itemListElement[0].url, "https://a.com/b");
    assert.ok(!jsonLdString(list).includes("<"));
  });
});
