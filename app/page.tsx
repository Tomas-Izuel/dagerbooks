import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Explorer, type BoardLine, type PanelEntry } from "@/components/map/Explorer";
import type { MapDensityLayout, MapGeometrySet, MapNodeMeta } from "@/components/map/types";
import { RECOMMENDATION_LABELS } from "@/lib/catalog/schema";
import { loadCatalog } from "@/lib/catalog/load";
import { computeLayout, DENSITY_PRESETS } from "@/lib/catalog/layout";
import { booksInSector, isEntryPoint, relatedBooks } from "@/lib/catalog/queries";
import { DENSITIES, type Density } from "@/lib/density";
import { linesFor } from "@/lib/design/lines";
import { buildSearchDocs } from "@/lib/search";
import { jsonLdString, websiteJsonLd } from "@/lib/seo";
import { topicPath } from "@/lib/seo/site";
import styles from "./page.module.css";

// Every `?vista=` / `?tema=` / `?libro=` variant is the same page for the index: one canonical.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  const catalog = loadCatalog();
  const { books, topics, root } = catalog;
  const bookById = new Map(books.map((b) => [b.id, b]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  // One layout per density, computed at build time. The station and edge metadata
  // is identical across them, so it ships once; each density adds positions and paths.
  const computed = Object.fromEntries(DENSITIES.map((d) => [d, computeLayout(catalog, DENSITY_PRESETS[d])])) as Record<
    Density,
    ReturnType<typeof computeLayout>
  >;
  const base = computed.compacta;
  const nodes: MapNodeMeta[] = base.nodes.map((n) => {
    const b = bookById.get(n.id)!;
    return {
      id: n.id,
      title: b.title,
      titleEs: b.titleEs,
      topicId: n.sector,
      level: n.ring,
      entry: isEntryPoint(n.id),
      incomplete: b.confidence === "low",
      recommendation: b.recommendation,
    };
  });
  const edges = base.edges.map(({ from, to, kind, reason }) => ({ from, to, kind, ...(reason ? { reason } : {}) }));
  const layouts = Object.fromEntries(
    DENSITIES.map((d) => {
      const l = computed[d];
      const sameShape =
        l.nodes.length === base.nodes.length &&
        l.edges.length === base.edges.length &&
        l.nodes.every((n, i) => n.id === base.nodes[i].id) &&
        l.edges.every((e, i) => e.from === base.edges[i].from && e.to === base.edges[i].to);
      if (!sameShape) throw new Error(`layout "${d}" cambió el orden de estaciones o tramos respecto de "compacta"`);
      const entry: MapDensityLayout = {
        pos: l.nodes.flatMap((n) => [n.x, n.y, n.angle, n.r]),
        paths: l.edges.map((e) => e.path),
        sectors: l.sectors,
        rings: l.rings,
        bounds: l.bounds,
      };
      return [d, entry];
    }),
  ) as Record<Density, MapDensityLayout>;
  const geometry: MapGeometrySet = { nodes, edges, layouts };

  const lines: BoardLine[] = linesFor(topics.map((t) => t.id)).map((l) => {
    const first =
      books.find((b) => b.primaryTopic === l.topicId && isEntryPoint(b.id)) ??
      booksInSector(l.topicId).sort((a, b) => a.level - b.level)[0];
    return {
      topicId: l.topicId,
      letter: l.letter,
      color: l.color,
      name: topicName.get(l.topicId) ?? l.topicId,
      firstStation: { id: first?.id ?? root.id, title: first?.title ?? root.title },
    };
  });

  const panels: Record<string, PanelEntry> = {};
  for (const b of books) {
    panels[b.id] = {
      book: {
        id: b.id,
        title: b.title,
        titleEs: b.titleEs,
        authors: b.authors ?? [],
        year: b.year,
        kind: b.kind ?? "book",
        level: b.level,
        recommendation: b.recommendation,
        topics: b.topics,
        summary: b.summary,
        context: b.context,
        sources: (b.sources ?? []).map(({ url, title, timestamp, quote }) => ({ url, title, timestamp, quote })),
        confidence: b.confidence === "low" ? "low" : "ok",
        missing: b.missing,
        coverId: b.coverId,
        asin: b.asin,
      },
      related: relatedBooks(b.id).map((r) => ({ id: r.book.id, reason: r.reason })),
    };
  }

  const explorerNodes = books.map((b) => ({ id: b.id, leadsTo: b.leadsTo, topics: b.topics, level: b.level, recommendation: b.recommendation }));

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd()) }} />
      <Suspense fallback={<div className={styles.loading} role="status">Armando el mapa…</div>}>
        <Explorer
          geometry={geometry}
          lines={lines}
          explorerNodes={explorerNodes}
          searchDocs={buildSearchDocs(catalog)}
          panels={panels}
          recLabels={RECOMMENDATION_LABELS}
        />
      </Suspense>
      <nav aria-label="Líneas" className={styles.srOnly}>
        <ul>
          {lines.map((l) => (
            <li key={l.topicId}>
              <Link href={topicPath(l.topicId)}>Línea {l.letter}: {l.name}</Link>
            </li>
          ))}
          <li>
            <Link href="/estaciones">Directorio de estaciones</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
