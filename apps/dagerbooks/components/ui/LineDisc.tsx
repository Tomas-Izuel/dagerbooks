import type { CSSProperties } from "react";
import styles from "./LineDisc.module.css";

interface LineDiscProps {
  letter: string;
  color: string;
  size?: "sm" | "md" | "lg";
  /** Accessible line name, e.g. "Línea A, Fundamentos y herramientas". Omit when the name is already visible next to the disc. */
  label?: string;
}

export function LineDisc({ letter, color, size = "md", label }: LineDiscProps) {
  return (
    <span
      className={styles.disc}
      data-size={size}
      style={{ "--disc-ink": color } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {letter}
    </span>
  );
}
