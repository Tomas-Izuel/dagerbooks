"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";
import {
  defaultTabStop,
  isOffscreen,
  normalizeAngle,
  resolveArrow,
  ringNeighbour,
  ringStep,
  toScreen,
} from "@/lib/graph-interaction";
import type { Insets, NavKey, NavNode, Point, Size } from "@/lib/graph-interaction";

export interface GraphKeyboardOptions {
  /** Nodes with {id, angle (rad, x=cos/y=sin, clockwise), ring}. Memoize it. */
  nodes: readonly NavNode[];
  /** The svg (or any wrapper) that contains the node elements. */
  containerRef: RefObject<Element | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** Graph-space position of a node (for scroll-into-view). */
  getPosition: (id: string) => Point | undefined;
  /** From usePanZoom. */
  transform: { x: number; y: number; k: number };
  getViewportSize: () => Size;
  centerOn: (x: number, y: number, k?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Area covered by overlays (e.g. the side panel) that counts as offscreen. */
  insets?: Partial<Insets>;
  /**
   * Which arrows walk the rings. "radial" (default): up/down change ring, left/right walk along it.
   * "horizontal" (subway bands): right/left change ring (zone), up/down walk along it; there
   * `ring` = zone and `angle` = the station's order (normalised to [0, 2π)) from top to bottom.
   */
  axis?: "radial" | "horizontal";
}

export interface GraphNodeProps {
  tabIndex: 0 | -1;
  "data-id": string;
  role: "button";
  "aria-pressed": boolean;
  onFocus: (e: FocusEvent<Element>) => void;
}

const ARROWS = new Set<string>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/** Horizontal axis: right = next zone, left = previous zone, up / down = neighbour in the zone (wraps). */
function resolveZoneArrow(nodes: readonly NavNode[], id: string, key: NavKey, referenceAngle?: number): NavNode | null {
  const current = nodes.find((n) => n.id === id);
  if (!current) return null;
  switch (key) {
    case "ArrowRight":
      return ringStep(nodes, id, 1, referenceAngle);
    case "ArrowLeft":
      return ringStep(nodes, id, -1, referenceAngle);
    case "ArrowUp":
      return current.ring === 0 ? null : ringNeighbour(nodes, id, -1);
    case "ArrowDown":
      return current.ring === 0 ? null : ringNeighbour(nodes, id, 1);
  }
}

/**
 * Roving-tabindex keyboard navigation for a radial graph.
 * Spread `containerProps` on the svg and `getNodeProps(id)` on each node.
 */
export function useGraphKeyboard(opts: GraphKeyboardOptions) {
  const {
    nodes, containerRef, selectedId, onSelect, onClear, getPosition,
    transform, getViewportSize, centerOn, zoomIn, zoomOut, reset, insets,
  } = opts;
  const horizontal = opts.axis === "horizontal";

  const [tab, setTab] = useState<string | null>(null);
  // Follow external selection (search, URL) without an effect.
  const [seenSelected, setSeenSelected] = useState<string | null>(selectedId);
  if (seenSelected !== selectedId) {
    setSeenSelected(selectedId);
    if (selectedId) setTab(selectedId);
  }

  const tabbableId = useMemo(() => {
    if (tab && nodes.some((n) => n.id === tab)) return tab;
    if (selectedId && nodes.some((n) => n.id === selectedId)) return selectedId;
    return defaultTabStop(nodes)?.id ?? null;
  }, [tab, selectedId, nodes]);

  // Angle remembered across vertical moves so out-then-in doesn't drift.
  const prefAngle = useRef<number | null>(null);
  const verticalMove = useRef(false);

  const ensureVisible = useCallback(
    (id: string) => {
      const p = getPosition(id);
      const size = getViewportSize();
      if (!p || size.width <= 0) return;
      if (isOffscreen(toScreen(transform, p), size, 32, insets)) centerOn(p.x, p.y);
    },
    [getPosition, getViewportSize, transform, insets, centerOn],
  );

  const focusNode = useCallback(
    (id: string) => {
      setTab(id);
      const el = containerRef.current?.querySelector<HTMLElement | SVGElement>(
        `[data-id="${CSS.escape(id)}"]`,
      );
      el?.focus({ preventScroll: true });
    },
    [containerRef],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<Element>) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const nodeEl = (e.target as Element).closest?.("[data-id]");
      const id = nodeEl?.getAttribute("data-id") ?? null;

      if (id && ARROWS.has(e.key)) {
        const node = nodes.find((n) => n.id === id);
        if (!node) return;
        e.preventDefault();
        // "vertical" = the keys that change ring (up / down on the radial axis, right / left on the horizontal one).
        const vertical = horizontal
          ? e.key === "ArrowLeft" || e.key === "ArrowRight"
          : e.key === "ArrowUp" || e.key === "ArrowDown";
        const ref = vertical ? (prefAngle.current ?? node.angle) : undefined;
        const next = (horizontal ? resolveZoneArrow : resolveArrow)(nodes, id, e.key as NavKey, ref);
        if (!next) return;
        verticalMove.current = vertical;
        if (!vertical && next.ring > 0) prefAngle.current = normalizeAngle(next.angle);
        focusNode(next.id);
        return;
      }
      if (id && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect(id);
        return;
      }
      switch (e.key) {
        case "Escape":
          onClear();
          return;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          return;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          return;
        case "0":
          e.preventDefault();
          reset();
          return;
      }
    },
    [nodes, focusNode, onSelect, onClear, zoomIn, zoomOut, reset, horizontal],
  );

  const getNodeProps = useCallback(
    (id: string): GraphNodeProps => ({
      tabIndex: id === tabbableId ? 0 : -1,
      "data-id": id,
      role: "button",
      "aria-pressed": id === selectedId,
      onFocus: () => {
        setTab(id);
        if (!verticalMove.current) {
          const n = nodes.find((x) => x.id === id);
          if (n && n.ring > 0) prefAngle.current = normalizeAngle(n.angle);
        }
        verticalMove.current = false;
        ensureVisible(id);
      },
    }),
    [tabbableId, selectedId, nodes, ensureVisible],
  );

  return {
    tabbableId,
    focusNode,
    getNodeProps,
    containerProps: { onKeyDown },
  };
}
