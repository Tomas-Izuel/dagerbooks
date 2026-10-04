"use client";

import { useId } from "react";
import { RecMark } from "@/components/ui/RecMark";
import type { Recommendation } from "@/lib/catalog/schema";
import { REC_ORDER, isAllRecs } from "@/lib/design/recommendation";
import styles from "./RecommendationFilter.module.css";

export interface RecommendationFilterProps {
  labels: Record<Recommendation, { label: string; description: string }>;
  active: readonly Recommendation[];
  /** Books that would match each level, within the active line. */
  counts: Record<Recommendation, number>;
  onToggle(r: Recommendation): void;
  onReset(): void;
}

/**
 * "¿Qué tan recomendado?": three independent toggles (aria-pressed), like checkboxes. All three start on;
 * the last one left on can't be turned off, so the filter never empties.
 */
export function RecommendationFilter({ labels, active, counts, onToggle, onReset }: RecommendationFilterProps) {
  const hintId = useId();
  const all = isAllRecs(active);

  return (
    <section className={styles.root} aria-labelledby={`${hintId}-t`}>
      <header className={styles.head}>
        <h2 className={styles.title} id={`${hintId}-t`}>
          ¿Qué tan recomendado?
        </h2>
        {all ? null : (
          <button type="button" className={styles.reset} onClick={onReset}>
            Ver todos
          </button>
        )}
      </header>
      <div role="group" aria-label="Nivel de recomendación" aria-describedby={hintId} className={styles.options}>
        {REC_ORDER.map((r) => {
          const on = active.includes(r);
          const locked = on && active.length === 1;
          return (
            <button
              key={r}
              type="button"
              className={styles.option}
              aria-pressed={on}
              aria-disabled={locked || undefined}
              title={locked ? "Tiene que quedar al menos un nivel" : labels[r].description}
              onClick={() => {
                if (!locked) onToggle(r);
              }}
            >
              <RecMark level={r} size={20} />
              <span className={styles.name}>{labels[r].label}</span>
              <span className={styles.count}>
                {counts[r]}
                <span className={styles.srOnly}> {counts[r] === 1 ? "libro" : "libros"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.hint} id={hintId}>
        Prendé o apagá cada nivel. Se cruza con la línea y la búsqueda.
      </p>
    </section>
  );
}
