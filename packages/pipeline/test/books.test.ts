import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parse, parseDocument } from "yaml";
import { aggregateStance, inWindows, mergeExtractions, sourceUrl } from "../src/commands/merge";
import { appendSources, newBookDoc, setField } from "../src/lib/books-io";
import { isbn10, parseSearch, parseTitle } from "../src/adapters/amazon";
import { authorOk, titleOk } from "../src/adapters/openlibrary";

const FIXTURE = fs.readFileSync(path.resolve("test/fixtures/book.yaml"), "utf8");
const str = (doc: ReturnType<typeof newBookDoc>) => doc.toString({ lineWidth: 0, flowCollectionPadding: false });

describe("archivos de libro", () => {
  it("un libro nuevo sale con el mismo estilo y orden que los existentes", () => {
    const data = parse(FIXTURE) as Record<string, unknown>;
    // El orden de las claves del objeto no importa: manda el orden del catálogo.
    const shuffled = Object.fromEntries(Object.entries(data).reverse());
    assert.equal(str(newBookDoc(shuffled)), FIXTURE);
  });

  it("setField inserta en su lugar y appendSources suma al final", () => {
    const doc = parseDocument(FIXTURE.replace('isbn: "9781443425438"\n', ""));
    setField(doc, "isbn", "9781443425438");
    appendSources(doc, [{ url: "https://example.com/x", timestamp: "2:00", quote: "otra" }]);
    const out = doc.toString({ lineWidth: 0, flowCollectionPadding: false });
    assert.ok(out.indexOf('isbn: "9781443425438"') > out.indexOf("leadsTo:") && out.indexOf("isbn:") < out.indexOf("asin:"));
    assert.match(out, /quote: "lo recomiendo"\n {2}- url: "https:\/\/example.com\/x"\n {4}timestamp: "2:00"\n {4}quote: "otra"\n/);
  });
});

describe("cruce de extracciones", () => {
  it("agrega posturas: recomienda > con reservas > crítica sin menciones > menciona", () => {
    assert.equal(aggregateStance(["mentions", "recommends"]), "recommends");
    assert.equal(aggregateStance(["mentions", "mixed"]), "mixed");
    assert.equal(aggregateStance(["criticizes"]), "criticizes");
    assert.equal(aggregateStance(["criticizes", "mentions"]), "mentions");
  });

  it("arma URLs con minuto, respeta ventanas a ignorar y separa conocidos de nuevos", () => {
    assert.equal(sourceUrl(undefined, "YQfRVo5UwOM", "1:17"), "https://www.youtube.com/watch?v=YQfRVo5UwOM&t=77s");
    assert.equal(sourceUrl("https://www.instagram.com/reel/X/", "abc", "0:12"), "https://www.instagram.com/reel/X/");
    assert.equal(inWindows("0:33:10", ["0:32:00-0:36:00"]), true);
    assert.equal(inWindows("0:31:59", ["0:32:00-0:36:00"]), false);

    const out = mergeExtractions(
      [
        {
          file: "a.json",
          books: [
            { title: "Cosmos", authors: ["Carl Sagan"], knownId: null, stance: "recommends", identificationConfidence: "high", sources: [{ videoId: "AAAAAAAAAAA", timestamp: "1:00", quote: "léanlo" }] },
            { title: "Cosmos: edición ilustrada", authors: [], stance: "mentions", identificationConfidence: "low", sources: [{ videoId: "BBBBBBBBBBB", timestamp: "2:00" }] },
            { title: "Un libro", authors: [], knownId: "un-libro", stance: "mentions", identificationConfidence: "high", sources: [{ videoId: "YQfRVo5UwOM", timestamp: "1:17" }, { videoId: "CCCCCCCCCCC", timestamp: "0:33:00" }, { videoId: "CCCCCCCCCCC", timestamp: "0:40:00" }] },
            { title: "Pseudociencia", authors: ["X"], stance: "criticizes", identificationConfidence: "high", sources: [] },
          ],
        },
      ],
      {
        ids: new Set(["un-libro"]),
        titleIndex: new Map([["un libro", "un-libro"]]),
        existingSpots: new Map([["un-libro", new Set(["https://www.youtube.com/watch?v=YQfRVo5UwOM@1:17"])]]),
      },
      (id) => (id === "CCCCCCCCCCC" ? { ignoreWindows: ["0:32:00-0:36:00"] } : undefined),
    );
    assert.deepEqual(out.newBooks.map((b) => [b.title, b.include, b.stance, b.identificationConfidence, b.sources.length]), [
      ["Cosmos", true, "recommends", "low", 2],
      ["Pseudociencia", false, "criticizes", "high", 0],
    ]);
    assert.deepEqual(out.knownUpdates.map((u) => [u.id, u.newSources.map((s) => s.timestamp)]), [["un-libro", ["0:40:00"]]]);
  });
});

describe("Open Library y Amazon", () => {
  it("compara títulos y autores sin acentos", () => {
    assert.equal(titleOk("Meditaciones", "Meditaciónes (Gredos)"), true);
    assert.equal(titleOk("Cosmos", "Contact"), false);
    assert.equal(authorOk("Isaac Asimov", ["ASIMOV, Isaac"]), true);
  });

  it("calcula ISBN-10 y lee fichas y búsquedas", () => {
    assert.equal(isbn10("9780201616224"), "020161622X");
    assert.equal(parseTitle('<span id="productTitle" class="x">  El programador   pragmático </span>'), "El programador pragmático");
    const html =
      '<div data-asin="B000000001" data-component-type="s-search-result"><h2><span>Cosmos</span></h2><div class="a-row a-size-base a-color-secondary"><span>de Carl Sagan</span></div></div>' +
      '<div data-asin="B000000002" data-component-type="s-search-result"><h2>Otro</h2></div>';
    assert.deepEqual(parseSearch(html), [
      { asin: "B000000001", title: "Cosmos", by: "de Carl Sagan" },
      { asin: "B000000002", title: "Otro" },
    ]);
  });
});
