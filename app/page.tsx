import { Suspense } from "react";
import Link from "next/link";
import { Explorer, type BoardLine, type PanelEntry } from "@/components/map/Explorer";
import type { MapGeometry, MapNode } from "@/components/map/types";
import { loadCatalog } from "@/lib/catalog/load";
import { computeLayout } from "@/lib/catalog/layout";
import { booksInSector, isEntryPoint, relatedBooks } from "@/lib/catalog/queries";
import { linesFor } from "@/lib/design/lines";
import { buildSearchDocs } from "@/lib/search";
import { jsonLdString, websiteJsonLd } from "@/lib/seo";
import { topicPath } from "@/lib/seo/site";
import styles from "./page.module.css";

export default function Home() {
  const catalog = loadCatalog();
  const { books, topics, root } = catalog;
  const layout = computeLayout(catalog);
  const bookById = new Map(books.map((b) => [b.id, b]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  const nodes: MapNode[] = layout.nodes.map((n) => {
    const b = bookById.get(n.id)!;
    return {
      id: n.id,
      title: b.title,
      titleEs: b.titleEs,
      topicId: n.sector,
      level: n.ring,
      x: n.x,
      y: n.y,
      angle: n.angle,
      r: n.r,
      entry: isEntryPoint(n.id),
      incomplete: b.confidence === "low",
    };
  });
  const geometry: MapGeometry = {
    nodes,
    edges: layout.edges,
    sectors: layout.sectors,
    rings: layout.rings,
    bounds: layout.bounds,
  };

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
        topics: b.topics,
        summary: b.summary,
        context: b.context,
        sources: (b.sources ?? []).map(({ url, title, timestamp, quote }) => ({ url, title, timestamp, quote })),
        confidence: b.confidence === "low" ? "low" : "ok",
        missing: b.missing,
        coverId: b.coverId,
      },
      related: relatedBooks(b.id).map((r) => ({ id: r.book.id, reason: r.reason })),
    };
  }

  const explorerNodes = books.map((b) => ({ id: b.id, leadsTo: b.leadsTo, topics: b.topics, level: b.level }));

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
