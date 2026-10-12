import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { affectedApps, capabilityOf, type AppCapabilities } from "../src/affected";
import { updateYaml } from "../src/commands/updates";

const apps: AppCapabilities[] = [
  { id: "uno", modules: { progression: true, routes: true, updates: true }, affiliate: true, suggestions: true },
  { id: "dos", modules: { progression: false, routes: false, updates: true }, affiliate: false, suggestions: false },
];

describe("sitios afectados", () => {
  it("mapea cada archivo a su capacidad y a las apps que la usan", () => {
    const out = affectedApps(
      [
        "apps/uno/app/page.tsx",
        "apps/uno/research/x.json",
        "apps/dos/PRODUCT.md",
        "packages/catalog/src/modules/routes.ts",
        "packages/kit/src/affiliate.ts",
        "packages/kit/src/search/index.ts",
        "packages/kit/test/kit.test.ts",
        "packages/pipeline/src/cli.ts",
        "tools/check-boundaries.ts",
      ],
      apps,
    );
    assert.deepEqual(
      out.map((a) => [a.app, a.reasons.map((r) => r.capability)]),
      [
        ["dos", ["kit"]],
        ["uno", ["app", "module:routes", "affiliate", "kit"]],
      ],
    );
    assert.equal(capabilityOf("packages/catalog/src/define.ts")?.capability, "catalog");
    assert.equal(capabilityOf("packages/kit/src/server/index.ts")?.capability, "suggestions");
  });
});

describe("archivo de novedad", () => {
  it("sale con el estilo de los existentes", () => {
    assert.equal(
      updateYaml({ id: "2026-10-12-libros", date: "2026-10-12", title: "Libros nuevos", stream: { title: "Un stream", url: "https://youtu.be/x" }, books: ["a", "b"], improvements: ["Sumamos dos."] }),
      [
        "# yaml-language-server: $schema=../update.schema.json",
        "",
        "id: 2026-10-12-libros",
        "date: 2026-10-12",
        'title: "Libros nuevos"',
        "stream:",
        '  title: "Un stream"',
        '  url: "https://youtu.be/x"',
        "books:",
        "  - a",
        "  - b",
        "improvements:",
        '  - "Sumamos dos."',
        "",
      ].join("\n"),
    );
  });
});
