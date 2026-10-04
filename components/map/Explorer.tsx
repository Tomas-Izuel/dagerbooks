"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DensityControl } from "@/components/explorer/DensityControl";
import { MapControls } from "@/components/explorer/MapControls";
import { StationBoard } from "@/components/explorer/StationBoard";
import { StationPanel } from "@/components/explorer/StationPanel";
import type { PanelBook, StationRef } from "@/components/explorer/types";
import { useBookSearch } from "@/hooks/useBookSearch";
import { useDensity } from "@/hooks/useDensity";
import { useExplorerState } from "@/hooks/useExplorerState";
import { useReadProgress } from "@/hooks/useReadProgress";
import type { ExplorerNode } from "@/lib/state/explorer";
import type { SearchDoc } from "@/lib/search";
import { NetworkMap, type NetworkMapHandle } from "./NetworkMap";
import type { Density } from "@/lib/density";
import { resolveGeometry, type MapGeometrySet, type MapLine } from "./types";
import styles from "./Explorer.module.css";

export interface PanelEntry {
  book: PanelBook;
  related: { id: string; reason: string }[];
}

export interface BoardLine extends MapLine {
  firstStation: { id: string; title: string };
}

export interface ExplorerProps {
  geometry: MapGeometrySet;
  lines: BoardLine[];
  explorerNodes: ExplorerNode[];
  searchDocs: SearchDoc[];
  panels: Record<string, PanelEntry>;
}

const PANEL_PX = 360 + 24;

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 899px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia("(max-width: 899px)").matches,
    () => false,
  );

const byLevelThenTitle = (a: StationRef, b: StationRef) => a.level - b.level || a.title.localeCompare(b.title);

export function Explorer({ geometry: geometrySet, lines, explorerNodes, searchDocs, panels }: ExplorerProps) {
  const mapRef = useRef<NetworkMapHandle>(null);
  const topicIds = useMemo(() => lines.map((l) => l.topicId), [lines]);
  const { state, selection, dimmed, selectBook, setTopic, setQuery } = useExplorerState(explorerNodes, topicIds);
  const search = useBookSearch(searchDocs, { initialQuery: state.q });
  const progress = useReadProgress();
  const narrow = useNarrow();
  const { density, setDensity } = useDensity();
  // The first density change (stored value applied after mount) re-fits instantly; user switches animate.
  const [userSwitched, setUserSwitched] = useState(false);
  const onDensity = useCallback(
    (d: Density) => {
      setUserSwitched(true);
      setDensity(d);
    },
    [setDensity],
  );
  const geometry = useMemo(() => resolveGeometry(geometrySet, density), [geometrySet, density]);

  const refById = useMemo(
    () =>
      new Map<string, StationRef>(
        geometry.nodes.map((n) => [n.id, { id: n.id, title: n.title, topicId: n.topicId, level: n.level }]),
      ),
    [geometry.nodes],
  );
  const lineByTopic = useMemo(() => new Map(lines.map((l) => [l.topicId, l])), [lines]);
  const rootId = useMemo(() => geometry.nodes.find((n) => n.level === 0)?.id, [geometry.nodes]);

  const selectedId = selection?.id ?? null;
  const entry = selectedId ? panels[selectedId] : undefined;
  const refs = useCallback(
    (ids: Iterable<string>) =>
      [...ids]
        .filter((id) => id !== rootId)
        .map((id) => refById.get(id))
        .filter((r): r is StationRef => !!r)
        .sort(byLevelThenTitle),
    [refById, rootId],
  );
  const prerequisites = useMemo(() => (selection ? refs(selection.prerequisites) : []), [selection, refs]);
  const unlocks = useMemo(() => (selection ? refs(selection.unlocks) : []), [selection, refs]);
  const related = useMemo(
    () =>
      (entry?.related ?? [])
        .map((r) => {
          const ref = refById.get(r.id);
          return ref ? { ...ref, reason: r.reason } : null;
        })
        .filter((r): r is StationRef & { reason: string } => !!r),
    [entry, refById],
  );
  const panelLine = useMemo(() => {
    const topic = entry?.book.topics[0];
    const l = topic ? lineByTopic.get(topic) : undefined;
    return l ? { letter: l.letter, color: l.color, name: l.name } : null;
  }, [entry, lineByTopic]);

  const results = useMemo(
    () =>
      search.results
        .map((r) => refById.get(r.id))
        .filter((r): r is StationRef => !!r)
        .map((r) => ({ ...r, titleEs: searchDocs.find((d) => d.id === r.id)?.titleEs })),
    [search.results, refById, searchDocs],
  );

  const onQuery = useCallback(
    (q: string) => {
      search.setQuery(q);
      setQuery(q);
    },
    [search, setQuery],
  );
  const insets = useMemo(
    () => (!selectedId ? undefined : narrow ? { bottom: 360 } : { right: PANEL_PX }),
    [selectedId, narrow],
  );

  // Selecting from the map keeps the view; picking from search / panel brings the station into view.
  const focusStation = useCallback(
    (id: string) => {
      selectBook(id);
      // The panel is about to open: center with its footprint already counted.
      requestAnimationFrame(() => mapRef.current?.centerOn(id, 1.15));
    },
    [selectBook],
  );

  const clear = useCallback(() => selectBook(null), [selectBook]);
  const read = progress.read;

  return (
    <div className={styles.shell} data-density={density}>
      <StationBoard
        lines={lines.map((l) => ({
          topicId: l.topicId,
          letter: l.letter,
          name: l.name,
          color: l.color,
          firstStation: l.firstStation,
        }))}
        activeTopic={state.tema}
        onTopic={setTopic}
        query={search.query}
        onQuery={onQuery}
        results={results}
        searchEmpty={search.empty}
        onPick={focusStation}
        readCount={progress.hydrated ? progress.count : 0}
        total={geometry.nodes.length}
      />

      <div className={styles.stage} data-panel={selectedId ? "open" : undefined}>
        <NetworkMap
          ref={mapRef}
          geometry={geometry}
          lines={lines}
          selection={selection}
          dimmed={dimmed}
          activeTopic={state.tema}
          read={read}
          onSelect={selectBook}
          insets={insets}
          animateRefit={userSwitched}
          density={density}
        />

        <div className={styles.density}>
          <DensityControl density={density} onDensity={onDensity} />
        </div>

        <div className={styles.links}>
          <Link className={styles.directoryLink} href="/estaciones">
            Directorio de estaciones
            <span aria-hidden="true"> →</span>
          </Link>
          <Link className={styles.directoryLink} href="/sumar-un-libro">
            Sumá un libro
            <span aria-hidden="true"> →</span>
          </Link>
        </div>

        <div className={styles.controls}>
          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onReset={() => mapRef.current?.reset()}
            onCenterSelected={selectedId ? () => mapRef.current?.centerOn(selectedId, 1.15) : undefined}
          />
        </div>

        {selectedId && entry ? (
          <div className={styles.panelSlot}>
            <StationPanel
              book={entry.book}
              line={panelLine}
              prerequisites={prerequisites}
              unlocks={unlocks}
              related={related}
              isRead={read.has(selectedId)}
              onToggleRead={() => progress.toggle(selectedId)}
              onClose={clear}
              onSelect={focusStation}
              readHydrated={progress.hydrated}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
