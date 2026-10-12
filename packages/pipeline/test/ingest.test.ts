import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fixMojibake, parseInstagramExport } from "../src/adapters/instagram";
import { parseFlatPlaylist } from "../src/adapters/youtube";
import { makeBatches } from "../src/commands/ingest";
import { bestVtt, segmentsToText, vttToText } from "../src/lib/vtt";
import type { StateSource } from "../src/schemas";

describe("subtítulos y transcripciones", () => {
  it("pasa VTT a [m:ss] sin las repeticiones del subtitulado progresivo", () => {
    const vtt = [
      "WEBVTT",
      "00:00:01.000 --> 00:00:03.000\nel primer libro <c>que</c> recuerdo",
      "00:00:03.000 --> 00:00:05.000\nel primer libro que recuerdo\nfue Tom Sawyer",
      "01:02:03.500 --> 01:02:05.000\nen el extranjero",
    ].join("\n\n");
    assert.equal(vttToText(vtt), "[0:01] el primer libro que recuerdo\n[0:03] fue Tom Sawyer\n[62:03] en el extranjero");
  });

  it("elige <lang>-orig antes que <lang> y que otros idiomas", () => {
    assert.equal(bestVtt(["x.en.vtt", "x.es.vtt", "x.es-orig.vtt"], "es"), "x.es-orig.vtt");
    assert.equal(bestVtt(["x.en.vtt", "x.es.vtt"], "es"), "x.es.vtt");
  });

  it("pasa segmentos de Whisper a [h:mm:ss]", () => {
    assert.equal(segmentsToText([{ start: 3725.4, text: " Hazlitt viene antes " }, { start: 3730, text: " " }]), "[1:02:05] Hazlitt viene antes");
  });
});

describe("descubrimiento", () => {
  it("lee el listado plano de yt-dlp", () => {
    const out = "YQfRVo5UwOM\t617.0\tCÓMO ESTUDIAR (pero bien).\nshort000001\tNA\tUn short\nERROR: algo\n";
    assert.deepEqual(parseFlatPlaylist(out), [
      { id: "YQfRVo5UwOM", title: "CÓMO ESTUDIAR (pero bien).", duration: 617 },
      { id: "short000001", title: "Un short" },
    ]);
  });

  it("encuentra los reels de un export de Instagram aunque cambie la estructura", () => {
    const root = path.resolve("test/fixtures/ig-export");
    const reels = parseInstagramExport(root);
    assert.deepEqual(
      reels.map((r) => ({ id: r.id, date: r.date, caption: r.caption, url: r.url })),
      [
        { id: "18077_reel_a", date: "2024-09-10", caption: "Tres libros de física que me volaron la cabeza", url: undefined },
        { id: "18099_reel_b", date: "2024-10-04", caption: "Cosmos, de Sagan", url: "https://www.instagram.com/reel/ABC123/" },
      ],
    );
    assert.equal(fixMojibake("cafÃ©"), "café");
    assert.equal(fixMojibake("ya está bien"), "ya está bien");
  });
});

describe("tandas", () => {
  it("reparte por tamaño, saltea lo asignado y lo vacío", () => {
    const src = (id: string): StateSource => ({ id, platform: "youtube", status: "transcribed" });
    const size: Record<string, number> = { a: 300, b: 300, c: 500, d: 0, e: 100 };
    const out = makeBatches(["a", "b", "c", "d", "e", "z"].map(src), (s) => size[s.id] ?? 50, new Set(["z"]), 650);
    assert.deepEqual(out.map((b) => b.map((s) => s.id)), [["a", "b"], ["c", "e"]]);
  });
});
