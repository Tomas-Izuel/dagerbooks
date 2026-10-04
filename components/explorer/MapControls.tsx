"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { DENSITIES, DENSITY_LABEL, type Density } from "@/lib/density";
import styles from "./MapControls.module.css";

interface MapControlsProps {
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  onCenterSelected?(): void;
  density: Density;
  onDensity(d: Density): void;
}

const svgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square" as const,
  "aria-hidden": true,
};

function Btn({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className={styles.btn} aria-label={label} onClick={onClick}>
      {children}
      <span className={styles.tip} aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

/** Three dots at increasing spacing: tight, medium, loose. */
const DOT_GAP: Record<Density, number> = { compacta: 3, media: 5, aireada: 7.5 };

function DensityGlyph({ density }: { density: Density }) {
  const g = DOT_GAP[density];
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx={10 - g} cy="10" r="1.9" />
      <circle cx="10" cy="10" r="1.9" />
      <circle cx={10 + g} cy="10" r="1.9" />
    </svg>
  );
}

function DensityControl({ density, onDensity }: { density: Density; onDensity(d: Density): void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    radios.current[DENSITIES.indexOf(density)]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // Focus the checked option only when opening, not on every change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const i = DENSITIES.indexOf(density);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % DENSITIES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + DENSITIES.length - 1) % DENSITIES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DENSITIES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onDensity(DENSITIES[next]);
    radios.current[next]?.focus();
  }

  const label = `Densidad: ${DENSITY_LABEL[density]}`;
  return (
    <div ref={rootRef} className={styles.densityRoot}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.btn}
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${uid}-pop`}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <DensityGlyph density={density} />
        <span className={styles.tip} aria-hidden="true">
          {label}
        </span>
      </button>
      {open ? (
        <div id={`${uid}-pop`} className={styles.pop} onKeyDown={onKeyDown}>
          <p className={styles.popTitle} id={`${uid}-t`}>
            Densidad
          </p>
          <div role="radiogroup" aria-labelledby={`${uid}-t`} className={styles.options}>
            {DENSITIES.map((d, i) => (
              <button
                key={d}
                ref={(el) => {
                  radios.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={d === density}
                tabIndex={d === density ? 0 : -1}
                className={styles.option}
                onClick={() => onDensity(d)}
              >
                <DensityGlyph density={d} />
                <span>{DENSITY_LABEL[d]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MapControls({ onZoomIn, onZoomOut, onReset, onCenterSelected, density, onDensity }: MapControlsProps) {
  return (
    <div className={styles.group} role="group" aria-label="Controles del mapa">
      <Btn label="Acercar el mapa" onClick={onZoomIn}>
        <svg {...svgProps}>
          <path d="M10 4v12M4 10h12" />
        </svg>
      </Btn>
      <Btn label="Alejar el mapa" onClick={onZoomOut}>
        <svg {...svgProps}>
          <path d="M4 10h12" />
        </svg>
      </Btn>
      <Btn label="Ver toda la red" onClick={onReset}>
        <svg {...svgProps}>
          <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
        </svg>
      </Btn>
      {onCenterSelected ? (
        <Btn label="Centrar la estación elegida" onClick={onCenterSelected}>
          <svg {...svgProps}>
            <circle cx="10" cy="10" r="4.5" />
            <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" />
          </svg>
        </Btn>
      ) : null}
      <DensityControl density={density} onDensity={onDensity} />
    </div>
  );
}
