import type { CSSProperties } from "react";
import { amazonUrl } from "@/lib/affiliate";
import { ArrowIcon } from "./ArrowIcon";
import styles from "./AmazonBuy.module.css";

interface AmazonBuyProps {
  asin: string;
  title: string;
  /** Tinta de la línea; por defecto porcelana. */
  ink?: string;
}

/** Link de afiliado + nota de transparencia. Sin estado: sirve en server y client. */
export function AmazonBuy({ asin, title, ink }: AmazonBuyProps) {
  return (
    <div className={styles.wrap} style={ink ? ({ "--btn-ink": ink } as CSSProperties) : undefined}>
      <a className={styles.btn} href={amazonUrl(asin)} target="_blank" rel="sponsored noopener noreferrer">
        <span>Comprar libro en Amazon</span>
        <ArrowIcon direction="up-right" />
        <span className={styles.srOnly}>
          {" "}
          ({title}; link de afiliado, se abre en otra pestaña)
        </span>
      </a>
      <p className={styles.note}>
        Es un link de afiliado de quien hizo esta web: usarlo es una forma de apoyarlo, pero es opcional. Comprarlo por
        otro lado está igual de bien.
      </p>
      <p className={styles.note}>
        Como afiliado de Amazon, obtiene ingresos por las compras adscritas que cumplan los requisitos aplicables.
      </p>
    </div>
  );
}
