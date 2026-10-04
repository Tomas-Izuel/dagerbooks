"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { select } from "d3-selection";
import "d3-transition"; // side effect: adds selection.transition()
import { zoom, zoomIdentity } from "d3-zoom";
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from "d3-zoom";
import { fitScale } from "@/lib/graph-interaction/viewport";
import type { Bounds, Size } from "@/lib/graph-interaction/viewport";

export interface PanZoomOptions {
  /** Pannable area in graph coordinates; translation is clamped to it. */
  bounds: Bounds;
  /** Number, or "fit" = the scale at which `bounds` exactly fits the viewport (tracks resize). */
  minZoom: number | "fit";
  maxZoom: number;
  /** Fit to bounds on first measured size. Default true. */
  initialFit?: boolean;
  /** Transition length in ms (ignored under prefers-reduced-motion). Default 450. */
  duration?: number;
  /** Max pointer travel (px) still treated as a click, not a drag. Default 5. */
  clickDistance?: number;
}

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface PanZoomApi {
  /** Current transform (React state, coalesced to one update per frame). SSR/initial = identity. */
  transform: Transform;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Back to the fitted view. */
  reset: () => void;
  fitToBounds: (padding?: number, instant?: boolean) => void;
  /** Put graph point (x, y) in the viewport center; k defaults to the current scale. */
  centerOn: (x: number, y: number, k?: number, instant?: boolean) => void;
  /** Latest transform without re-rendering (use in event handlers). */
  getTransform: () => Transform;
  /** Viewport size in px (0x0 until measured). */
  getViewportSize: () => Size;
}

const IDENTITY: Transform = { x: 0, y: 0, k: 1 };
const ZOOM_STEP = 1.5;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * d3-zoom on an <svg>, writing the transform to an inner <g> (attribute, not
 * React state, so panning never re-renders the node tree).
 *
 * Click-vs-drag: d3-zoom swallows the click that ends a drag longer than
 * `clickDistance`, so plain `onClick` on nodes only fires for real clicks.
 * Double-click zoom is disabled on elements with `data-id` (nodes) so that
 * double-clicking a node doesn't zoom. Wheel, drag, pinch and double-tap work
 * everywhere else. The hook sets `touch-action: none` on the svg.
 */
