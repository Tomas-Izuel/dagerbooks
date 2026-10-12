"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { VISTAS, VISTA_LABEL, type Vista } from "@/lib/view";
import styles from "./ViewControl.module.css";

function ViewGlyph({ vista }: { vista: Vista }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {vista === "grafo" ? (
        <>
          <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
          <path d="M10 8V2.5M11.7 11 16.5 13.8M8.3 11 3.5 13.8" />
          <circle cx="10" cy="2.2" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17" cy="14.1" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="3" cy="14.1" r="1.3" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d="M2 10H11L16 5H18M11 10H18M11 10 16 15H18" strokeLinejoin="round" />
          <circle cx="3.5" cy="10" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="18" cy="5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="15" r="1.2" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

/**
 * Choice of map view (Grafo | Subte). Same ruled segmented style as DensityControl and the same
 * radiogroup keyboard model (arrows / Home / End). It is a presentation mode, not navigation, so
 * it is not a tablist. Meant to sit inside the shared sign; on a phone it collapses to icons.
 */
export function ViewControl({
  vista,
  onVista,
  onIntent,
}: {
  vista: Vista;
  onVista(v: Vista): void;
  /** Pointer or focus arrived: a chance to warm the lazy chunk of the other view. */
  onIntent?(): void;
}) {
  const labelId = useId();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = VISTAS.indexOf(vista);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % VISTAS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + VISTAS.length - 1) % VISTAS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = VISTAS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onVista(VISTAS[next]);
    radios.current[next]?.focus();
  }

  return (
    <div className={styles.root}>
      <p className={styles.label} id={labelId}>
        Vista
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.options}
        onKeyDown={onKeyDown}
        onPointerEnter={onIntent}
        onFocus={onIntent}
      >
        {VISTAS.map((v, i) => (
          <button
            key={v}
            ref={(el) => {
              radios.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={v === vista}
            aria-label={`Vista ${VISTA_LABEL[v].toLowerCase()}`}
            tabIndex={v === vista ? 0 : -1}
            className={styles.option}
            onClick={() => onVista(v)}
          >
            <ViewGlyph vista={v} />
            <span className={styles.name} aria-hidden="true">
              {VISTA_LABEL[v]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
