"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { DENSITIES, DENSITY_LABEL, type Density } from "@/lib/density";
import styles from "./DensityControl.module.css";

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

/** Always-visible ruled segmented control (radiogroup, arrows / Home / End move the choice). */
export function DensityControl({ density, onDensity }: { density: Density; onDensity(d: Density): void }) {
  const labelId = useId();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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

  return (
    <div className={styles.root}>
      <p className={styles.label} id={labelId}>
        Densidad
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.options} onKeyDown={onKeyDown}>
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
            <span className={styles.name}>{DENSITY_LABEL[d]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
