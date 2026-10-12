import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planRoadmaps, routesYaml } from "../src/commands/progression";
import { RoadmapSchema } from "../src/schemas";

const levels = new Map([
  ["a", 1],
  ["b", 2],
  ["c", 3],
  ["x", 1],
  ["y", 2],
]);

describe("planes de línea", () => {
  it("la línea dueña decide, los trasbordos se suman salvo descarte, y cada cambio de nivel cuenta una vez", () => {
    const docs = [
      RoadmapSchema.parse({
        topic: "uno",
        verdict: "mejorable",
        leadsTo: { a: [{ id: "b" }, { id: "c", gap: "fuerte", bridge: ["tema"], note: null }] },
        edgeReview: [{ from: "a", to: "y", keep: false }],
        levelChanges: [{ id: "c", to: 4 }],
      }),
      RoadmapSchema.parse({
        topic: "dos",
        verdict: "coherente",
        leadsTo: [["x", [{ id: "y" }, { id: "a" }]]],
        incomingFromOtherLines: [
          { from: "a", to: "y" },
          { from: "b", to: "y" },
        ],
      }),
    ];
    const plan = planRoadmaps(docs, levels);
    assert.deepEqual(plan.edges.get("a")?.map((e) => e.id), ["b", "c"]);
    assert.deepEqual(plan.edges.get("b")?.map((e) => e.id), []);
    assert.equal(plan.levels.get("c"), 4);
    assert.deepEqual(plan.errors.sort(), ["b(L2)->y(L2): nivel no crece", "x(L1)->a(L1): nivel no crece"]);
    assert.ok(plan.report.includes("  ~ trasbordo a->y descartado por la línea dueña"));
    assert.equal(plan.report.filter((l) => l.startsWith("  nivel c")).length, 1);
  });
});

describe("rutas", () => {
  it("corrientes primero, después objetivos, en el orden de la propuesta; sin las descartadas", () => {
    const base = { line: "l", promise: "p", summary: "s", steps: [{ book: "a", why: "porque", source: 0 }] };
    const yaml = routesYaml(
      [
        { id: "obj", name: "Objetivo", kind: "objetivo", ...base },
        { id: "cor2", name: "Corriente 2", kind: "corriente", ...base },
        { id: "cor1", name: "Corriente 1", kind: "corriente", ...base, steps: [{ book: "a", why: "w", optional: true, gap: { severity: "fuerte", bridge: ["t"] }, order: { url: "u", quote: "q" } }] },
      ],
      ["cor1", "obj", "cor2"],
      "Alguien",
    );
    assert.deepEqual([...yaml.matchAll(/^- id: (\S+)/gm)].map((m) => m[1]), ["cor1", "cor2", "obj"]);
    assert.match(yaml, /cada paso cita la fuente de Alguien/);
    assert.match(yaml, / {4}- book: a\n {6}optional: true\n {6}gap:\n {8}severity: fuerte\n {8}bridge:\n {10}- "t"\n {6}why: "w"\n {6}order:\n {8}url: "u"\n {8}quote: "q"\n/);
  });
});
