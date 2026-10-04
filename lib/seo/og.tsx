import { ImageResponse } from "next/og";
import { getTopics } from "@/lib/catalog/queries";
import { linesFor } from "@/lib/design/lines";
import { SITE_NAME } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/*
 * Tokens are CSS variables and do not exist inside next/og, so these hex values
 * MIRROR app/styles/tokens.css. Keep them in sync when the palette changes.
 */
const GROUND = "#0b1230"; // --enamel-900
const GROUND_DEEP = "#070c22"; // --enamel-950
const PORCELAIN = "#f3f1ea"; // --porcelain-50
const PORCELAIN_MUTED = "#a9b3d6"; // --porcelain-400
const ON_INK = "#070c22"; // --fg-on-ink
const INKS: Record<string, string> = {
  fundamentos: "#3ec6e0", // --ink-a
  matematicas: "#f0484e", // --ink-b
  sistemas: "#2dbe5a", // --ink-c
  economia: "#b07cf0", // --ink-d
  filosofia: "#ffc20e", // --ink-e
  historia: "#5b86ff", // --ink-f
  "desarrollo-personal": "#f05aa8", // --ink-g
  startups: "#b5e03a", // --ink-h
  oficio: "#ff8a2b", // --ink-i
  arquitectura: "#d9976a", // --ink-j
};
const INK_ORDER = Object.values(INKS);

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };

/** Fetches a static TTF from the Google Fonts CSS API (no UA header => TTF, which satori accepts). */
async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weight}&display=swap`, {
        signal: AbortSignal.timeout(5000),
      })
    ).text();
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

let fontsPromise: Promise<OgFont[]> | undefined;

/** Big Shoulders (display) + Overpass (labels). If the fetch fails, returns [] and satori uses its default font; never throws. */
function loadFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([loadGoogleFont("Big Shoulders", 800), loadGoogleFont("Overpass", 600)]).then(([display, sign]) => {
    const fonts: OgFont[] = [];
    if (display) fonts.push({ name: "Big Shoulders", data: display, weight: 800, style: "normal" });
    if (sign) fonts.push({ name: "Overpass", data: sign, weight: 600, style: "normal" });
    return fonts;
  });
  return fontsPromise;
}

interface OgOptions {
  title: string;
  subtitle?: string;
  /** Topic id picks the line ink and letter. Omit for the network (ten inks). */
  topicId?: string | null;
}

export async function ogImage({ title, subtitle, topicId }: OgOptions) {
  const fonts = await loadFonts();
  const display = fonts.some((f) => f.name === "Big Shoulders") ? "Big Shoulders" : "sans-serif";
  const sign = fonts.some((f) => f.name === "Overpass") ? "Overpass" : "sans-serif";

  const ink = topicId ? (INKS[topicId] ?? PORCELAIN) : null;
  const letter = topicId ? linesFor(getTopics().map((t) => t.id)).find((l) => l.topicId === topicId)?.letter : undefined;

  const size = title.length > 52 ? 96 : title.length > 28 ? 120 : 148;
  const stationX = [96, 330, 564, 798, 1032];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: GROUND, color: PORCELAIN, fontFamily: sign }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "56px 72px 0 72px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 800, fontSize: 44, letterSpacing: 6, textTransform: "uppercase" }}>{SITE_NAME}</div>
          {letter && ink ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 88,
                height: 88,
                borderRadius: 44,
                background: ink,
                color: ON_INK,
                fontFamily: display,
                fontWeight: 800,
                fontSize: 60,
              }}
            >
              {letter}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "0 72px", gap: 20 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: 1, maxHeight: size * 2 + 10, overflow: "hidden" }}>
            {title}
          </div>
          {subtitle ? <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: PORCELAIN_MUTED }}>{subtitle}</div> : null}
        </div>

        {/* Track: the line ink at full bleed with stations; the last one is the station ring */}
        <div style={{ display: "flex", position: "relative", width: "100%", height: 96, marginBottom: 56 }}>
          {ink ? (
            <div style={{ position: "absolute", left: 0, top: 34, width: 1200, height: 28, background: ink, display: "flex" }} />
          ) : (
            INK_ORDER.map((c, i) => (
              <div key={c} style={{ position: "absolute", left: i * 120, top: 34, width: 120, height: 28, background: c, display: "flex" }} />
            ))
          )}
          {stationX.map((x, i) => (
            <div
              key={x}
              style={{
                position: "absolute",
                left: x - (i === stationX.length - 1 ? 34 : 14),
                top: i === stationX.length - 1 ? 14 : 34,
                width: i === stationX.length - 1 ? 68 : 28,
                height: i === stationX.length - 1 ? 68 : 28,
                borderRadius: 40,
                background: PORCELAIN,
                border: `${i === stationX.length - 1 ? 14 : 8}px solid ${ink ?? GROUND_DEEP}`,
                display: "flex",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
