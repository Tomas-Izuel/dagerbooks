import { ImageResponse } from "next/og";
import { computeLayout } from "@/lib/catalog/layout";
import { loadCatalog } from "@/lib/catalog/load";
import { getTopics } from "@/lib/catalog/queries";
import { linesFor } from "@/lib/design/lines";
import { SITE_NAME } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/*
 * Tokens are CSS variables and do not exist inside next/og, so these hex values
 * MIRROR app/styles/tokens.css. Keep them in sync when the palette changes.
 */
export const GROUND = "#0b1230"; // --enamel-900
const GROUND_DEEP = "#070c22"; // --enamel-950
export const PORCELAIN = "#f3f1ea"; // --porcelain-50
const PORCELAIN_MUTED = "#a9b3d6"; // --porcelain-400
const ON_INK = "#070c22"; // --fg-on-ink
export const INKS: Record<string, string> = {
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


/* ---------------------------------------------------------------- title fitting */

/** Rough advance of Big Shoulders 800 caps, in em, letter-spacing included. Deliberately conservative. */
const CAP_ADVANCE = 0.5;

function wrap(text: string, size: number, width: number): string[] {
  const max = Math.max(1, Math.floor(width / (size * CAP_ADVANCE + 1)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Picks the largest size (down to `floor`) at which the title fits `maxLines` lines in
 * `width`; at the floor it clamps with an ellipsis. Returns explicit lines so the render is deterministic.
 */
export function fitTitle(title: string, { width, maxHeight, maxLines = 3, ceil = 144, floor = 60 }: { width: number; maxHeight: number; maxLines?: number; ceil?: number; floor?: number }) {
  const text = title.toUpperCase();
  for (let size = ceil; size >= floor; size -= 4) {
    const lines = wrap(text, size, width);
    if (lines.length <= maxLines && lines.length * size * 0.95 <= maxHeight) return { size, lines };
  }
  const lines = wrap(text, floor, width);
  const kept = lines.slice(0, maxLines);
  const max = Math.max(1, Math.floor(width / (floor * CAP_ADVANCE + 1)));
  let last = kept[maxLines - 1];
  if (last.length > max - 1) last = last.slice(0, max - 1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return { size: floor, lines: kept };
}

/* ---------------------------------------------------------------- cover */

/** Open Library cover as a data URI, or null on any failure (offline build, missing cover, placeholder). */
async function loadCover(coverId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- shared pieces */

function Wordmark({ display }: { display: string }) {
  return <div style={{ display: "flex", fontFamily: display, fontWeight: 800, fontSize: 44, letterSpacing: 6, textTransform: "uppercase" }}>{SITE_NAME}</div>;
}

function Track({ ink }: { ink: string | null }) {
  const stationX = [96, 330, 564, 798, 1032];
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: 96, marginBottom: 56 }}>
      {ink ? (
        <div style={{ position: "absolute", left: 0, top: 34, width: 1200, height: 28, background: ink, display: "flex" }} />
      ) : (
        INK_ORDER.map((c, i) => <div key={c} style={{ position: "absolute", left: i * 120, top: 34, width: 120, height: 28, background: c, display: "flex" }} />)
      )}
      {stationX.map((x, i) => {
        const last = i === stationX.length - 1;
        return (
          <div
            key={x}
            style={{
              position: "absolute",
              left: x - (last ? 34 : 14),
              top: last ? 14 : 34,
              width: last ? 68 : 28,
              height: last ? 68 : 28,
              borderRadius: 40,
              background: PORCELAIN,
              border: `${last ? 14 : 8}px solid ${ink ?? GROUND_DEEP}`,
              display: "flex",
            }}
          />
        );
      })}
    </div>
  );
}

async function fontNames() {
  const fonts = await loadFonts();
  return {
    fonts,
    display: fonts.some((f) => f.name === "Big Shoulders") ? "Big Shoulders" : "sans-serif",
    sign: fonts.some((f) => f.name === "Overpass") ? "Overpass" : "sans-serif",
  };
}

/* ---------------------------------------------------------------- generic (book, topic, pages) */

interface OgOptions {
  title: string;
  subtitle?: string;
  /** Topic id picks the line ink and letter. Omit for the network (ten inks). */
  topicId?: string | null;
  /** Open Library cover id; shown as a plaque on the right when it loads. */
  coverId?: number;
}

export async function ogImage({ title, subtitle, topicId, coverId }: OgOptions) {
  const { fonts, display, sign } = await fontNames();
  const ink = topicId ? (INKS[topicId] ?? PORCELAIN) : null;
  const letter = topicId ? linesFor(getTopics().map((t) => t.id)).find((l) => l.topicId === topicId)?.letter : undefined;
  const cover = coverId ? await loadCover(coverId) : null;

  const textWidth = cover ? 1056 - 240 - 48 : 1056;
  // The middle band is ~330px tall; reserve room for the subtitle line.
  const fit = fitTitle(title, { width: textWidth, maxHeight: subtitle ? 250 : 320, maxLines: 3 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: GROUND, color: PORCELAIN, fontFamily: sign }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "56px 72px 0 72px" }}>
          <Wordmark display={display} />
          {letter && ink ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: 44, background: ink, color: ON_INK, fontFamily: display, fontWeight: 800, fontSize: 60 }}>
              {letter}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 72px", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: textWidth }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: display, fontWeight: 800, fontSize: fit.size, lineHeight: 0.95, letterSpacing: 1 }}>
              {fit.lines.map((l, i) => (
                <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>
                  {l}
                </div>
              ))}
            </div>
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: PORCELAIN_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: textWidth }}>{subtitle}</div>
            ) : null}
          </div>
          {cover ? (
            <div style={{ display: "flex", flexShrink: 0, padding: 8, background: PORCELAIN, borderBottom: `10px solid ${ink ?? PORCELAIN}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={cover} width={200} height={300} style={{ objectFit: "cover" }} />
            </div>
          ) : null}
        </div>

        <Track ink={ink} />
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/* ---------------------------------------------------------------- home: the network */

export async function ogHome() {
  const { fonts, display, sign } = await fontNames();
  const catalog = loadCatalog();
  const { books, topics } = catalog;
  const layout = computeLayout(catalog); // compacta
  const lines = linesFor(topics.map((t) => t.id));

  const S = 0.4;
  const CX = 935;
  const CY = 315;
  const node = new Map(layout.nodes.map((n) => [n.id, n]));
  const inkOfNode = (id: string) => INKS[node.get(id)?.sector ?? ""] ?? PORCELAIN;
  const track = layout.edges.filter((e) => e.kind !== "related");
  const maxR = Math.max(...layout.nodes.map((n) => n.r));
  const discR = (maxR + 62) * S;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: GROUND, color: PORCELAIN, fontFamily: sign }}>
        <svg width={1200} height={630} viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <g transform={`translate(${CX} ${CY}) scale(${S})`}>
            {layout.rings.map((r) => (
              <circle key={r.level} cx={0} cy={0} r={r.radius} fill="none" stroke="#a9b3d6" strokeOpacity={0.16} strokeWidth={2 / S} strokeDasharray={`${4 / S} ${8 / S}`} />
            ))}
            {track.map((e) => (
              <path key={`${e.from}-${e.to}`} d={e.path} fill="none" stroke={inkOfNode(e.to)} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {layout.nodes
              .filter((n) => n.ring > 0)
              .map((n) => (
                <circle key={n.id} cx={n.x} cy={n.y} r={9} fill={PORCELAIN} stroke={GROUND} strokeWidth={4} />
              ))}
            <circle cx={0} cy={0} r={34} fill={GROUND} stroke={PORCELAIN} strokeWidth={9} />
            <circle cx={0} cy={0} r={17} fill={PORCELAIN} />
          </g>
        </svg>
        {layout.sectors.map((sec, i) => {
          const a = sec.labelAngle;
          const x = CX + Math.cos(a) * discR;
          const y = CY + Math.sin(a) * discR;
          const ink = INKS[sec.topicId] ?? PORCELAIN;
          return (
            <div
              key={sec.topicId}
              style={{ position: "absolute", left: x - 19, top: y - 19, width: 38, height: 38, borderRadius: 19, background: ink, color: ON_INK, border: `3px solid ${GROUND}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 26 }}
            >
              {lines[i]?.letter}
            </div>
          );
        })}
        {/* soft ground behind the copy so crossing tracks never fight the headline */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 640, height: 630, display: "flex", background: `linear-gradient(90deg, ${GROUND} 0%, ${GROUND} 70%, rgba(11,18,48,0) 100%)` }} />
        <div style={{ position: "absolute", left: 64, top: 0, width: 520, height: 630, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: 8, color: PORCELAIN_MUTED }}>{SITE_NAME.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: display, fontWeight: 800, fontSize: 112, lineHeight: 1.08, letterSpacing: 1 }}>
            <div style={{ display: "flex" }}>¿DÓNDE</div>
            <div style={{ display: "flex" }}>ARRANCÁS?</div>
          </div>
          <div style={{ display: "flex", width: 120, height: 8, background: INK_ORDER[4] }} />
          <div style={{ display: "flex", fontSize: 27, fontWeight: 600, lineHeight: 1.3, color: PORCELAIN }}>
            {`Los libros que recomienda Dager, en un mapa de subte. ${books.length} estaciones, ${topics.length} líneas.`}
          </div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: PORCELAIN_MUTED }}>Proyecto de la comunidad · no oficial</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
