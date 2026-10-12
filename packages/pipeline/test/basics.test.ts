import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs } from "../src/cli";
import { clock, secs, titleKey, youtubeId } from "../src/lib/text";
import { mergeWork } from "../src/registry";
import { upsertSource } from "../src/state";
import type { State } from "../src/schemas";

describe("estado", () => {
  const empty = (): State => ({ sources: [], issues: [], asrHints: {}, aliases: {} });

  it("avanza de estado pero no retrocede salvo que se fuerce", () => {
    const s = empty();
    upsertSource(s, { id: "a", platform: "youtube", status: "extracted", at: "2026-01-01" });
    assert.equal(upsertSource(s, { id: "a", platform: "youtube", status: "discovered", at: "2026-02-01" }), false);
    assert.equal(s.sources[0].status, "extracted");
    assert.equal(s.sources[0].at, "2026-01-01");
    upsertSource(s, { id: "a", platform: "youtube", status: "merged", at: "2026-03-01" });
    assert.equal(s.sources[0].status, "merged");
    upsertSource(s, { id: "a", platform: "youtube", status: "discovered" }, true);
    assert.equal(s.sources[0].status, "discovered");
  });
});

describe("registro", () => {
  it("completa huecos y suma ediciones sin pisar lo verificado", () => {
    const merged = mergeWork(
      { id: "x", title: "X", year: 1999, editions: [{ isbn: "1" }], asin: { es: "A" } },
      { id: "x", title: "X otro", year: 2000, authors: ["Ana"], editions: [{ isbn: "1" }, { isbn: "2" }], asin: { com: "B" } },
    );
    assert.equal(merged.title, "X");
    assert.equal(merged.year, 1999);
    assert.deepEqual(merged.authors, ["Ana"]);
    assert.deepEqual(merged.editions?.map((e) => e.isbn), ["1", "2"]);
    assert.deepEqual(merged.asin, { com: "B", es: "A" });
  });
});

describe("texto y argumentos", () => {
  it("cruza títulos, minutos e ids de video", () => {
    assert.equal(titleKey("Atomic Habits: An Easy & Proven Way"), "atomic habits");
    assert.equal(titleKey("Meditaciones (Gredos)"), "meditaciones");
    assert.equal(secs("1:02:03"), 3723);
    assert.equal(clock(3723), "1:02:03");
    assert.equal(clock(77), "1:17");
    assert.equal(youtubeId("https://www.youtube.com/watch?v=YQfRVo5UwOM&t=77s"), "YQfRVo5UwOM");
    assert.equal(youtubeId("https://youtu.be/YQfRVo5UwOM"), "YQfRVo5UwOM");
    assert.equal(youtubeId("https://example.com"), null);
  });

  it("parsea flags con y sin valor", () => {
    assert.deepEqual(parseArgs(["state", "--creator", "x", "--check"]), { _: ["state"], flags: { creator: "x", check: true } });
  });
});
