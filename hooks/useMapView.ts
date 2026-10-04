"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { MutableRefObject, Ref, RefObject } from "react";
import { usePanZoom } from "@/hooks/usePanZoom";
import type { PanZoomApi } from "@/hooks/usePanZoom";
import { fitScale } from "@/lib/graph-interaction/viewport";
import type { Bounds } from "@/lib/graph-interaction/viewport";
import type { MapHandle } from "@/components/map/types";

export interface MapViewOptions {
  /** Pannable area in graph coordinates. */
  panBounds: Bounds;
  /** Station positions of the view in play, by id. */
  nodeById: ReadonlyMap<string, { x: number; y: number }>;
  /**
   * The whole-network geometry. When its identity changes (density switch) the camera re-fits, or,
   * with a selection, keeps it centred at the same relative framing. Positions swap at once, never animated.
   */
  geometry: unknown;
  selectedId: string | null;
  /** Px covered by overlays (side panel / bottom sheet). */
  insets?: { right?: number; bottom?: number };
  /** Animate the re-fit on a density switch. Off = instant (first load). */
  animateRefit: boolean;
  /** The handle the parent drives the map with (zoom buttons, "center selected"). */
  handleRef?: Ref<MapHandle>;
  /** Floating chrome the "fit" framing keeps clear of (see `usePanZoom`). */
  reserve?: { right?: number; top?: number; bottom?: number };
  minZoom?: number | "fit";
  maxZoom?: number;
  /**
   * The view's home framing, when it is not "fit everything" (a tall map frames its width).
   * Used for the first framing, the re-fit on a density switch (no selection) and `reset`.
   */
  frame?: (pan: PanZoomApi, instant: boolean) => void;
  /** `reset` when it differs from `frame` (phones: reset shows the whole network). */
  reset?: (pan: PanZoomApi) => void;
  /** Zoom of the one-off centering on a selection that is already in the URL at load. Default 0.9. */
  bootMinK?: number;
}

export interface MapView {
  svgRef: RefObject<SVGSVGElement | null>;
  gRef: RefObject<SVGGElement | null>;
  pan: PanZoomApi;
  /** Latest `pan` and `insets`, for callbacks created once (written after every render). */
  live: MutableRefObject<{ pan: PanZoomApi; insets: MapViewOptions["insets"]; frame: MapViewOptions["frame"]; reset: MapViewOptions["reset"] }>;
}

/**
 * Camera of a map view: d3-zoom on the svg, the imperative `MapHandle`, the re-fit on a density
 * switch and the first centering on a URL selection. The view keeps what is geometry-specific
 * (bounds, labels, layers, focus transitions).
 */
export function useMapView(opts: MapViewOptions): MapView {
  const { panBounds, nodeById, geometry, selectedId, insets, animateRefit, handleRef } = opts;
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const pan = usePanZoom(svgRef, gRef, { bounds: panBounds, minZoom: opts.minZoom ?? "fit", maxZoom: opts.maxZoom ?? 3.5, reserve: opts.reserve });

  // Latest handlers for stable callbacks (written in an effect, read at event time).
  const { frame, reset } = opts;
  const live = useRef({ pan, insets, frame, reset });
  useEffect(() => {
    live.current = { pan, insets, frame, reset };
  });

  useImperativeHandle(
    handleRef,
    () => ({
      zoomIn: () => live.current.pan.zoomIn(),
      zoomOut: () => live.current.pan.zoomOut(),
      reset: () => {
        const { pan: p, reset: r, frame: f } = live.current;
        if (r) r(p);
        else if (f) f(p, false);
        else p.reset();
      },
      centerOn: (id, minK) => {
        const n = nodeById.get(id);
        if (!n) return;
        const { pan: p, insets: ins } = live.current;
        const k = Math.max(p.getTransform().k, minK ?? 0);
        p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k);
      },
    }),
    [nodeById],
  );

  // Density switch: new geometry. Positions swap at once (never animated); only the camera
  // moves. Without a selection, re-fit; with one, keep it centred at the same relative framing.
  // The snapshot effect below runs after this one, so `snap` still holds the previous geometry.
  const snap = useRef<{ k: number; bounds: Bounds } | null>(null);
  const prevGeometry = useRef(geometry);
  useEffect(() => {
    const prev = snap.current;
    if (prevGeometry.current === geometry) return;
    prevGeometry.current = geometry;
    const { pan: p, insets: ins, frame: f } = live.current;
    const instant = !animateRefit;
    const n = selectedId ? nodeById.get(selectedId) : undefined;
    if (!n || !prev) {
      if (f) f(p, instant);
      else p.fitToBounds(0, instant);
      return;
    }
    const size = p.getViewportSize();
    const ratio = size.width > 0 ? fitScale(panBounds, size) / fitScale(prev.bounds, size) : 1;
    const k = prev.k * ratio;
    p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k, instant);
  }, [geometry, selectedId, nodeById, panBounds, animateRefit]);
  useEffect(() => {
    snap.current = { k: pan.getTransform().k, bounds: panBounds };
  });

  // A selection already in the URL on load: bring it into view once.
  const bootMinK = opts.bootMinK ?? 0.9;
  const bootCentered = useRef(false);
  useEffect(() => {
    if (bootCentered.current || !selectedId) return;
    bootCentered.current = true;
    const n = nodeById.get(selectedId);
    if (!n) return;
    const raf = requestAnimationFrame(() => {
      const { pan: p, insets: ins } = live.current;
      const k = Math.max(p.getTransform().k, bootMinK);
      p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k);
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, nodeById, bootMinK]);

  return { svgRef, gRef, pan, live };
}
