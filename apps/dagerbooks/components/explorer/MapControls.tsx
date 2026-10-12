"use client";

import type { ReactNode } from "react";
import styles from "./MapControls.module.css";

interface MapControlsProps {
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  onCenterSelected?(): void;
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

export function MapControls({ onZoomIn, onZoomOut, onReset, onCenterSelected }: MapControlsProps) {
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
    </div>
  );
}