export function usePanZoom(
  svgRef: RefObject<SVGSVGElement | null>,
  gRef: RefObject<SVGGElement | null>,
  options: PanZoomOptions,
): PanZoomApi {
  const { bounds, minZoom, maxZoom } = options;
  const { x0, y0, x1, y1 } = bounds;
  const duration = options.duration ?? 450;
  const clickDistance = options.clickDistance ?? 5;
  const initialFit = options.initialFit ?? true;

  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const transformRef = useRef<Transform>(IDENTITY);
  // Latest options for callbacks created once.
  const cfgRef = useRef({ bounds: { x0, y0, x1, y1 }, minZoom, maxZoom, duration });
  useEffect(() => {
    cfgRef.current = { bounds: { x0, y0, x1, y1 }, minZoom, maxZoom, duration };
  }, [x0, y0, x1, y1, minZoom, maxZoom, duration]);

  const minScale = useCallback((): number => {
    const c = cfgRef.current;
    const size = sizeRef.current;
    if (c.minZoom === "fit") {
      return size.width > 0 ? Math.min(fitScale(c.bounds, size), c.maxZoom) : 0.01;
    }
    return Math.min(c.minZoom, c.maxZoom);
  }, []);

  /** Apply `fn` on the selection, animated unless reduced motion / duration 0. */
  const run = useCallback(
    (fn: (target: ReturnType<typeof animated>) => void, instant = false) => {
      const svg = svgRef.current;
      if (!svg || !zoomRef.current) return;
      const sel = select(svg);
      fn(animated(sel));
      function animated(s: typeof sel) {
        const d = cfgRef.current.duration;
        return !instant && d > 0 && !prefersReducedMotion() ? s.transition().duration(d) : s;
      }
    },
    [svgRef],
  );

  const transformTo = useCallback(
    (t: ZoomTransform, instant = false) => {
      const z = zoomRef.current;
      if (!z) return;
      const constrained = z.constrain()(
        t,
        [
          [0, 0],
          [sizeRef.current.width, sizeRef.current.height],
        ],
        z.translateExtent(),
      );
      run((target) => {
        (target as unknown as { call: (f: unknown, t: ZoomTransform) => void }).call(
          z.transform,
          constrained,
        );
      }, instant);
    },
    [run],
  );

  const fitToBounds = useCallback(
    (padding = 0, instant = false) => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      const b = cfgRef.current.bounds;
      const k = Math.min(
        Math.max(fitScale(b, sizeRef.current, padding), minScale()),
        cfgRef.current.maxZoom,
      );
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      transformTo(zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-cx, -cy), instant);
    },
    [minScale, transformTo],
  );

  // Create the behavior once per svg/g pair.
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const sel = select(svg);
    let raf = 0;
    let pending: Transform | null = null;
    let fitted = false;

    const behavior = zoom<SVGSVGElement, unknown>()
      .clickDistance(clickDistance)
      .filter((event: Event) => {
        const e = event as MouseEvent;
        // d3 default (no ctrl+click, left button only; wheel always) plus: no dblclick-zoom on nodes.
        if (e.type === "dblclick" && (e.target as Element | null)?.closest?.("[data-id]")) {
          return false;
        }
        return (!e.ctrlKey || e.type === "wheel") && !e.button;
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { x, y, k } = event.transform;
        g.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
        transformRef.current = { x, y, k };
        pending = { x, y, k };
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (pending) setTransform(pending);
            pending = null;
          });
        }
      });
    zoomRef.current = behavior;
    const prevTouchAction = svg.style.touchAction;
    svg.style.touchAction = "none";
    sel.call(behavior);
    // Double-click/double-tap zoom stays (default); it is filtered on nodes above.

    const apply = () => {
      const c = cfgRef.current;
      const { width, height } = sizeRef.current;
      behavior
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([minScale(), c.maxZoom])
        .translateExtent([
          [c.bounds.x0, c.bounds.y0],
          [c.bounds.x1, c.bounds.y1],
        ]);
    };

    const measure = () => {
      const rect = svg.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      if (rect.width <= 0 || rect.height <= 0) return;
      apply();
      if (!fitted && initialFit) {
        fitted = true;
        const b = cfgRef.current.bounds;
        const k = Math.min(Math.max(fitScale(b, sizeRef.current), minScale()), cfgRef.current.maxZoom);
        const t = zoomIdentity
          .translate(rect.width / 2, rect.height / 2)
          .scale(k)
          .translate(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
        sel.call(behavior.transform, t); // instant
      } else {
        fitted = true;
        sel.call(behavior.scaleBy, 1); // re-clamp scale + translate to new extents
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      sel.interrupt();
      sel.on(".zoom", null);
      svg.style.touchAction = prevTouchAction;
      zoomRef.current = null;
    };
    // initialFit/clickDistance are treated as mount-time options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, gRef]);

  // Bounds / zoom limits changed: update extents and re-clamp.
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || sizeRef.current.width <= 0) return;
    z.scaleExtent([minScale(), maxZoom]).translateExtent([
      [x0, y0],
      [x1, y1],
    ]);
    select(svg).call(z.scaleBy, 1);
  }, [svgRef, x0, y0, x1, y1, minZoom, maxZoom, minScale]);

  const zoomBy = useCallback(
    (factor: number) => {
      const z = zoomRef.current;
      if (!z) return;
      run((target) => {
        (target as unknown as { call: (f: unknown, k: number) => void }).call(z.scaleBy, factor);
      });
    },
    [run],
  );

  const centerOn = useCallback(
    (x: number, y: number, k?: number, instant = false) => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      const scale = Math.min(
        Math.max(k ?? transformRef.current.k, minScale()),
        cfgRef.current.maxZoom,
      );
      transformTo(zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-x, -y), instant);
    },
    [minScale, transformTo],
  );

  return useMemo<PanZoomApi>(
    () => ({
      transform,
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      reset: () => fitToBounds(),
      fitToBounds,
      centerOn,
      getTransform: () => transformRef.current,
      getViewportSize: () => sizeRef.current,
    }),
    [transform, zoomBy, fitToBounds, centerOn],
  );
}
