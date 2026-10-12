import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowIcon } from "./ArrowIcon";
import styles from "./ArrowLink.module.css";

interface ArrowLinkProps {
  href: string;
  children: ReactNode;
  /** CSS color (e.g. "var(--line-economia)"); por defecto porcelana. */
  ink?: string;
  variant?: "solid" | "ghost";
  direction?: "right" | "left";
}

/** Botón rectangular de borde 2px con flecha. */
export function ArrowLink({ href, children, ink, variant = "solid", direction = "right" }: ArrowLinkProps) {
  return (
    <Link href={href} className={styles.btn} data-variant={variant} style={ink ? ({ "--btn-ink": ink } as CSSProperties) : undefined}>
      {direction === "left" ? <ArrowIcon direction="left" /> : null}
      <span>{children}</span>
      {direction === "right" ? <ArrowIcon /> : null}
    </Link>
  );
}
