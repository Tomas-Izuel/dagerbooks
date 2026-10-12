import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createQueries, defineCatalog, deriveRecommendation } from "../src";
import { CatalogError, editorSchemas, loadCatalogFrom } from "../src/node";
import { book, writeFixture } from "./helpers";

const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof CatalogError) return [...e.problems].sort();
    throw e;
  }
  assert.fail("se esperaba un CatalogError");
};

const topics = [
  { id: "uno", name: "Uno", description: "Tema uno." },
  { id: "dos", name: "Dos", description: "Tema dos." },
];

describe("progression (raíz, niveles y prerrequisitos)", () => {
  const def = defineCatalog({
    modules: { progression: true, routes: false, updates: false },
    recommendations: ["fuerte", "interesante", "mencion"],
    stance: "optional",
  });
  const valid = () => ({
    "topics.yaml": topics,
    "books.yaml": [
      book("raiz", { level: 0, topics: [], leadsTo: ["a"] }),
      book("a", { leadsTo: ["b"] }),
      book("b", { level: 2, topics: ["dos"] }),
    ],
  });

  it("carga, deriva y arma la raíz", () => {
    const c = loadCatalogFrom(def, writeFixture(valid()));
    assert.equal(c.root.id, "raiz");
    assert.deepEqual(c.books.map((b) => b.primaryTopic), [null, "uno", "dos"]);
    assert.equal(c.books[1].recommendation, "interesante");
    assert.deepEqual(c.books[1].leadsTo, ["b"]);
    const q = createQueries(() => c);
    assert.deepEqual(q.prerequisiteChain("b").map((b) => b.id), ["raiz", "a"]);
    assert.equal(q.isEntryPoint("a"), true);
  });

  it("da los mensajes de siempre", () => {
    const f = valid();
    (f["books.yaml"] as Record<string, unknown>[])[2] = book("b", { level: 0, topics: [], leadsTo: ["a"] });
    assert.deepEqual(
      problemsOf(() => loadCatalogFrom(def, writeFixture(f))),
      [
        'catálogo › leadsTo: ciclo detectado: a -> b -> a',
        'catálogo › level: debe haber exactamente un libro de nivel 0 (hay 2: raiz, b)',
        'libro "a" › leadsTo[0]: "b" (nivel 0) debe tener nivel mayor que "a" (nivel 1)',
      ].sort(),
    );
  });
});

describe("plano con árbol de temas y postura obligatoria", () => {
  const def = defineCatalog({ modules: { progression: false, routes: false, updates: false } });
  const tree = [
    { id: "ciencia", name: "Ciencia", description: "Raíz." },
    { id: "fisica", name: "Física", description: "Hoja.", parent: "ciencia" },
    { id: "biologia", name: "Biología", description: "Hoja.", parent: "ciencia" },
  ];

  it("acepta libros en hojas y deriva el juicio de las menciones", () => {
    const c = loadCatalogFrom(
      def,
      writeFixture({
        "topics.yaml": tree,
        "books.yaml": [
          book("cosmos", { topics: ["fisica"] }),
          book("pseudo", { topics: ["biologia"], sources: [{ url: "https://example.com/x", stance: "criticizes" }] }),
          book("citado", { topics: ["biologia"], sources: [{ url: "https://example.com/y", stance: "mentions" }] }),
        ],
      }),
    );
    assert.deepEqual(
      c.books.map((b) => b.recommendation),
      ["interesante", "desaconseja", "mencion"],
    );
    assert.equal(c.root, undefined);
    assert.equal(createQueries(() => c).prerequisiteChain("cosmos").length, 0);
  });

  it("rechaza nivel 0, temas padre, postura faltante y árboles de tres niveles", () => {
    assert.deepEqual(
      problemsOf(() =>
        loadCatalogFrom(
          def,
          writeFixture({
            "topics.yaml": [...tree, { id: "cuantica", name: "Cuántica", description: "Nieta.", parent: "fisica" }],
            "books.yaml": [
              book("cero", { level: 0, topics: [] }),
              book("padre", { topics: ["ciencia"] }),
              book("sin-postura", { topics: ["biologia"], sources: [{ url: "https://example.com/z" }] }),
            ],
          }),
        ),
      ),
      [
        'libro "cero" › level: level va de 1 (introductorio) a 4 (especialista)',
        'libro "cero" › topics: debe tener al menos un tema',
        'libro "padre" › topics[0]: el tema "ciencia" tiene subtemas; usá uno de ellos',
        'libro "sin-postura" › sources[0].stance: stance debe ser "recommends", "mixed", "mentions", "criticizes"',
        'tema "cuantica" › parent: "fisica" ya es subtema de "ciencia"; los temas admiten dos niveles',
      ].sort(),
    );
  });

  it("no acepta leadsTo sin el módulo progression", () => {
    const problems = problemsOf(() =>
      loadCatalogFrom(def, writeFixture({ "topics.yaml": tree, "books.yaml": [book("x", { topics: ["fisica"], leadsTo: ["y"] })] })),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^libro "x" › \(raíz\): Unrecognized key: "leadsTo"$/);
  });

  it("sin desaconseja entre los niveles, una crítica cae en mención", () => {
    assert.equal(deriveRecommendation([{ url: "u", stance: "criticizes" }], ["fuerte", "interesante", "mencion"]), "mencion");
  });
});

describe("un archivo por libro", () => {
  const def = defineCatalog({
    modules: { progression: false, routes: false, updates: true },
    content: { books: { dir: "books" }, updates: { dir: "updates" } },
  });

  it("ordena por seq y después por id, y avisa seq repetidos", () => {
    const c = loadCatalogFrom(
      def,
      writeFixture({
        "topics.yaml": topics,
        "books/zeta.yaml": book("zeta", { seq: 0 }),
        "books/alfa.yaml": book("alfa", { seq: 2 }),
        "books/beta.yaml": book("beta", { seq: 2 }),
        "books/sin-seq.yaml": book("sin-seq"),
        "updates/2026-10-01-lanzamiento.yaml": { id: "2026-10-01-lanzamiento", date: "2026-10-01", title: "Hola", books: ["zeta"], improvements: ["Arranca."] },
      }),
    );
    assert.deepEqual(c.books.map((b) => b.id), ["zeta", "alfa", "beta", "sin-seq"]);
    assert.deepEqual(c.warnings, ['libro "beta" › seq: comparte seq 2 con "alfa"; se desempata por id']);
    assert.equal(c.updates.length, 1);
  });

  it("exige que el id coincida con el archivo y nombra el archivo si falta el id", () => {
    const { id: _, ...noId } = book("x");
    void _;
    assert.deepEqual(
      problemsOf(() =>
        loadCatalogFrom(
          def,
          writeFixture({ "topics.yaml": topics, "books/otro.yaml": book("uno-mal"), "books/sin.yaml": noId, "updates/.keep.yaml": "" }),
        ),
      ),
      [
        'libro "uno-mal" › id: no coincide con el nombre del archivo (otro.yaml)',
        "libro books/sin.yaml (sin id) › id: Invalid input: expected string, received undefined",
        "updates/.keep.yaml: debe tener una sola entrada (un objeto), no una lista",
      ].sort(),
    );
  });

  it("genera schemas de objeto suelto con los temas hoja", () => {
    const dir = writeFixture({ "topics.yaml": topics, "books/a.yaml": book("a"), "updates/u.yaml": { id: "u", date: "2026-10-01", title: "T", improvements: ["x"] } });
    const s = editorSchemas(def, loadCatalogFrom(def, dir));
    assert.deepEqual(Object.keys(s).sort(), ["book.schema.json", "topics.schema.json", "update.schema.json"]);
    assert.deepEqual(s["book.schema.json"].properties.topics.items.enum, ["uno", "dos"]);
  });
});

describe("límites del paquete", () => {
  it("el entry de cliente no importa fs, yaml ni el entry de node", () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = fs.readFileSync(file, "utf8");
      for (const [, spec] of src.matchAll(/from "([^"]+)"/g)) {
        assert.ok(!/^node:|^yaml$|\/node(\/|$)/.test(spec), `${path.relative(".", file)} importa ${spec}`);
        if (spec.startsWith(".")) {
          const next = path.resolve(path.dirname(file), spec);
          visit(fs.existsSync(`${next}.ts`) ? `${next}.ts` : path.join(next, "index.ts"));
        }
      }
    };
    visit(path.resolve("src/index.ts"));
  });
});
